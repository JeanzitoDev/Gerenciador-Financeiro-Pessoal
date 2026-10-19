import { z } from "zod";
import { MAX_CENTS } from "./finance/money";
import { validDate } from "./finance/dates";
import type { Entity } from "./types";
const text = (n: number) =>
  z.string().trim().min(1, "Preencha este campo.").max(n);
const cents = z.number().int().min(-MAX_CENTS).max(MAX_CENTS);
const positive = cents.refine((n) => n > 0, "Informe um valor positivo.");
const date = z
  .string()
  .refine(validDate, "Data inválida.")
  .refine(
    (s) => s >= "2000-01-01" && s <= "2100-12-31",
    "Use uma data de 2000 a 2100.",
  );
const id = z.uuid();
const nullableId = id.nullable();
export const accountSchema = z.object({
  name: text(80),
  kind: z.enum(["checking", "cash", "benefit", "investment"]),
  opening_cents: cents,
  opening_date: date,
});
export const goalSchema = z.object({
  name: text(80),
  target_cents: positive,
  target_date: date,
  priority: z.number().int().min(1).max(99),
  monthly_budget_cents: cents.nonnegative().nullable(),
});
export const contributionSchema = z.object({
  goal_id: id,
  account_id: id,
  amount_cents: positive,
  date,
  note: z.string().max(200).default(""),
});
export const investmentSchema = z.object({
  name: text(80),
  account_id: id,
  annual_rate: z.number().gt(-1).max(10),
  inflation_rate: z.number().gt(-1).max(10),
});
export const transactionSchema = z
  .object({
    kind: z.enum(["income", "expense", "transfer", "yield"]),
    description: text(140),
    amount_cents: cents.refine(
      (n) => n !== 0,
      "Informe um valor diferente de zero.",
    ),
    date,
    status: z.enum(["planned", "posted", "cancelled"]),
    source_account_id: nullableId,
    target_account_id: nullableId,
    category: text(60),
    gross_cents: cents.nonnegative().nullable().default(null),
    deductions_cents: cents.nonnegative().nullable().default(null),
  })
  .superRefine((v, ctx) => {
    if (v.kind !== "yield" && v.amount_cents <= 0)
      ctx.addIssue({
        code: "custom",
        message: "O valor deve ser positivo.",
        path: ["amount_cents"],
      });
    const valid =
      v.kind === "expense"
        ? !!v.source_account_id && !v.target_account_id
        : v.kind === "transfer"
          ? !!v.source_account_id &&
            !!v.target_account_id &&
            v.source_account_id !== v.target_account_id
          : !v.source_account_id && !!v.target_account_id;
    if (!valid)
      ctx.addIssue({
        code: "custom",
        message: "Selecione as contas corretas.",
        path: ["source_account_id"],
      });
    if (
      (v.gross_cents !== null || v.deductions_cents !== null) &&
      (v.kind !== "income" ||
        v.gross_cents === null ||
        v.deductions_cents === null ||
        v.gross_cents - v.deductions_cents !== v.amount_cents)
    )
      ctx.addIssue({
        code: "custom",
        message: "Bruto menos descontos deve ser igual ao líquido.",
        path: ["gross_cents"],
      });
  });
export const recurrenceSchema = z
  .object({
    kind: z.enum(["income", "expense"]),
    description: text(140),
    amount_cents: positive,
    source_account_id: nullableId,
    target_account_id: nullableId,
    category: text(60),
    frequency: z.enum(["monthly", "weekly", "yearly"]),
    start_date: date,
    end_date: date.nullable(),
    active: z.boolean(),
    auto_post: z.boolean().default(false),
  })
  .superRefine((v, ctx) => {
    if (v.end_date && v.end_date < v.start_date)
      ctx.addIssue({
        code: "custom",
        message: "Fim anterior ao início.",
        path: ["end_date"],
      });
    if (
      v.kind === "income"
        ? !!v.source_account_id || !v.target_account_id
        : !v.source_account_id || !!v.target_account_id
    )
      ctx.addIssue({
        code: "custom",
        message: "Selecione uma conta.",
        path: ["source_account_id"],
      });
  });
export const profileSchema = z.object({
  display_name: z.string().trim().max(80),
  theme: z.enum(["light", "dark", "system"]),
  accent: z.enum([
    "violet",
    "emerald",
    "blue",
    "rose",
    "amber",
    "teal",
    "indigo",
    "coral",
  ]),
  background: z.enum(["plain", "gradient", "dots", "aurora", "grid", "waves"]),
});
export const loanSchema = z
  .object({
    name: text(80),
    institution: z.string().trim().max(80).default(""),
    kind: z.enum(["loan", "financing"]),
    principal_cents: positive.nullable(),
    installment_cents: positive,
    total_installments: z.number().int().min(1).max(1200),
    paid_before: z.number().int().min(0).max(1200),
    first_due_date: date,
    monthly_rate: z.number().min(0).max(10).nullable(),
    cet_annual_rate: z.number().min(0).max(10).nullable(),
    account_id: nullableId,
  })
  .superRefine((v, ctx) => {
    if (v.paid_before > v.total_installments)
      ctx.addIssue({
        code: "custom",
        message: "Parcelas pagas excedem o total.",
        path: ["paid_before"],
      });
  });
export const schemas = {
  loans: loanSchema,
  accounts: accountSchema,
  transactions: transactionSchema,
  goals: goalSchema,
  contributions: contributionSchema,
  investments: investmentSchema,
  recurrences: recurrenceSchema,
};
export function isEntity(s: string): s is Entity {
  return Object.hasOwn(schemas, s);
}
export const generationSchema = z.object({ from: date, until: date });
export const uuidSchema = id;
