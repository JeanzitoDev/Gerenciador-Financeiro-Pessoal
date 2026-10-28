import type { Contribution, Goal } from "../types";
import { formatMoney, sumCents } from "./money";

export function goalBlockers(
  goal: Goal,
  goals: Goal[],
  contributions: Contribution[],
) {
  if (goal.completed) return [];
  return (goal.dependencies ?? []).flatMap((condition) => {
    const prerequisite = goals.find((g) => g.id === condition.goal_id);
    if (!prerequisite) return ["Confira uma meta que foi removida."];
    if (condition.minimum_cents === null)
      return prerequisite.completed ? [] : [`Concluir ${prerequisite.name}`];
    const missing = Math.max(
      0,
      condition.minimum_cents -
        sumCents(
          contributions
            .filter((c) => c.goal_id === prerequisite.id)
            .map((c) => c.amount_cents),
        ),
    );
    return missing
      ? [`Reservar mais ${formatMoney(missing)} em ${prerequisite.name}`]
      : [];
  });
}

/** Mirrors database graph rules for the offline demonstration. Never trusts UI ownership. */
export function validateGoalGraph(goals: Goal[]) {
  const visited = new Set<string>(),
    active = new Set<string>();
  function visit(goal: Goal) {
    if (active.has(goal.id))
      throw new Error(
        "Uma meta não pode depender dela mesma, nem formar um ciclo.",
      );
    if (visited.has(goal.id)) return;
    active.add(goal.id);
    const seen = new Set<string>();
    for (const dependency of goal.dependencies ?? []) {
      const parent = goals.find(
        (g) => g.id === dependency.goal_id && g.user_id === goal.user_id,
      );
      if (!parent)
        throw new Error("Escolha uma meta da sua conta como condição.");
      if (seen.has(parent.id))
        throw new Error("Use cada meta apenas uma vez nas condições.");
      seen.add(parent.id);
      if (
        dependency.minimum_cents !== null &&
        dependency.minimum_cents > parent.target_cents
      )
        throw new Error(
          "O valor da condição não pode passar do valor da meta escolhida.",
        );
      visit(parent);
    }
    active.delete(goal.id);
    visited.add(goal.id);
  }
  goals.forEach(visit);
}
