"use client";
import type { Goal, GoalDependency } from "@/lib/types";
import { Plus, X } from "lucide-react";
import SelectControl from "./select-control";
import MoneyInput from "./money-input";
import { moneyInput, parseMoney } from "@/lib/finance/money";
export type DraftCondition = { goal_id: string; mode: string; amount: string };
export function draftConditions(
  conditions: GoalDependency[] = [],
): DraftCondition[] {
  return conditions.map((c) => ({
    goal_id: c.goal_id,
    mode: c.minimum_cents === null ? "completed" : "amount",
    amount: c.minimum_cents === null ? "" : moneyInput(c.minimum_cents),
  }));
}
export function parseConditions(
  conditions: DraftCondition[],
): GoalDependency[] {
  return conditions.map((c) => {
    if (!c.goal_id)
      throw new Error(
        "Escolha a meta de cada condição ou remova a linha vazia.",
      );
    return {
      goal_id: c.goal_id,
      minimum_cents: c.mode === "completed" ? null : parseMoney(c.amount),
    };
  });
}
export default function GoalConditions({
  goals,
  goalId,
  value,
  onChange,
}: {
  goals: Goal[];
  goalId?: string;
  value: DraftCondition[];
  onChange: (value: DraftCondition[]) => void;
}) {
  const choices = goals.filter((g) => g.id !== goalId);
  const update = (index: number, changes: Partial<DraftCondition>) =>
    onChange(value.map((c, i) => (i === index ? { ...c, ...changes } : c)));
  return (
    <fieldset className="goal-conditions">
      <legend>O que vem antes desta meta? (opcional)</legend>
      <p className="form-help">
        No Planejamento, esta meta recebe sugestões de aporte depois que todas
        as condições forem atendidas.
      </p>
      {value.map((condition, index) => (
        <div className="condition-row" key={index}>
          <div className="form-field">
            <span>Meta da condição {index + 1}</span>
            <SelectControl
              label={`Meta da condição ${index + 1}`}
              value={condition.goal_id}
              onChange={(v) => update(index, { goal_id: v })}
              options={choices
                .filter(
                  (g) =>
                    g.id === condition.goal_id ||
                    !value.some((c) => c.goal_id === g.id),
                )
                .map((g) => [g.id, g.name])}
            />
          </div>
          <div className="form-field">
            <span>Esperar até</span>
            <SelectControl
              label={`Condição ${index + 1}`}
              allowEmpty={false}
              value={condition.mode}
              onChange={(v) => update(index, { mode: v })}
              options={[
                ["completed", "A meta ser concluída"],
                ["amount", "Ter um valor reservado"],
              ]}
            />
          </div>
          {condition.mode === "amount" && (
            <label className="form-field">
              <span>Valor mínimo reservado (R$)</span>
              <MoneyInput
                aria-label={`Valor da condição ${index + 1} (R$)`}
                value={condition.amount}
                onValueChange={(v) => update(index, { amount: v })}
                required
              />
            </label>
          )}
          <button
            type="button"
            className="icon-button"
            aria-label={`Remover condição ${index + 1}`}
            onClick={() => onChange(value.filter((_, i) => i !== index))}
          >
            <X size={18} />
          </button>
        </div>
      ))}
      <button
        type="button"
        className="button secondary"
        disabled={
          !choices.length || value.length >= Math.min(choices.length, 20)
        }
        onClick={() =>
          onChange([...value, { goal_id: "", mode: "completed", amount: "" }])
        }
      >
        <Plus size={16} />
        Adicionar condição
      </button>
      {!choices.length && (
        <p className="small-note">Crie outra meta para usá-la como condição.</p>
      )}
    </fieldset>
  );
}
