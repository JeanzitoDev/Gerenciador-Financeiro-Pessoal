export type AccountKind = "checking" | "cash" | "benefit" | "investment";
export type EntryKind = "income" | "expense" | "transfer" | "yield";
export type EntryStatus = "planned" | "posted" | "cancelled";
export interface Owned {
  id: string;
  user_id: string;
  created_at?: string;
}
export interface Account extends Owned {
  name: string;
  kind: AccountKind;
  opening_cents: number;
  opening_date: string;
}
export interface Entry extends Owned {
  kind: EntryKind;
  description: string;
  amount_cents: number;
  date: string;
  status: EntryStatus;
  source_account_id: string | null;
  target_account_id: string | null;
  category: string;
  gross_cents: number | null;
  deductions_cents: number | null;
  recurrence_id: string | null;
  occurrence_date: string | null;
  source: string;
  external_id: string | null;
  import_batch_id: string | null;
  categorization_rule_id: string | null;
}
export interface Goal extends Owned {
  name: string;
  target_cents: number;
  target_date: string;
  priority: number;
  monthly_budget_cents: number | null;
}
export interface Contribution extends Owned {
  goal_id: string;
  account_id: string;
  amount_cents: number;
  date: string;
  note: string;
}
export interface Investment extends Owned {
  account_id: string;
  name: string;
  annual_rate: number;
  inflation_rate: number;
}
export interface Recurrence extends Owned {
  kind: "income" | "expense";
  description: string;
  amount_cents: number;
  source_account_id: string | null;
  target_account_id: string | null;
  category: string;
  frequency: "monthly" | "weekly" | "yearly";
  start_date: string;
  end_date: string | null;
  active: boolean;
}
export interface Profile {
  user_id: string;
  display_name: string;
  theme: "light" | "dark" | "system";
  accent: "violet" | "emerald" | "blue" | "rose";
  background: "plain" | "gradient" | "dots";
}
export interface FinanceData {
  accounts: Account[];
  transactions: Entry[];
  goals: Goal[];
  contributions: Contribution[];
  investments: Investment[];
  recurrences: Recurrence[];
  profile: Profile;
}
export type Entity =
  | "accounts"
  | "transactions"
  | "goals"
  | "contributions"
  | "investments"
  | "recurrences";
