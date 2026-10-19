"use client";
import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import useCalendarPosition from "./use-calendar-position";
export default function SelectControl({
  value,
  onChange,
  options,
  label,
  name,
  disabled = false,
  allowEmpty = true,
  swatches,
}: {
  value: string;
  onChange: (v: string) => void;
  options: string[][];
  label: string;
  name?: string;
  disabled?: boolean;
  allowEmpty?: boolean;
  swatches?: Record<string, string>;
}) {
  const [open, setOpen] = useState(false),
    [active, setActive] = useState(0);
  const id = useId(),
    ref = useRef<HTMLDivElement>(null),
    popup = useRef<HTMLDivElement>(null),
    button = useRef<HTMLButtonElement>(null);
  const all = allowEmpty ? [["", "Selecione"], ...options] : options;
  const position = useCalendarPosition(open, ref, popup, "left", "anchor", 240);
  useEffect(() => {
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  useEffect(() => {
    if (open)
      document
        .getElementById(`${id}-${active}`)
        ?.scrollIntoView?.({ block: "nearest" });
  }, [active, open, id]);
  function show() {
    setActive(
      Math.max(
        0,
        all.findIndex((o) => o[0] === value),
      ),
    );
    setOpen(true);
  }
  function choose(i: number) {
    onChange(all[i][0]);
    setOpen(false);
    button.current?.focus();
  }
  return (
    <div
      className="select-control"
      ref={ref}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
    >
      {name && <input type="hidden" name={name} value={value} />}
      <button
        type="button"
        className="select-trigger"
        ref={button}
        role="combobox"
        aria-label={label}
        aria-controls={`${id}-list`}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-activedescendant={open ? `${id}-${active}` : undefined}
        disabled={disabled}
        onClick={() => (open ? setOpen(false) : show())}
        onKeyDown={(e) => {
          if (e.key === "Escape" && open) {
            e.preventDefault();
            e.stopPropagation();
            setOpen(false);
          }
          if (["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) {
            e.preventDefault();
            if (!open) show();
            else
              setActive((n) =>
                e.key === "Home"
                  ? 0
                  : e.key === "End"
                    ? all.length - 1
                    : Math.max(
                        0,
                        Math.min(
                          all.length - 1,
                          n + (e.key === "ArrowDown" ? 1 : -1),
                        ),
                      ),
              );
          }
          if (open && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            choose(active);
          }
          if (e.key === "Tab") setOpen(false);
        }}
      >
        <span className="select-value">
          {swatches?.[value] && (
            <i
              className="select-swatch"
              style={{ background: swatches[value] }}
              aria-hidden="true"
            />
          )}
          {options.find((o) => o[0] === value)?.[1] ?? "Selecione"}
        </span>
        <ChevronDown size={17} />
      </button>
      {open && (
        <div
          className="select-options"
          style={position}
          ref={popup}
          role="listbox"
          id={`${id}-list`}
          aria-label={label}
        >
          {all.map(([key, text], i) => (
            <button
              type="button"
              tabIndex={-1}
              role="option"
              id={`${id}-${i}`}
              key={key}
              aria-selected={key === value}
              className={active === i ? "highlighted" : ""}
              onMouseEnter={() => setActive(i)}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => choose(i)}
            >
              <span className="select-value">
                {swatches?.[key] && (
                  <i
                    className="select-swatch"
                    style={{ background: swatches[key] }}
                    aria-hidden="true"
                  />
                )}
                {text}
              </span>
              {key === value && <Check size={15} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
