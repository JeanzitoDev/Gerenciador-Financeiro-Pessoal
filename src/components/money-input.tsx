"use client";
import { useLayoutEffect, useRef, type InputHTMLAttributes } from "react";
import { maskMoneyInput, finishMoneyInput } from "@/lib/finance/input";

type Props = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "type" | "inputMode"
> & {
  value: string;
  onValueChange: (value: string) => void;
};

export default function MoneyInput({
  value,
  onValueChange,
  onBlur,
  ...props
}: Props) {
  const input = useRef<HTMLInputElement>(null);
  const caret = useRef<number | null>(null);
  const displayed = maskMoneyInput(value);
  useLayoutEffect(() => {
    if (caret.current !== null && document.activeElement === input.current) {
      input.current?.setSelectionRange(caret.current, caret.current);
      caret.current = null;
    }
  }, [displayed]);
  return (
    <input
      {...props}
      ref={input}
      type="text"
      inputMode="decimal"
      value={displayed}
      placeholder={props.placeholder ?? "0,00"}
      onChange={(e) => {
        const raw = e.target.value;
        const next = maskMoneyInput(raw);
        const count = raw
          .slice(0, e.target.selectionStart ?? raw.length)
          .replace(/[^\d,-]/g, "").length;
        let position = 0,
          remaining = count;
        while (position < next.length && remaining > 0) {
          if (next[position] !== ".") remaining--;
          position++;
        }
        caret.current =
          e.target.selectionStart === raw.length ? next.length : position;
        onValueChange(next);
      }}
      onBlur={(e) => {
        onValueChange(finishMoneyInput(value));
        onBlur?.(e);
      }}
    />
  );
}
