"use client";

import { useEffect, useId, useState } from "react";
import {
  formatNumberDisplay,
  parseNumberInput,
} from "@/lib/validation/numbers";

type FormattedNumberInputProps = {
  value: string;
  onChange: (value: string) => void;
  unit?: string;
  decimals?: number;
  disabled?: boolean;
  className?: string;
  onBlur?: () => void;
};

export function FormattedNumberInput({
  value,
  onChange,
  unit,
  decimals = 0,
  disabled,
  className = "",
  onBlur,
}: FormattedNumberInputProps) {
  const inputId = useId();
  const numericValue = parseNumberInput(value);
  const [display, setDisplay] = useState(
    value.trim() ? formatNumberDisplay(numericValue, decimals) : ""
  );
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    if (!focused) {
      setDisplay(value.trim() ? formatNumberDisplay(parseNumberInput(value), decimals) : "");
    }
  }, [value, focused, decimals]);

  const unitPadding = unit ? "pr-12" : "";

  return (
    <div className="relative">
      <input
        id={inputId}
        type="text"
        inputMode="decimal"
        value={display}
        disabled={disabled}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          const parsed = parseNumberInput(display);
          const formatted = formatNumberDisplay(parsed, decimals);
          setDisplay(formatted);
          onChange(String(parsed));
          onBlur?.();
        }}
        onChange={(e) => setDisplay(e.target.value)}
        className={`${className} ${unitPadding}`}
      />
      {unit && (
        <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-400">
          {unit}
        </span>
      )}
    </div>
  );
}
