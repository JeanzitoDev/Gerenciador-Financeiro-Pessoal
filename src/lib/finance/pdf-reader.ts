/**
 * Leitura local de PDFs bancários (inclusive PDFs com senha).
 *
 * Nunca envie a senha ao servidor, persista-a, ou a registre em logs.
 * O arquivo e a senha são usados somente pelo PDF.js no navegador.
 */

export type PdfImportErrorCode =
  | "password-required"
  | "password-incorrect"
  | "too-many-pages"
  | "too-much-text"
  | "unreadable";

export class PdfImportError extends Error {
  constructor(
    readonly code: PdfImportErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "PdfImportError";
  }
}

export interface PdfTextPart {
  str: string;
  x: number;
  y: number;
}

/**
 * A tabela bancária costuma imprimir data, descrição, valor e saldo como blocos
 * separados. Reconstrua uma linha pela posição Y e ordene as células pelo X;
 * não confunda a coluna de saldo com um lançamento.
 */
export function reconstructPdfPageRows(parts: PdfTextPart[]): string[] {
  const rows: { y: number; parts: PdfTextPart[] }[] = [];
  for (const part of parts) {
    const str = part.str.replace(/\s+/g, " ").trim();
    if (!str) continue;
    const row = rows.find((existing) => Math.abs(existing.y - part.y) <= 2.5);
    if (row) row.parts.push({ ...part, str });
    else rows.push({ y: part.y, parts: [{ ...part, str }] });
  }
  return rows
    .sort((a, b) => b.y - a.y)
    .map((row) =>
      row.parts
        .sort((a, b) => a.x - b.x)
        .map((part) => part.str)
        .join(" ")
        .replace(/\s+/g, " ")
        .trim(),
    )
    .filter(Boolean);
}

const MAX_PDF_PAGES = 250;
const MAX_EXTRACTED_CHARACTERS = 5 * 1024 * 1024;

/**
 * Lê um PDF localmente, usando PDF.js (suporte real a filtros, fontes e senha).
 * PDF.js executa em um worker servido junto ao aplicativo, nunca em CDN.
 * Não retorna PDF nem senha ao backend: somente o texto da prévia permanece no app.
 */
export async function readBankPdf(
  buffer: ArrayBuffer,
  password?: string,
): Promise<string> {
  // Importação dinâmica: não carregue o parser até o usuário escolher um PDF.
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    "pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ).toString();

  const task = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    ...(password ? { password } : {}),
    isEvalSupported: false,
    useSystemFonts: true,
  });
  try {
    const document = await task.promise;
    if (document.numPages > MAX_PDF_PAGES) {
      throw new PdfImportError(
        "too-many-pages",
        `O PDF tem ${document.numPages} páginas. O limite é de ${MAX_PDF_PAGES}; exporte um período menor.`,
      );
    }
    const lines: string[] = [];
    let textLength = 0;
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      const parts: PdfTextPart[] = [];
      for (const item of content.items) {
        if (!("str" in item) || !item.str) continue;
        parts.push({
          str: item.str,
          x: item.transform[4],
          y: item.transform[5],
        });
      }
      const pageLines = reconstructPdfPageRows(parts);
      textLength += pageLines.reduce((n, line) => n + line.length + 1, 0);
      if (textLength > MAX_EXTRACTED_CHARACTERS) {
        throw new PdfImportError(
          "too-much-text",
          "O texto extraído ultrapassa 5 MB. Exporte um extrato com período menor.",
        );
      }
      lines.push(...pageLines);
      page.cleanup();
    }
    return lines.join("\n");
  } catch (error) {
    if (error instanceof PdfImportError) throw error;
    if (
      error instanceof Error &&
      (error.name === "PasswordException" ||
        ("code" in error && (error.code === 1 || error.code === 2)))
    ) {
      throw new PdfImportError(
        password ? "password-incorrect" : "password-required",
        password
          ? "Senha incorreta. Confira a senha do PDF e tente novamente."
          : "Este PDF é protegido por senha. Informe a senha para continuar.",
      );
    }
    throw new PdfImportError(
      "unreadable",
      "Não foi possível ler este PDF. Tente exportá-lo novamente ou use OFX/CSV.",
    );
  } finally {
    await task.destroy();
  }
}
