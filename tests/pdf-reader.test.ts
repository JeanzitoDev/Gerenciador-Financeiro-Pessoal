import { describe, expect, it } from "vitest";
import { PdfImportError, reconstructPdfPageRows } from "../src/lib/finance/pdf-reader";

describe("Leitura de PDF bancário protegido", () => {
  it("reconstitui as colunas de uma tabela no PDF sem misturar linhas", () => {
    const rows = reconstructPdfPageRows([
      { str: "-8,93", x: 550, y: 700 },
      { str: "163,98", x: 690, y: 700 },
      { str: "PAY UBER 24/10", x: 130, y: 700 },
      { str: "26/10/2026", x: 50, y: 700 },
      { str: "360,29", x: 550, y: 681 },
      { str: "CREDITO CONSIGNADO", x: 130, y: 680 },
      { str: "23/10/2026", x: 50, y: 680 },
      { str: "587,05", x: 690, y: 680 },
    ]);
    expect(rows).toEqual([
      "26/10/2026 PAY UBER 24/10 -8,93 163,98",
      "23/10/2026 CREDITO CONSIGNADO 360,29 587,05",
    ]);
  });

  it("não confunde trechos de linhas de páginas distintas", () => {
    expect(reconstructPdfPageRows([
      { str: "26/10/2026", x: 50, y: 500 },
      { str: "PAY DL 99", x: 130, y: 500 },
      { str: "-12,99", x: 560, y: 500 },
      { str: "23/10/2026", x: 50, y: 475 },
      { str: "CREDITO CONSIGNADO", x: 130, y: 475 },
      { str: "360,29", x: 560, y: 475 },
    ])).toHaveLength(2);
  });

  it("mantém códigos de erro específicos, sem carregar CPF/senha nas mensagens", () => {
    const error = new PdfImportError("password-incorrect", "Senha incorreta.");
    expect(error.code).toBe("password-incorrect");
    expect(error.message).toBe("Senha incorreta.");
  });
});
