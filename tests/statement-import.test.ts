import { describe, expect, it } from "vitest";
import type { Account, Entry } from "../src/lib/types";
import { reconstructPdfPageRows } from "../src/lib/finance/pdf-reader";
import {
  buildImportBatchPayload,
  computeImportSummary,
  descriptionsMatchForImport,
  detectStatementDocumentType,
  extractTextFromPdfBuffer,
  inferCategory,
  parseStatementInput,
  prepareImportPreview,
} from "../src/lib/finance/statement-import";

const account: Account = {
  id: "00000000-0000-4000-8000-000000000001",
  user_id: "00000000-0000-4000-8000-000000000002",
  name: "Conta Itaú",
  kind: "checking",
  opening_cents: 0,
  opening_date: "2026-01-01",
};
const bankText = [
  "extrato conta / lançamentos",
  "período de visualização: 07/08/2026 até 05/11/2026",
  "data lançamentos valor (R$) saldo (R$)",
  "26/10/2026 PAY UBER 24/10 -8,93",
  "26/10/2026 PAY DL 99 26/10 -12,99",
  "26/10/2026 PAY DL 99 26/10 -11,98",
  "23/10/2026 CREDITO CONSIGNADO 360,29",
  "23/10/2026 SALDO DO DIA 587,05",
  "22/10/2026 PIX TRANSF Conta Própria -150,00",
].join("\n");

function preview(text = bankText, existingEntries: Entry[] = []) {
  return prepareImportPreview({
    rawText: text,
    fileName: "itau_extrato_102026.pdf",
    targetAccount: account,
    existingEntries,
  });
}
function existing(entry: Partial<Entry>): Entry {
  return {
    id: "00000000-0000-4000-8000-000000000099",
    user_id: account.user_id,
    description: "Uber",
    kind: "expense",
    amount_cents: 893,
    date: "2026-10-26",
    status: "posted",
    source_account_id: account.id,
    target_account_id: null,
    category: "Transporte",
    gross_cents: null,
    deductions_cents: null,
    recurrence_id: null,
    occurrence_date: null,
    source: "manual",
    external_id: null,
    import_batch_id: null,
    categorization_rule_id: null,
    ...entry,
  };
}

describe("Importação de extrato bancário Itaú · fase 3.0.3", () => {
  it("interpreta valor negativo como saída, crédito sem sinal como entrada e ignora SALDO DO DIA", () => {
    expect(detectStatementDocumentType(bankText)).toBe("bank");
    const rows = parseStatementInput(bankText, { fileName: "itau.pdf" }).rows;
    expect(rows).toHaveLength(5);
    expect(rows.find((r) => r.rawDescription === "CREDITO CONSIGNADO")).toMatchObject({
      amountCents: 36029,
      kind: "income",
    });
    expect(rows.find((r) => r.rawDescription.startsWith("PAY UBER"))).toMatchObject({
      amountCents: 893,
      kind: "expense",
    });
  });

  it("não usa saldo da última coluna como valor de transação", () => {
    const text = [
      "extrato conta / lançamentos",
      "26/10/2026 PAY DL 99 26/10 -12,99 163,98",
      "23/10/2026 CREDITO CONSIGNADO 360,29 587,05",
      "23/10/2026 SALDO DO DIA 587,05",
    ].join("\n");
    const rows = parseStatementInput(text).rows;
    expect(rows.map((r) => [r.amountCents, r.kind])).toEqual([
      [1299, "expense"],
      [36029, "income"],
    ]);
  });

  it("reconhece PAY DL 99 como Transporte sem confundir códigos 199", () => {
    expect(inferCategory("PAY DL 99 26/10", "expense")).toBe("Transporte");
    expect(inferCategory("99POP CORRIDA", "expense")).toBe("Transporte");
    expect(inferCategory("PEDIDO 19999", "expense")).toBe("Outros");
  });

  it("respeita a coluna D/C mesmo quando o CSV usa números positivos", () => {
    const text = [
      "Data;Descrição;Valor;Tipo",
      "26/10/2026;PAY DL 99;12,99;D",
      "23/10/2026;CREDITO CONSIGNADO;360,29;C",
    ].join("\n");
    expect(parseStatementInput(text, { fileName: "movimentos.csv" }).rows.map((r) => r.kind))
      .toEqual(["expense", "income"]);
  });

  it("não elimina duas compras da 99 de mesmo dia com valores diferentes", () => {
    const p = preview();
    expect(p.items).toHaveLength(5);
    expect(p.items.filter((i) => i.category === "Transporte")).toHaveLength(3);
    expect(p.items.find((i) => i.description.includes("CREDITO CONSIGNADO"))).toMatchObject({
      kind: "income",
      selected: true,
      category: "Empréstimos e financiamentos",
    });
  });

  it("não presume duplicata porque duas compras têm mesmo valor e data", () => {
    const p = preview(undefined, [existing({ description: "Restaurante", amount_cents: 893 })]);
    expect(p.items.find((i) => i.rawDescription.includes("UBER")))?.toMatchObject({
      duplicateStatus: "new",
      selected: true,
    });
    expect(descriptionsMatchForImport("PAY DL 99 26/10", "Uber *Trip")).toBe(false);
  });

  it("desmarca lançamento manual equivalente e mantém idempotência por ID externo", () => {
    const p = preview(undefined, [existing({ description: "PAY UBER 24/10" })]);
    const uber = p.items.find((i) => i.rawDescription.includes("UBER"))!;
    expect(uber.duplicateStatus).toBe("manual_match");
    expect(uber.selected).toBe(false);
    const imported = existing({ source: "import", external_id: uber.externalId });
    expect(preview(undefined, [imported]).items.find((i) => i.externalId === uber.externalId))
      .toMatchObject({ duplicateStatus: "exact_duplicate", selected: false });
  });

  it("identifica FITIDs duplicados no mesmo arquivo", () => {
    const ofx = `<OFX><BANKMSGSRSV1><STMTTRN><TRNTYPE>DEBIT\n<DTPOSTED>20261026\n<TRNAMT>-12.99\n<FITID>XYZ\n<NAME>99 POP\n</STMTTRN><STMTTRN><TRNTYPE>DEBIT\n<DTPOSTED>20261026\n<TRNAMT>-12.99\n<FITID>XYZ\n<NAME>99 POP\n</STMTTRN>`;
    const items = preview(ofx).items;
    expect(items).toHaveLength(2);
    expect(items[1]).toMatchObject({ duplicateStatus: "exact_duplicate", selected: false });
  });

  it("pede revisão de valores sem sinal quando documento é desconhecido", () => {
    const p = preview("26/10/2026 Uber 24,90");
    expect(p.items[0]).toMatchObject({
      duplicateStatus: "review_required",
      selected: false,
    });
  });

  it("sugere transferência entre contas, mas só muda o tipo após confirmação", () => {
    const p = preview();
    const transfer = p.items.find((i) => i.rawDescription.includes("PIX TRANSF"))!;
    expect(transfer.transferSuggestion).toBe(true);
    expect(buildImportBatchPayload({ items: [transfer], targetAccount: account })[0]).toMatchObject({
      kind: "expense",
      amount_cents: 15000,
    });
    const other = "00000000-0000-4000-8000-000000000003";
    const changed = { ...transfer, transferAccountId: other };
    expect(buildImportBatchPayload({ items: [changed], targetAccount: account })[0]).toMatchObject({
      kind: "transfer",
      amount_cents: 15000,
      source_account_id: account.id,
      target_account_id: other,
    });
    expect(computeImportSummary([changed])).toMatchObject({
      selectedExpenseCents: 0,
      selectedIncomeCents: 0,
      transferCount: 1,
    });
  });

  it("concilia o outro lado de transferência já registrada, sem nova entrada", () => {
    const transfer = existing({
      kind: "transfer",
      description: "PIX TRANSF Outra conta",
      amount_cents: 15000,
      source_account_id: "00000000-0000-4000-8000-000000000003",
      target_account_id: account.id,
      date: "2026-10-22",
      source: "import",
    });
    const p = preview("extrato conta\n22/10/2026 PIX RECEBIDO Outra conta 150,00", [transfer]);
    expect(p.items[0]).toMatchObject({ duplicateStatus: "exact_duplicate", selected: false });
  });

  it("preserva tamanho e identidade dos 199 itens de um arquivo grande", () => {
    const lines = ["extrato conta / lançamentos"];
    for (let i = 0; i < 199; i++) {
      const cents = String(i + 1).padStart(3, "0");
      lines.push(`26/10/2026 PAY DL 99 CORRIDA ${i} -${cents.slice(0, -2)},${cents.slice(-2)}`);
    }
    const p = preview(lines.join("\n"));
    expect(p.items).toHaveLength(199);
    expect(new Set(p.items.map((i) => i.externalId)).size).toBe(199);
  });

  it("reconstitui linhas por coordenadas em streams PDF de texto", async () => {
    const obj = (x: number, y: number, text: string) =>
      `BT 1 0 0 1 ${x} ${y} Tm (${text}) Tj ET`;
    const stream = [
      obj(10, 700, "extrato conta / lancamentos"),
      obj(10, 675, "26/10/2026"),
      obj(110, 675, "PAY DL 99 26/10"),
      obj(520, 675, "-12,99"),
      obj(10, 653, "23/10/2026"),
      obj(110, 653, "CREDITO CONSIGNADO"),
      obj(520, 653, "360,29"),
    ].join("\n");
    const buffer = new TextEncoder().encode(`%PDF-1.4\nstream\n${stream}\nendstream`).buffer;
    const result = await extractTextFromPdfBuffer(buffer);
    expect(result).toContain("26/10/2026 PAY DL 99 26/10 -12,99");
    expect(parseStatementInput(result).rows.map((r) => r.kind)).toEqual(["expense", "income"]);
  });

  it("identifica uma fatura separadamente de um extrato", () => {
    expect(detectStatementDocumentType("Resumo da fatura de cartão de crédito")).toBe("invoice");
    expect(detectStatementDocumentType("Saldos e limites da conta\nSALDO DO DIA")).toBe("bank");
  });
});

describe("Conciliação de transferências entre Nubank e Itaú", () => {
  const nubank = { ...account, id: "10000000-0000-4000-8000-000000000001", name: "Nubank" };

  it.each([
    ["12 SET 2026", "14/09/2026", "12/09", "72,62"],
    ["24 OUT 2026", "26/10/2026", "24/10", "150,00"],
    ["02 OUT 2026", "05/10/2026", "02/10", "150,00"],
  ])("concilia o Pix de %s creditado em %s nas duas ordens de importação", (sent, received, originalDate, amount) => {
    const itauText = `extrato conta\n${received} PIX TRANSF ALEX CO${originalDate} ${amount}`;
    const nubankText = `${sent} Total de saídas -${amount}\nTransferência enviada pelo Pix Alex Costa ${amount}`;
    const itau = { rawText: itauText, fileName: "itau.pdf", targetAccount: account };
    const nu = { rawText: nubankText, fileName: "nubank.pdf", targetAccount: nubank };

    for (const [first, second] of [[itau, nu], [nu, itau]]) {
      const firstPreview = prepareImportPreview({ ...first, existingEntries: [] });
      const batch = buildImportBatchPayload({
        items: [{ ...firstPreview.items[0], transferAccountId: second.targetAccount.id }],
        targetAccount: first.targetAccount,
      });
      expect(batch).toHaveLength(1);
      const result = prepareImportPreview({ ...second, existingEntries: [existing(batch[0])] });
      expect(result.items).toHaveLength(1);
      expect(result.items[0]).toMatchObject({
        selected: false,
        duplicateStatus: "exact_duplicate",
        matchedEntry: { kind: "transfer", date: batch[0].date },
      });
    }
  });

  it("mantém Pix de outra pessoa ou de outra data e concilia cada transferência só uma vez", () => {
    const transfer = existing({
      kind: "transfer",
      date: "2026-09-12",
      description: "Transferência enviada pelo Pix Alex Costa",
      amount_cents: 7262,
      source_account_id: nubank.id,
      target_account_id: account.id,
      source: "import",
    });
    const result = preview([
      "extrato conta",
      "14/09/2026 PIX TRANSF ALEX MO12/09 72,62",
      "14/09/2026 PIX TRANSF ALEX CO13/09 72,62",
      "14/09/2026 PIX TRANSF ALEX CO12/09 72,62",
      "14/09/2026 PIX TRANSF ALEX CO12/09 72,62",
      "14/09/2026 PIX RECEBIDO 72,62",
    ].join("\n"), [transfer]);

    expect(result.items.map((item) => item.selected)).toEqual([true, true, false, true, true]);
  });
});

describe("Extrato de conta do Nubank com movimentações agrupadas", () => {
  const text = [
    "Saldo inicial 6,72",
    "Total de entradas +500,00",
    "Total de saídas -506,72",
    "Movimentações",
    "05 AGO 2026 Total de entradas +500,00",
    "Transferência recebida pelo Pix Pessoa A - •••.000.000-•• - Banco A 500,00",
    "Banco A Agência: 123 Conta: 12345-6",
    "06 AGO 2026 Total de saídas −506,72",
    "Transferência enviada pelo Pix Pessoa B 500,00",
    "Banco B Agência: 1 Conta:",
    "12345-6",
    "Transferência enviada pelo Pix Pessoa C 6,72",
  ].join("\n");

  function prepareNubankPreview(rawText: string) {
    return prepareImportPreview({
      rawText,
      fileName: "extrato-nubank.pdf",
      targetAccount: { ...account, name: "Conta Nubank" },
      existingEntries: [],
    });
  }

  it("traz os Pix individuais, aplica a data e o sentido do grupo e ignora os subtotais", () => {
    expect(detectStatementDocumentType(text)).toBe("bank");
    const result = prepareNubankPreview(text);
    expect(result.error).toBeUndefined();
    expect(result.items.map(({ date, description, amountCents, kind }) =>
      [date, description, amountCents, kind],
    )).toEqual([
      ["2026-08-05", "Transferência recebida pelo Pix Pessoa A", 50000, "income"],
      ["2026-08-06", "Transferência enviada pelo Pix Pessoa B", 50000, "expense"],
      ["2026-08-06", "Transferência enviada pelo Pix Pessoa C", 672, "expense"],
    ]);
  });

  it("mantém a data quando o segundo grupo do dia vem sem data no texto do PDF", () => {
    const rows = reconstructPdfPageRows([
      { str: "05 AGO 2026", x: 20, y: 700 },
      { str: "Total de entradas", x: 100, y: 700 },
      { str: "+1.200,00", x: 520, y: 700 },
      { str: "Depósito recebido", x: 100, y: 680 },
      { str: "1.200,00", x: 520, y: 680 },
      { str: "Total de saídas", x: 100, y: 660 },
      { str: "-20,00", x: 520, y: 660 },
      { str: "Compra no débito", x: 100, y: 640 },
      { str: "20,00", x: 520, y: 640 },
    ]);
    const result = prepareNubankPreview(rows.join("\n"));
    expect(result.error).toBeUndefined();
    expect(result.items.map(({ date, amountCents, kind }) => [date, amountCents, kind]))
      .toEqual([["2026-08-05", 120000, "income"], ["2026-08-05", 2000, "expense"]]);
  });

  it("bloqueia a prévia se o subtotal indicar uma movimentação que não foi lida", () => {
    const result = prepareNubankPreview(text.replace("Transferência enviada pelo Pix Pessoa C 6,72", ""));
    expect(result.items).toEqual([]);
    expect(result.error).toContain("06 AGO 2026");
  });
});
