"use client";

import { useEffect, useId, useState } from "react";
import { financeInputClass } from "@/components/finance/FormField";
import {
  formatMoneyDisplay,
  parseMoneyInput,
} from "@/lib/finance/calculations";

type MoneyInputProps = {
  id?: string;
  name?: string;
  value?: number;
  defaultValue?: number;
  onChange?: (value: number) => void;
  required?: boolean;
  disabled?: boolean;
  className?: string;
};

export function MoneyInput({
  id,
  name,
  value,
  defaultValue = 0,
  onChange,
  required,
  disabled,
  className = "",
}: MoneyInputProps) {
  const hiddenId = useId();
  const isControlled = value !== undefined;
  const [internalValue, setInternalValue] = useState(
    isControlled ? value : defaultValue
  );
  const [display, setDisplay] = useState(
    formatMoneyDisplay(isControlled ? value : defaultValue)
  );
  const [focused, setFocused] = useState(false);

  const numericValue = isControlled ? value : internalValue;

  useEffect(() => {
    if (isControlled && !focused) {
      setDisplay(formatMoneyDisplay(value));
    }
  }, [value, focused, isControlled]);

  function commitValue(parsed: number) {
    if (!isControlled) setInternalValue(parsed);
    onChange?.(parsed);
  }

  return (
    <div className={`relative ${className}`}>
      {name && (
        <input
          type="hidden"
          id={hiddenId}
          name={name}
          value={numericValue}
          readOnly
        />
      )}
      <input
        id={id}
        type="text"
        inputMode="decimal"
        value={display}
        disabled={disabled}
        required={required}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          const parsed = parseMoneyInput(display);
          commitValue(parsed);
          setDisplay(formatMoneyDisplay(parsed));
        }}
        onChange={(e) => setDisplay(e.target.value)}
        className={`${financeInputClass} pr-10`}
      />
      <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-400">
        €
      </span>
    </div>
  );
}
