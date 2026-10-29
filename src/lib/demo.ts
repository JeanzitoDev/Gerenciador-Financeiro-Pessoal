import type { Account, Entry, Entity, FinanceData } from "./types";
import { loanSchedule } from "./finance/loans";
import { today, addMonths } from "./finance/dates";
import { balance, goalFunded, reserved } from "./finance/engine";
import { recurrenceDates } from "./finance/recurrence";
import { schemas, profileSchema } from "./validation";
import { validateGoalGraph } from "./finance/goal-dependencies";
export const DEMO_USER = "00000000-0000-4000-8000-000000000001";
const uid = (n: number) =>
  `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;
export function demoData(): FinanceData {
  const now = today(),
    month = now.slice(0, 7),
    previous = addMonths(`${month}-01`, -5),
    day = Number(now.slice(8));
  const bank = uid(10),
    cash = uid(11),
    inv = uid(12),
    va = uid(13),
    reserve = uid(20),
    trip = uid(21),
    course = uid(22);
  const owned = { user_id: DEMO_USER };
  const accounts: Account[] = [
    {
      ...owned,
      id: bank,
      name: "Conta do dia a dia",
      kind: "checking",
      opening_cents: 450000,
      opening_date: previous,
      overdraft_cents: 150000,
    },
    {
      ...owned,
      id: cash,
      name: "Carteira",
      kind: "cash",
      opening_cents: 25000,
      opening_date: previous,
    },
    {
      ...owned,
      id: inv,
      name: "Reserva investida",
      kind: "investment",
      opening_cents: 720000,
      opening_date: previous,
    },
    {
      ...owned,
      id: va,
      name: "Vale alimentação",
      kind: "benefit",
      opening_cents: 0,
      opening_date: previous,
    },
  ];
  const transactions: Entry[] = [];
  let count = 100;
  function add(extra: Partial<Entry>) {
    transactions.push({
      ...owned,
      id: uid(count++),
      kind: "income",
      description: "Receita",
      amount_cents: 0,
      date: now,
      status: "posted",
      source_account_id: null,
      target_account_id: bank,
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
  }
  for (let offset = -5; offset <= 0; offset++) {
    const m = addMonths(`${month}-01`, offset).slice(0, 7);
    const date = (d: number) =>
      `${m}-${String(offset === 0 ? Math.min(d, day) : d).padStart(2, "0")}`;
    add({
      description: "Salário líquido",
      amount_cents: 420000,
      date: date(5),
      category: "Salário",
      gross_cents: 500000,
      deductions_cents: 80000,
    });
    add({
      description: "Vale alimentação",
      amount_cents: 65000,
      date: date(5),
      target_account_id: va,
      category: "Benefícios",
    });
    for (const [description, category, amount, d] of [
      ["Aluguel", "Moradia", 125000, 7],
      ["Supermercado", "Alimentação", 42890 + offset * 200, 9],
      ["Internet", "Casa", 9990, 10],
      ["Transporte", "Transporte", 18500, 12],
      ["Café e encontros", "Lazer", 24700 + offset * 500, 15],
    ] as const)
      add({
        kind: "expense",
        description,
        category,
        amount_cents: amount,
        date: date(d),
        source_account_id: bank,
        target_account_id: null,
      });
    add({
      kind: "expense",
      description: "Compras com o VA",
      amount_cents: 48000,
      date: date(14),
      source_account_id: va,
      target_account_id: null,
      category: "Alimentação",
    });
    add({
      kind: "transfer",
      description: "Aporte na aplicação",
      amount_cents: 50000,
      date: date(12),
      source_account_id: bank,
      target_account_id: inv,
      category: "Investimentos",
    });
    add({
      kind: "yield",
      description: "Rendimento observado",
      amount_cents: 4800 + (offset + 5) * 350,
      date: date(15),
      target_account_id: inv,
      category: "Rendimentos",
    });
  }
  add({
    kind: "expense",
    description: "Plano de celular",
    amount_cents: 5990,
    date: `${month}-28`,
    status: "planned",
    source_account_id: bank,
    target_account_id: null,
    category: "Casa",
  });
  return {
    accounts,
    loans: [],
    email: "visitante@demo.local",
    transactions,
    goals: [
      {
        ...owned,
        id: reserve,
        name: "Reserva de emergência",
        target_cents: 1500000,
        target_date: addMonths(now, 8),
        priority: 1,
        monthly_budget_cents: null,
      },
      {
        ...owned,
        id: trip,
        name: "Próxima viagem",
        target_cents: 600000,
        target_date: addMonths(now, 6),
        priority: 2,
        monthly_budget_cents: 50000,
      },
      {
        ...owned,
        id: course,
        name: "Investir em mim",
        target_cents: 250000,
        target_date: addMonths(now, 4),
        priority: 3,
        monthly_budget_cents: 30000,
      },
    ],
    contributions: [
      {
        ...owned,
        id: uid(30),
        goal_id: reserve,
        account_id: inv,
        amount_cents: 780000,
        date: now,
        note: "Parte da aplicação reservada",
      },
      {
        ...owned,
        id: uid(31),
        goal_id: trip,
        account_id: bank,
        amount_cents: 180000,
        date: now,
        note: "",
      },
      {
        ...owned,
        id: uid(32),
        goal_id: course,
        account_id: bank,
        amount_cents: 50000,
        date: now,
        note: "",
      },
    ],
    investments: [
      {
        ...owned,
        id: uid(40),
        account_id: inv,
        name: "Minha reserva",
        annual_rate: 0.1,
        inflation_rate: 0.045,
      },
    ],
    recurrences: [
      {
        ...owned,
        id: uid(50),
        kind: "expense",
        description: "Internet",
        amount_cents: 9990,
        source_account_id: bank,
        target_account_id: null,
        category: "Casa",
        frequency: "monthly",
        start_date: `${month}-10`,
        end_date: null,
        active: true,
        auto_post: false,
        auto_from: now,
      },
    ],
    profile: {
      user_id: DEMO_USER,
      display_name: "Visitante",
      onboarding_step: 4,
      onboarding_completed_at: `${now}T12:00:00.000Z`,
      theme: "dark",
      accent: "violet",
      background: "gradient",
    },
  };
}
export function validateDemo(data: FinanceData): void {
  validateGoalGraph(data.goals);
  const asOf = today();
  for (const l of data.loans ?? []) {
    if (
      l.account_id &&
      !data.accounts.some(
        (a) => a.id === l.account_id && ["checking", "cash"].includes(a.kind),
      )
    )
      throw new Error("Escolha uma conta em dinheiro para pagar as parcelas.");
    if (
      data.transactions.some(
        (e) =>
          e.loan_id === l.id &&
          (e.installment_number! <= l.paid_before ||
            e.installment_number! > l.total_installments),
      )
    )
      throw new Error(
        "Ajuste as parcelas registradas antes de alterar o histórico.",
      );
  }
  for (const a of data.accounts) {
    if (a.opening_date > asOf)
      throw new Error("A abertura da conta não pode ser futura.");
    const value = balance(a, data.transactions, asOf);
    if ((a.kind === "benefit" || a.kind === "investment") && value < 0)
      throw new Error("Benefício ou investimento sem saldo suficiente.");
    const overdraftLimit =
      a.kind === "checking" ? Math.max(0, a.overdraft_cents ?? 0) : 0;
    if (overdraftLimit > 0 && value < -overdraftLimit)
      throw new Error(
        "Saldo insuficiente: o lançamento ultrapassa o saldo e o limite do cheque especial desta conta.",
      );
    if (reserved(a.id, data.contributions) > Math.max(0, value))
      throw new Error("Saldo insuficiente: ajuste as reservas das metas.");
  }
  for (const g of data.goals)
    if (goalFunded(g.id, data.contributions) > g.target_cents)
      throw new Error("Os aportes excedem o valor da meta.");
  for (const c of data.contributions) {
    const a = data.accounts.find((a) => a.id === c.account_id);
    if (
      !a ||
      a.kind === "benefit" ||
      !data.goals.some((g) => g.id === c.goal_id) ||
      c.date > asOf ||
      c.date < a.opening_date
    )
      throw new Error("Aporte exige conta, meta e data válidas.");
  }
  for (const i of data.investments)
    if (
      data.accounts.find((a) => a.id === i.account_id)?.kind !== "investment" ||
      data.investments.filter((x) => x.account_id === i.account_id).length > 1
    )
      throw new Error(
        "Use uma conta de investimento sem configuração existente.",
      );
  for (const e of data.transactions) {
    if (e.status === "cancelled") continue;
    const s = data.accounts.find((a) => a.id === e.source_account_id),
      t = data.accounts.find((a) => a.id === e.target_account_id);
    if ((e.source_account_id && !s) || (e.target_account_id && !t))
      throw new Error("Conta não encontrada.");
    if (
      (e.status === "posted" && e.date > asOf) ||
      (s && e.date < s.opening_date) ||
      (t && e.date < t.opening_date)
    )
      throw new Error(
        "Data inválida: realizado futuro ou movimento anterior à abertura.",
      );
    if (e.kind === "yield" && t?.kind !== "investment")
      throw new Error("Rendimento exige conta de investimento.");
    if (
      e.kind === "transfer" &&
      (s?.kind === "benefit") !== (t?.kind === "benefit")
    )
      throw new Error(
        "Benefícios não podem ser convertidos em dinheiro livre.",
      );
  }
}
export function mutateDemo(
  data: FinanceData,
  entity: Entity,
  method: "POST" | "PUT" | "DELETE",
  payload: Record<string, unknown>,
): FinanceData {
  const next = structuredClone(data);
  const id = typeof payload.id === "string" ? payload.id : crypto.randomUUID();
  if (entity === "loans" && !next.loans) next.loans = [];
  const rows = next[entity] as unknown as Record<string, unknown>[];
  const index = rows.findIndex((r) => r.id === id);
  if (method !== "POST" && index < 0)
    throw new Error("Registro não encontrado.");
  if (method === "DELETE") {
    if (
      entity === "accounts" &&
      (next.transactions.some(
        (e) => e.source_account_id === id || e.target_account_id === id,
      ) ||
        next.contributions.some((c) => c.account_id === id) ||
        (next.loans ?? []).some((l) => l.account_id === id) ||
        next.recurrences.some(
          (r) => r.source_account_id === id || r.target_account_id === id,
        ))
    )
      throw new Error("A conta possui vínculos. Remova-os antes de excluir.");
    if (entity === "accounts")
      next.investments = next.investments.filter((i) => i.account_id !== id);
    if (entity === "loans" && next.transactions.some((e) => e.loan_id === id))
      throw new Error(
        "O contrato possui pagamentos nos Lançamentos. Remova os vínculos antes de excluir.",
      );
    if (entity === "goals" && next.contributions.some((c) => c.goal_id === id))
      throw new Error("Remova os aportes vinculados antes de excluir.");
    if (
      entity === "goals" &&
      next.goals.some((g) => g.dependencies?.some((d) => d.goal_id === id))
    )
      throw new Error(
        "Remova esta meta das condições das outras metas antes de excluir.",
      );
    if (entity === "transactions" && rows[index].recurrence_id)
      rows[index].status = "cancelled";
    else rows.splice(index, 1);
    if (entity === "recurrences")
      next.transactions = next.transactions.map((e) =>
        e.recurrence_id === id
          ? { ...e, recurrence_id: null, occurrence_date: null }
          : e,
      );
  } else {
    const parsed = schemas[entity].safeParse(payload);
    if (!parsed.success) throw new Error(parsed.error.issues[0].message);
    const row = {
      ...(method === "POST"
        ? {
            created_at: new Date().toISOString(),
            source: "manual",
            external_id: null,
            import_batch_id: null,
            categorization_rule_id: null,
            recurrence_id: null,
            occurrence_date: null,
          }
        : rows[index]),
      ...parsed.data,
      ...(entity === "recurrences"
        ? {
            auto_from:
              method === "POST" ||
              (payload.auto_post === true && !rows[index]?.auto_post) ||
              (payload.active === true && !rows[index]?.active)
                ? today()
                : (rows[index].auto_from ?? today()),
          }
        : {}),
      id,
      user_id: DEMO_USER,
    };
    if (method === "POST") rows.push(row);
    else rows[index] = row;
  }
  validateDemo(next);
  return next;
}
export function generateDemo(data: FinanceData, from: string, until: string) {
  const next = structuredClone(data);
  let count = 0;
  for (const rule of next.recurrences.filter((r) => r.active))
    for (const date of recurrenceDates(
      rule.start_date,
      rule.frequency,
      from,
      until,
      rule.end_date,
    )) {
      const account = next.accounts.find(
        (a) => a.id === (rule.source_account_id ?? rule.target_account_id),
      );
      if (!account || date < account.opening_date) continue;
      if (
        next.transactions.some(
          (e) => e.recurrence_id === rule.id && e.occurrence_date === date,
        )
      )
        continue;
      const entry: Entry = {
        id: crypto.randomUUID(),
        user_id: DEMO_USER,
        kind: rule.kind,
        description: rule.description,
        amount_cents: rule.amount_cents,
        date,
        status: "planned",
        source_account_id: rule.source_account_id,
        target_account_id: rule.target_account_id,
        category: rule.category,
        recurrence_id: rule.id,
        occurrence_date: date,
        source: "recurrence",
        external_id: null,
        import_batch_id: null,
        categorization_rule_id: null,
        gross_cents: null,
        deductions_cents: null,
      };
      next.transactions.push(entry);
      count++;
    }
  for (const entry of next.transactions) {
    const rule = next.recurrences.find((r) => r.id === entry.recurrence_id);
    if (
      rule?.active &&
      rule.auto_post &&
      entry.status === "planned" &&
      entry.date <= today() &&
      entry.occurrence_date! >= (rule.auto_from ?? today())
    ) {
      entry.status = "posted";
      try {
        validateDemo(next);
      } catch {
        entry.status = "planned";
      }
    }
  }
  validateDemo(next);
  return { data: next, count };
}
export function updateDemoProfile(data: FinanceData, payload: unknown) {
  return {
    ...data,
    profile: {
      ...data.profile,
      ...profileSchema.parse(payload),
      user_id: DEMO_USER,
    },
  };
}

export function syncDemo(data: FinanceData) {
  const horizon = addMonths(today(), 1);
  const active = data.recurrences.filter((r) => r.active);
  if (!active.length) return data;
  let from = active.map((r) => r.start_date).sort()[0],
    next = data;
  while (from <= horizon) {
    const until = addMonths(from, 12) < horizon ? addMonths(from, 12) : horizon;
    next = generateDemo(next, from, until).data;
    if (until === horizon) break;
    from = until;
  }
  return next;
}
export function payLoanDemo(
  data: FinanceData,
  id: string,
  number: number,
  account: string,
  date: string,
  amount: number,
) {
  const next = structuredClone(data),
    loan = next.loans?.find((l) => l.id === id);
  if (
    !loan ||
    !Number.isInteger(number) ||
    number <= loan.paid_before ||
    number > loan.total_installments
  )
    throw new Error("Parcela inválida.");
  if (
    !next.accounts.some(
      (a) => a.id === account && ["cash", "checking"].includes(a.kind),
    )
  )
    throw new Error("Escolha uma conta em dinheiro.");
  const existing = next.transactions.find(
    (e) => e.loan_id === id && e.installment_number === number,
  );
  if (existing?.status === "posted") return next;
  if (existing) {
    existing.status = "posted";
    existing.date = date;
    existing.source_account_id = account;
    existing.amount_cents = amount;
  } else
    next.transactions.push({
      id: crypto.randomUUID(),
      user_id: DEMO_USER,
      kind: "expense",
      description: `${loan.name} · Parcela ${number}/${loan.total_installments}`,
      amount_cents: amount,
      date,
      status: "posted",
      source_account_id: account,
      target_account_id: null,
      category: "Empréstimos e financiamentos",
      gross_cents: null,
      deductions_cents: null,
      recurrence_id: null,
      occurrence_date: null,
      source: "manual",
      external_id: null,
      import_batch_id: null,
      categorization_rule_id: null,
      loan_id: id,
      installment_number: number,
    });
  validateDemo(next);
  return next;
}
