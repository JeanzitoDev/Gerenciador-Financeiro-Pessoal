"use client";
import { useId, useState } from "react";
import type { Entry } from "@/lib/types";
const defaults = [
  "Salário",
  "Alimentação",
  "Moradia",
  "Transporte",
  "Saúde",
  "Educação",
  "Lazer",
  "Assinaturas",
  "Compras",
  "Benefícios",
  "Investimentos",
  "Empréstimos e financiamentos",
  "Outros",
];
export default function CategoryInput({
  value,
  onChange,
  entries,
}: {
  value: string;
  onChange: (v: string) => void;
  entries: Entry[];
}) {
  const [open, setOpen] = useState(false),
    [active, setActive] = useState(0),
    id = useId();
  const counts = new Map<string, number>();
  entries.forEach((e) =>
    counts.set(e.category, (counts.get(e.category) || 0) + 1),
  );
  const list = [
    ...new Set([
      ...Array.from(counts)
        .sort((a, b) => b[1] - a[1])
        .map(([k]) => k),
      ...defaults,
    ]),
  ]
    .filter(
      (c) =>
        !value ||
        value === "Outros" ||
        c.toLocaleLowerCase("pt-BR").includes(value.toLocaleLowerCase("pt-BR")),
    )
    .slice(0, 8);
  const choose = (v: string) => {
    onChange(v);
    setOpen(false);
  };
  return (
    <label className="form-field">
      <span>Categoria</span>
      <div className="category-input">
        <input
          aria-label="Categoria"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open && !!list.length}
          aria-controls={`${id}-list`}
          aria-activedescendant={
            open && list.length
              ? `${id}-${Math.min(active, list.length - 1)}`
              : undefined
          }
          autoComplete="off"
          required
          maxLength={60}
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
            setActive(0);
          }}
          onFocus={() => {
            setOpen(true);
            setActive(0);
          }}
          onBlur={() => setOpen(false)}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              setOpen(true);
              setActive((n) =>
                Math.max(
                  0,
                  Math.min(
                    list.length - 1,
                    n + (e.key === "ArrowDown" ? 1 : -1),
                  ),
                ),
              );
            }
            if (e.key === "Enter" && open && list.length) {
              e.preventDefault();
              choose(list[Math.min(active, list.length - 1)]);
            }
            if (e.key === "Escape" && open) {
              e.preventDefault();
              e.stopPropagation();
              setOpen(false);
            }
          }}
        />
        {open && !!list.length && (
          <div
            className="select-options"
            id={`${id}-list`}
            role="listbox"
            aria-label="Sugestões de categoria"
          >
            {list.map((c, i) => (
              <button
                type="button"
                role="option"
                aria-selected={i === active}
                id={`${id}-${i}`}
                key={c}
                className={i === active ? "highlighted" : ""}
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(c);
                }}
              >
                {c}
              </button>
            ))}
          </div>
        )}
      </div>
      <small>Escolha uma sugestão ou escreva sua própria categoria.</small>
    </label>
  );
}
