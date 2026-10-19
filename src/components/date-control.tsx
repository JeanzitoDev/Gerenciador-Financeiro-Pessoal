"use client";
import { useEffect, useId, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { today, validDate, addMonths, monthLabel } from "@/lib/finance/dates";
import useCalendarPosition from "./use-calendar-position";
import SelectControl from "./select-control";
export default function DateControl({
  value,
  onChange,
  label,
  min = "2000-01-01",
  max = "2100-12-31",
  required = true,
}: {
  value: string;
  onChange: (v: string) => void;
  label: string;
  min?: string;
  max?: string;
  required?: boolean;
}) {
  const id = useId(),
    ref = useRef<HTMLDivElement>(null),
    popup = useRef<HTMLDivElement>(null),
    trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false),
    [month, setMonth] = useState((value || today()).slice(0, 7)),
    [text, setText] = useState(
      value ? value.split("-").reverse().join("/") : "",
    );
  const position = useCalendarPosition(open, ref, popup);
  useEffect(() => {
    if (value) setText(value.split("-").reverse().join("/"));
  }, [value]);
  useEffect(() => {
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  const first = new Date(`${month}-01T12:00:00Z`),
    offset = (first.getUTCDay() + 6) % 7;
  const count = new Date(
    Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 0),
  ).getUTCDate();
  function choose(v: string) {
    onChange(v);
    setText(v.split("-").reverse().join("/"));
    setOpen(false);
    trigger.current?.focus();
  }
  return (
    <div
      className="date-control"
      ref={ref}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.preventDefault();
          e.stopPropagation();
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      <div className="date-input-wrap">
        <input
          aria-label={label}
          inputMode="numeric"
          placeholder="dd/mm/aaaa"
          value={text}
          required={required}
          maxLength={10}
          pattern="[0-9]{2}/[0-9]{2}/[0-9]{4}"
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, "").slice(0, 8);
            const t =
              digits.length > 4
                ? `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
                : digits.length > 2
                  ? `${digits.slice(0, 2)}/${digits.slice(2)}`
                  : digits;
            setText(t);
            const iso = t.split("/").reverse().join("-");
            if (validDate(iso) && iso >= min && iso <= max) onChange(iso);
            else onChange("");
          }}
        />
        <button
          type="button"
          className="icon-button"
          ref={trigger}
          aria-label={`Abrir calendário: ${label}`}
          aria-expanded={open}
          aria-controls={`${id}-calendar`}
          onClick={() => {
            if (!open) {
              setMonth((value || today()).slice(0, 7));
            }
            setOpen(!open);
          }}
        >
          <CalendarDays size={18} />
        </button>
      </div>
      {open && (
        <div
          className="calendar-popover"
          ref={popup}
          style={position}
          id={`${id}-calendar`}
          role="group"
          aria-label={`Calendário: ${label}`}
        >
          <div className="calendar-heading">
            <button
              type="button"
              className="icon-button"
              aria-label="Mês anterior no calendário"
              disabled={month <= min.slice(0, 7)}
              onClick={() => setMonth(addMonths(`${month}-01`, -1).slice(0, 7))}
            >
              <ChevronLeft size={17} />
            </button>
            <SelectControl
              label="Mês do calendário"
              allowEmpty={false}
              value={month.slice(5)}
              onChange={(v) => setMonth(`${month.slice(0, 4)}-${v}`)}
              options={Array.from({ length: 12 }, (_, i) =>
                String(i + 1).padStart(2, "0"),
              ).map((m) => [m, monthLabel(`2026-${m}`).split(" ")[0]])}
            />
            <SelectControl
              label="Ano do calendário"
              allowEmpty={false}
              value={month.slice(0, 4)}
              onChange={(v) => setMonth(`${v}-${month.slice(5)}`)}
              options={Array.from(
                {
                  length: Number(max.slice(0, 4)) - Number(min.slice(0, 4)) + 1,
                },
                (_, i) => Number(min.slice(0, 4)) + i,
              ).map((y) => [String(y), String(y)])}
            />
            <button
              type="button"
              className="icon-button"
              aria-label="Próximo mês no calendário"
              disabled={month >= max.slice(0, 7)}
              onClick={() => setMonth(addMonths(`${month}-01`, 1).slice(0, 7))}
            >
              <ChevronRight size={17} />
            </button>
          </div>
          <div className="calendar-week" aria-hidden="true">
            {["S", "T", "Q", "Q", "S", "S", "D"].map((d, i) => (
              <span key={i}>{d}</span>
            ))}
          </div>
          <div className="calendar-grid">
            {Array.from({ length: offset }, (_, i) => (
              <span key={`blank${i}`} />
            ))}
            {Array.from({ length: count }, (_, i) => {
              const date = `${month}-${String(i + 1).padStart(2, "0")}`;
              return (
                <button
                  type="button"
                  key={date}
                  aria-label={date.split("-").reverse().join("/")}
                  aria-pressed={value === date}
                  className={`${value === date ? "selected" : ""} ${date === today() ? "is-today" : ""}`}
                  disabled={date < min || date > max}
                  onClick={() => choose(date)}
                  onKeyDown={(e) => {
                    const step = (
                      {
                        ArrowLeft: -1,
                        ArrowRight: 1,
                        ArrowUp: -7,
                        ArrowDown: 7,
                      } as Record<string, number>
                    )[e.key];
                    if (step) {
                      e.preventDefault();
                      const buttons = Array.from(
                        ref.current!.querySelectorAll<HTMLButtonElement>(
                          ".calendar-grid button",
                        ),
                      );
                      buttons[
                        Math.max(0, Math.min(buttons.length - 1, i + step))
                      ]?.focus();
                    }
                  }}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
          <div className="calendar-foot">
            <button
              type="button"
              className="text-button"
              disabled={today() < min || today() > max}
              onClick={() => choose(today())}
            >
              Hoje
            </button>
            {!required && (
              <button
                type="button"
                className="text-button"
                onClick={() => {
                  onChange("");
                  setText("");
                  setOpen(false);
                }}
              >
                Limpar
              </button>
            )}
            <button
              type="button"
              className="text-button"
              onClick={() => {
                setOpen(false);
                trigger.current?.focus();
              }}
            >
              Fechar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
export function MonthControl({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false),
    [year, setYear] = useState(Number(value.slice(0, 4))),
    ref = useRef<HTMLDivElement>(null),
    popup = useRef<HTMLDivElement>(null);
  const id = useId();
  const position = useCalendarPosition(open, ref, popup, "right");
  useEffect(() => {
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  return (
    <div
      className="month-control"
      ref={ref}
      onBlur={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget)) setOpen(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape" && open) {
          e.preventDefault();
          e.stopPropagation();
          setOpen(false);
          trigger.current?.focus();
        }
      }}
    >
      <button
        type="button"
        aria-label="Mês anterior"
        onClick={() => onChange(addMonths(`${value}-01`, -1).slice(0, 7))}
      >
        <ChevronLeft size={17} />
      </button>
      <button
        type="button"
        className="month-label"
        ref={trigger}
        aria-label="Escolher mês"
        aria-expanded={open}
        aria-controls={`${id}-months`}
        onClick={() => {
          setYear(Number(value.slice(0, 4)));
          setOpen(!open);
        }}
      >
        {monthLabel(value)}
        <CalendarDays size={16} />
      </button>
      <button
        type="button"
        aria-label="Próximo mês"
        onClick={() => onChange(addMonths(`${value}-01`, 1).slice(0, 7))}
      >
        <ChevronRight size={17} />
      </button>
      {open && (
        <div
          className="calendar-popover month-popover"
          ref={popup}
          id={`${id}-months`}
          role="group"
          aria-label="Escolher mês e ano"
          style={position}
        >
          <div className="calendar-heading">
            <button
              type="button"
              className="icon-button"
              aria-label="Ano anterior"
              disabled={year <= 2000}
              onClick={() => setYear(year - 1)}
            >
              <ChevronLeft size={17} />
            </button>
            <strong>{year}</strong>
            <button
              type="button"
              className="icon-button"
              aria-label="Próximo ano"
              disabled={year >= 2100}
              onClick={() => setYear(year + 1)}
            >
              <ChevronRight size={17} />
            </button>
          </div>
          <div className="months-grid">
            {Array.from(
              { length: 12 },
              (_, i) => `${year}-${String(i + 1).padStart(2, "0")}`,
            ).map((m) => (
              <button
                type="button"
                key={m}
                aria-label={monthLabel(m)}
                aria-pressed={m === value}
                className={m === value ? "selected" : ""}
                onClick={() => {
                  onChange(m);
                  setOpen(false);
                  trigger.current?.focus();
                }}
              >
                {monthLabel(m).split(" ")[0].slice(0, 3)}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
