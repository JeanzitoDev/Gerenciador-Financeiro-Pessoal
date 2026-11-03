import { describe, it, expect } from "vitest";
import {
  parseMoney,
  formatMoney,
  moneyInput,
  sumCents,
  MAX_CENTS,
} from "../src/lib/finance/money";
import {
  addMonths,
  validDate,
  inclusiveMonths,
} from "../src/lib/finance/dates";
import { recurrenceDates } from "../src/lib/finance/recurrence";
import {
  balance,
  overview,
  planGoals,
  project,
  investmentReturn,
} from "../src/lib/finance/engine";
import { csvCell } from "../src/lib/finance/csv";
import {
  calculateFirstDueDate,
  buildCreditCardSchedule,
  creditCardSummary,
  formatCreditCardExternalId,
  isCreditWalletAccount,
} from "../src/lib/finance/credit-cards";
import {
  obfuscateText,
  deobfuscateText,
  obfuscateRecordPayload,
  deobfuscateRecordRow,
} from "../src/lib/privacy-crypto";
import {
  buildImportBatchPayload,
  extractTextFromPdfBuffer,
  parseStatementInput,
  prepareImportPreview,
} from "../src/lib/finance/statement-import";
import type { Account, Entry, FinanceData, Goal } from "../src/lib/types";
const a: Account = {
  id: "a",
  user_id: "u",
  name: "Banco",
  kind: "checking",
  opening_cents: 10000,
  opening_date: "2026-01-01",
};
const entry = (extra: Partial<Entry>): Entry => ({
  id: "e",
  user_id: "u",
  kind: "income",
  description: "Teste",
  amount_cents: 1000,
  date: "2026-01-02",
  status: "posted",
  source_account_id: null,
  target_account_id: "a",
  category: "Outros",
  gross_cents: null,
  deductions_cents: null,
  recurrence_id: null,
  occurrence_date: null,
  source: "manual",
  external_id: null,
  import_batch_id: null,
  categorization_rule_id: null,
  ...extra,
});
describe("moeda e datas", () => {
  it("formata agregados grandes sem perder centavos", () => {
    expect(formatMoney(Number.MAX_SAFE_INTEGER)).toBe(
      "R$\u00a090.071.992.547.409,91",
    );
    expect(formatMoney(-1)).toBe("-R$\u00a00,01");
  });
  it("preserva centavos brasileiros e negativos", () => {
    expect(parseMoney("R$ 1.234,56")).toBe(123456);
    expect(parseMoney("-0,01")).toBe(-1);
    expect(sumCents([10, 20])).toBe(30);
    expect(moneyInput(123456)).toBe("1234,56");
  });
  it.each(["1.23", "1,234", "1e3", "NaN", "", "1.2.3", "R$ 2,000"])(
    "rejeita entrada ambígua %s",
    (v) => expect(() => parseMoney(v)).toThrow(),
  );
  it("protege limite e datas impossíveis", () => {
    expect(sumCents([MAX_CENTS, 1])).toBe(MAX_CENTS + 1);
    expect(() => sumCents([Number.MAX_SAFE_INTEGER, 1])).toThrow();
    expect(validDate("2026-02-29")).toBe(false);
    expect(validDate("2024-02-29")).toBe(true);
    expect(inclusiveMonths("2026-10-18", "2027-01-02")).toBe(4);
  });
  it("não deriva dia mensal depois de fevereiro", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-01-31", 2)).toBe("2026-03-31");
  });
});
describe("recorrências", () => {
  it("mensal e anual ancoradas", () => {
    expect(
      recurrenceDates("2026-01-31", "monthly", "2026-01-01", "2026-03-31"),
    ).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
    expect(
      recurrenceDates("2024-02-29", "yearly", "2028-01-01", "2028-12-31"),
    ).toEqual(["2028-02-29"]);
  });
  it("respeita fim e janela", () => {
    expect(
      recurrenceDates(
        "2026-01-01",
        "weekly",
        "2026-01-01",
        "2026-02-01",
        "2026-01-10",
      ),
    ).toEqual(["2026-01-01", "2026-01-08"]);
    expect(() =>
      recurrenceDates("2026-01-01", "monthly", "2026-01-01", "2028-01-01"),
    ).toThrow();
  });
});
describe("saldos e relatórios", () => {
  it("previsões e cancelamentos não alteram caixa; transferência preserva patrimônio", () => {
    const b = { ...a, id: "b", kind: "investment" as const, opening_cents: 0 };
    const entries = [
      entry({
        kind: "transfer",
        source_account_id: "a",
        target_account_id: "b",
        amount_cents: 5000,
      }),
      entry({ status: "planned" }),
      entry({ status: "cancelled" }),
    ];
    expect(balance(a, entries, "2026-01-31")).toBe(5000);
    expect(balance(b, entries, "2026-01-31")).toBe(5000);
  });
  it("separa VA/VR e não duplica reservas", () => {
    const data: FinanceData = {
      accounts: [a, { ...a, id: "va", kind: "benefit", opening_cents: 2000 }],
      transactions: [
        entry({}),
        entry({ id: "v", target_account_id: "va", amount_cents: 3000 }),
      ],
      contributions: [
        {
          id: "c",
          user_id: "u",
          goal_id: "g",
          account_id: "a",
          amount_cents: 2000,
          date: "2026-01-01",
          note: "",
        },
      ],
      goals: [],
      investments: [],
      recurrences: [],
      profile: {
        user_id: "u",
        display_name: "",
        theme: "light",
        accent: "violet",
        background: "plain",
      },
    };
    expect(overview(data, "2026-01", "2026-01-31")).toMatchObject({
      income: 1000,
      assets: 11000,
      benefits: 5000,
      assigned: 2000,
      free: 9000,
      liquid: 9000,
    });
  });
  it("exibe o que restou disponível quando despesas consomem o cheque especial", () => {
    const data: FinanceData = {
      accounts: [
        {
          id: "c1",
          user_id: "u",
          name: "Conta Principal",
          kind: "checking",
          opening_cents: 9909,
          opening_date: "2026-10-01",
          overdraft_cents: 10000,
        },
      ],
      transactions: [
        entry({
          id: "exp1",
          kind: "expense",
          source_account_id: "c1",
          target_account_id: null,
          amount_cents: 18056,
          date: "2026-10-15",
        }),
      ],
      contributions: [],
      goals: [],
      investments: [],
      recurrences: [],
      profile: {
        user_id: "u",
        display_name: "",
        theme: "light",
        accent: "violet",
        background: "plain",
      },
    };
    expect(overview(data, "2026-10", "2026-10-30")).toMatchObject({
      expense: 18056,
      free: -8147,
      liquid: 0,
      overdraftLimit: 10000,
      overdraftUsed: 8147,
      overdraftAvailable: 1853,
    });
  });
});
describe("metas e simulação", () => {
  const goals: Goal[] = [
    {
      id: "g",
      user_id: "u",
      name: "Reserva",
      target_cents: 120000,
      target_date: "2026-12-31",
      priority: 2,
      monthly_budget_cents: null,
    },
    {
      id: "h",
      user_id: "u",
      name: "Curso",
      target_cents: 90000,
      target_date: "2026-10-31",
      priority: 1,
      monthly_budget_cents: 20000,
    },
  ];
  it("nunca aloca acima da verba e respeita teto", () => {
    const p = planGoals(goals, [], 50000, "2026-10-18", "date");
    expect(p.rows.map((r) => r.proposed)).toEqual([20000, 30000]);
    expect(p.remaining).toBe(0);
    expect(p.shortfall).toBe(80000);
  });
  it("juros anuais equivalentes e aporte ao fim do mês", () => {
    const p = project(100000, 0, 12, 0.12, 0.06).at(-1)!;
    expect(p.total).toBe(112000);
    expect(p.real).toBe(105660);
    expect(project(0, 10000, 12, 0, 0).at(-1)!.total).toBe(120000);
  });
  it("perdas e taxas inválidas", () => {
    expect(project(100000, 0, 12, -0.1, 0).at(-1)!.total).toBe(90000);
    expect(() => project(0, 0, 12, -1, 0)).toThrow();
    expect(() => project(0, -1, 12, 0, 0)).toThrow();
  });
  it("Modified Dietz não trata aporte como rendimento", () => {
    const inv = { ...a, kind: "investment" as const };
    const entries = [
      entry({
        date: "2026-01-01",
        kind: "transfer",
        source_account_id: "b",
        amount_cents: 10000,
      }),
      entry({ date: "2027-01-01", kind: "yield", amount_cents: 2000 }),
    ];
    const r = investmentReturn(inv, entries, "2027-01-01", 0.05);
    expect(r.gain).toBe(2000);
    expect(r.nominal).toBeCloseTo(0.1);
    expect(r.real).toBeCloseTo(1.1 / 1.05 - 1);
    expect(
      investmentReturn({ ...inv, opening_cents: 0 }, [], "2026-01-01", 0)
        .nominal,
    ).toBeNull();
  });
  it("neutraliza fórmulas CSV", () => {
    expect(csvCell('=HYPERLINK("x")')).toBe('"\'=HYPERLINK(""x"")"');
    expect(csvCell("Normal")).toBe('"Normal"');
  });
  it("calcula vencimentos de cartão de crédito e segrega das contas bancárias", () => {
    // Cartão fecha dia 8 e vence dia 15
    expect(calculateFirstDueDate("2026-10-05", 15, 8)).toBe("2026-10-15");
    expect(calculateFirstDueDate("2026-10-08", 15, 8)).toBe("2026-11-15");

    const schedule = buildCreditCardSchedule({
      purchaseDate: "2026-10-10",
      dueDay: 15,
      closingDay: 8,
      totalInstallments: 3,
      installmentCents: 20000,
    });
    expect(schedule.firstDueDate).toBe("2026-11-15");
    expect(schedule.lastDueDate).toBe("2027-01-15");
    expect(schedule.totalCents).toBe(60000);
    expect(schedule.items.map((r) => r.dueDate)).toEqual([
      "2026-11-15",
      "2026-12-15",
      "2027-01-15",
    ]);

    const card: Account = {
      id: "cc1",
      user_id: "u",
      name: "Nubank Ultravioleta",
      kind: "credit_card",
      institution: "Nubank",
      opening_cents: 0,
      opening_date: "2026-10-01",
      credit_limit_cents: 500000,
      closing_day: 8,
      due_day: 15,
    };

    const entries: Entry[] = schedule.items.map((row) =>
      entry({
        id: `cc-row-${row.number}`,
        kind: "expense",
        description: `TV (${row.number}/${row.total})`,
        amount_cents: row.amountCents,
        date: row.dueDate,
        source_account_id: card.id,
        target_account_id: null,
        status: "planned",
        external_id: formatCreditCardExternalId({
          groupId: "g1",
          installmentNumber: row.number,
          totalInstallments: row.total,
          purchaseDate: "2026-10-10",
          dueDate: row.dueDate,
        }),
      }),
    );

    const summary = creditCardSummary(card, entries, "2026-11", "2026-11-01");
    expect(summary.limitCents).toBe(500000);
    expect(summary.usedCents).toBe(60000);
    expect(summary.availableCents).toBe(440000);
    expect(summary.currentInvoice.totalCents).toBe(20000);
    expect(summary.currentInvoice.openCents).toBe(20000);

    const data: FinanceData = {
      accounts: [a, card],
      transactions: entries,
      contributions: [],
      goals: [],
      investments: [],
      recurrences: [],
      profile: {
        user_id: "u",
        display_name: "",
        theme: "light",
        accent: "violet",
        background: "plain",
      },
    };
    const ov = overview(data, "2026-11", "2026-11-30");
    // Saldo da conta bancária (10000) permanece 100% segregado das faturas do cartão
    expect(ov.free).toBe(10000);
    expect(ov.liquid).toBe(10000);
    expect(ov.expense).toBe(0);
    expect(ov.creditCardLimit).toBe(500000);
    expect(ov.creditCardUsed).toBe(60000);
    expect(ov.creditCardAvailable).toBe(440000);
    expect(ov.creditCardInvoice).toBe(20000);
  });

  it("identifica carteiras de crédito digital (Shopee SParcelado, Mercado Crédito) vs cartões bancários", () => {
    expect(
      isCreditWalletAccount({
        name: "Shopee SParcelado",
        institution: "Shopee (SParcelado)",
      }),
    ).toBe(true);
    expect(
      isCreditWalletAccount({
        name: "Mercado Crédito",
        institution: "Mercado Pago",
      }),
    ).toBe(true);
    expect(
      isCreditWalletAccount({
        name: "Itaú Click",
        institution: "Itaú",
      }),
    ).toBe(false);
  });

  it("ofusca e desofusca textos sensíveis respeitando isolamento por usuário e limites SQL", () => {
    const userA = "11111111-1111-4111-8111-111111111111";
    const userB = "22222222-2222-4222-8222-222222222222";

    const cipher = obfuscateText("Supermercado Assaí · Compra do mês", userA, 140, true);
    expect(cipher.startsWith("enc:")).toBe(true);
    expect(cipher.length).toBeLessThanOrEqual(140);

    // Desofuscação com a chave do mesmo usuário recupera o texto original
    expect(deobfuscateText(cipher, userA)).toBe("Supermercado Assaí · Compra do mês");

    // Outro usuário não consegue desofuscar o token (validação de tag HMAC)
    expect(deobfuscateText(cipher, userB)).toBe(cipher);

    // Textos legados em texto plano continuam funcionando normalmente
    expect(deobfuscateText("Conta Corrente Itaú", userA)).toBe("Conta Corrente Itaú");

    // Concatenação parcial gerada pela RPC pay_loan_installment é desofuscada preservando o sufixo
    const loanNameCipher = obfuscateText("Empréstimo Carro", userA, 80, true);
    expect(
      deobfuscateText(`${loanNameCipher} · Parcela 3/24`, userA),
    ).toBe("Empréstimo Carro · Parcela 3/24");

    // Payload e Row round-trip respeitando o limite de 80 caracteres do PostgreSQL
    const payload = obfuscateRecordPayload(
      "accounts",
      {
        name: "Cartão Nubank Ultravioleta Principal da Família",
        institution: "Nu Pagamentos S.A.",
        balance_cents: 150000,
      },
      userA,
      true,
    );
    expect(String(payload.name).startsWith("enc:")).toBe(true);
    expect(String(payload.name).length).toBeLessThanOrEqual(80);
    expect(String(payload.institution).startsWith("enc:")).toBe(true);
    expect(String(payload.institution).length).toBeLessThanOrEqual(80);

    const restored = deobfuscateRecordRow("accounts", payload, userA);
    expect(restored.name).toBe("Cartão Nubank Ultravioleta Principal da Família");
    expect(restored.institution).toBe("Nu Pagamentos S.A.");
    expect(restored.balance_cents).toBe(150000);
  });

  it("interpreta extratos OFX, CSV e texto colado, categoriza automaticamente e evita duplicidade manual (v3.0.0)", async () => {
    const bankAcc: Account = {
      id: "11111111-1111-4111-8111-000000000010",
      user_id: "u",
      name: "Conta Itaú",
      kind: "checking",
      opening_cents: 100000,
      opening_date: "2026-01-01",
    };
    const cardAcc: Account = {
      id: "11111111-1111-4111-8111-000000000015",
      user_id: "u",
      name: "Nubank",
      kind: "credit_card",
      institution: "Nubank",
      opening_cents: 0,
      opening_date: "2026-01-01",
      credit_limit_cents: 500000,
      closing_day: 8,
      due_day: 15,
    };

    // 1. OFX parsing
    const ofxSample = `
      <OFX>
        <BANKMSGSRSV1>
          <STMTTRN>
            <TRNTYPE>DEBIT
            <DTPOSTED>20261012100000[-3:BRT]
            <TRNAMT>-42.90
            <FITID>20261012001
            <MEMO>PIX ENVIADO - IFOOD *RESTAURANTE
          </STMTTRN>
          <STMTTRN>
            <TRNTYPE>CREDIT
            <DTPOSTED>20261005100000[-3:BRT]
            <TRNAMT>4200.00
            <FITID>20261005001
            <MEMO>SALARIO LIQUIDO EMPRESA
          </STMTTRN>
        </BANKMSGSRSV1>
      </OFX>
    `;
    const existingManualSalary = entry({
      id: "manual-sal",
      kind: "income",
      description: "Salário do mês",
      amount_cents: 420000,
      date: "2026-10-05",
      target_account_id: bankAcc.id,
      source_account_id: null,
      category: "Salário",
    });

    const ofxPreview = prepareImportPreview({
      rawText: ofxSample,
      fileName: "extrato.ofx",
      targetAccount: bankAcc,
      existingEntries: [existingManualSalary],
    });
    expect(ofxPreview.format).toBe("ofx");
    expect(ofxPreview.items).toHaveLength(2);
    // iFood -> Novo, Alimentação, selecionado
    expect(ofxPreview.items[0].description).toBe("IFOOD *RESTAURANTE");
    expect(ofxPreview.items[0].category).toBe("Alimentação");
    expect(ofxPreview.items[0].duplicateStatus).toBe("new");
    expect(ofxPreview.items[0].selected).toBe(true);
    // Salário -> coincide com lançamento manual de mesmo valor/data -> desmarcado por padrão!
    expect(ofxPreview.items[1].duplicateStatus).toBe("manual_match");
    expect(ofxPreview.items[1].selected).toBe(false);
    expect(ofxPreview.items[1].matchedEntry?.id).toBe("manual-sal");

    // 2. Credit card CSV with installments and invoice payment filtering
    const ccCsv = [
      "date,category,title,amount",
      "2026-10-04,compras,Shopee *Kit Cozinha 01/03,89.90",
      "2026-10-06,serviços,Netflix.com,55.90",
      "2026-10-08,pagamento,Pagamento recebido,-350.00",
    ].join("\n");

    const ccPreview = prepareImportPreview({
      rawText: ccCsv,
      fileName: "fatura-nubank.csv",
      targetAccount: cardAcc,
      invoiceMonth: "2026-10",
      existingEntries: [],
    });
    expect(ccPreview.items).toHaveLength(3);
    expect(ccPreview.items[0].description).toBe("Shopee *Kit Cozinha (1/3)");
    expect(ccPreview.items[0].installmentNumber).toBe(1);
    expect(ccPreview.items[0].totalInstallments).toBe(3);
    expect(ccPreview.items[0].category).toBe("Compras");
    expect(ccPreview.items[0].selected).toBe(true);
    expect(ccPreview.items[1].category).toBe("Assinaturas");
    expect(ccPreview.items[1].selected).toBe(true);
    expect(ccPreview.items[2].duplicateStatus).toBe("invoice_payment");
    expect(ccPreview.items[2].selected).toBe(false);

    // 3. Batch payload projects remaining installments (2/3 and 3/3)
    const batch = buildImportBatchPayload({
      items: ccPreview.items,
      targetAccount: cardAcc,
      invoiceStatus: "planned",
      projectFutureInstallments: true,
    });
    // 1/3 + 2/3 + 3/3 + Netflix = 4 entries
    expect(batch).toHaveLength(4);
    expect(batch.map((b) => b.description)).toEqual([
      "Shopee *Kit Cozinha (1/3)",
      "Shopee *Kit Cozinha (2/3)",
      "Shopee *Kit Cozinha (3/3)",
      "Netflix.com",
    ]);
    expect(batch.map((b) => b.date)).toEqual([
      "2026-10-15",
      "2026-11-15",
      "2026-12-15",
      "2026-10-15",
    ]);

    // 4. Plain text copied from PDF invoice (including DD MMM format)
    const pdfLines = [
      "12/10 UBER *TRIP R$ 24,90",
      "14 OUT DROGASIL 1234 R$ 62,50",
    ].join("\n");
    const parsedPdf = parseStatementInput(pdfLines, {
      referenceMonth: "2026-10",
      isCreditCardTarget: true,
    });
    expect(parsedPdf.rows).toHaveLength(2);
    expect(parsedPdf.rows[0].amountCents).toBe(2490);
    expect(parsedPdf.rows[1].amountCents).toBe(6250);
    expect(parsedPdf.rows[1].date).toBe("2026-10-14");

    // 5. Native PDF text stream extraction
    const mockPdfStream = `%PDF-1.4\n1 0 obj\n<< /Length 64 >>\nstream\nBT (15/10 IFOOD *REST R$ 49,90) Tj T* (18/10 NETFLIX.COM R$ 55,90) Tj ET\nendstream\nendobj`;
    const pdfBuffer = new TextEncoder().encode(mockPdfStream).buffer;
    const extracted = await extractTextFromPdfBuffer(pdfBuffer);
    const parsedFromPdfBuffer = parseStatementInput(extracted, {
      referenceMonth: "2026-10",
      isCreditCardTarget: true,
    });
    expect(parsedFromPdfBuffer.rows).toHaveLength(2);
    expect(parsedFromPdfBuffer.rows[0].amountCents).toBe(4990);
    expect(parsedFromPdfBuffer.rows[1].amountCents).toBe(5590);
  });
});
