import type { Contribution, Goal } from "../types";

export function piggyBankTotalCents(maxNumber: number): number {
  const n = Math.max(1, Math.min(2000, Math.trunc(maxNumber)));
  return ((n * (n + 1)) / 2) * 100;
}

export function progressiveMonthlyTotalCents(
  firstMonthCents: number,
  monthlyIncrementCents: number,
  months: number,
): number {
  const m = Math.max(1, Math.min(600, Math.trunc(months)));
  const start = Math.max(0, Math.trunc(firstMonthCents));
  const step = Math.max(0, Math.trunc(monthlyIncrementCents));
  return m * start + ((m * (m - 1)) / 2) * step;
}

export function formatPiggyBankNote(numbers: number[]): string {
  const sorted = [...new Set(numbers.map((n) => Math.trunc(n)))]
    .filter((n) => n >= 1)
    .sort((a, b) => a - b);
  return `Cofrinho ${sorted.map((n) => `#${n}`).join(", ")}`;
}

export function extractMarkedNumbers(
  contributions: Contribution[],
  maxNumber = 500,
): Map<number, string> {
  const marked = new Map<number, string>();
  const limit = Math.max(1, Math.min(2000, Math.trunc(maxNumber)));
  for (const c of contributions) {
    const matches = c.note ? [...c.note.matchAll(/#(\d+)\b/g)] : [];
    if (matches.length > 0) {
      for (const m of matches) {
        const num = Number(m[1]);
        if (num >= 1 && num <= limit && !marked.has(num)) {
          marked.set(num, c.id);
        }
      }
    }
  }
  return marked;
}

export function hasExactPiggyBankTarget(targetCents: number): number | null {
  if (targetCents >= 300 && targetCents % 100 === 0) {
    const targetReais = targetCents / 100;
    const n = Math.round((-1 + Math.sqrt(1 + 8 * targetReais)) / 2);
    if (n >= 2 && n <= 2000 && (n * (n + 1)) / 2 === targetReais) {
      return n;
    }
  }
  return null;
}

export function inferPiggyBankSize(
  goal: Goal,
  contributions: Contribution[] = [],
): number {
  const nameMatch = goal.name.match(/1\s*a\s*(\d{1,4})/i);
  if (nameMatch) {
    const parsed = Number(nameMatch[1]);
    if (parsed >= 2 && parsed <= 2000) return parsed;
  }
  const exactFromTarget = hasExactPiggyBankTarget(goal.target_cents);
  if (exactFromTarget !== null) {
    return exactFromTarget;
  }
  let highestTag = 0;
  for (const c of contributions) {
    for (const m of (c.note ?? "").matchAll(/#(\d+)\b/g)) {
      const val = Number(m[1]);
      if (val > highestTag) highestTag = val;
    }
  }
  if (highestTag > 500) return Math.min(2000, highestTag);
  if (highestTag > 200) return 500;
  if (highestTag > 100) return 200;
  if (highestTag > 0) return 500;
  return 500;
}

export function isPiggyBankGoal(
  goal: Goal,
  contributions: Contribution[] = [],
): boolean {
  if (/cofrinho|desafio|cartela|1\s*a\s*\d+/i.test(goal.name)) return true;
  const exact = hasExactPiggyBankTarget(goal.target_cents);
  if (exact !== null && exact >= 10) {
    return true;
  }
  return contributions.some((c) => /#(\d+)\b/.test(c.note ?? ""));
}

