"use client";

import { useEffect, useId, useRef, useState } from "react";
import {
  appFieldClass,
  appFieldInvalidClass,
  appFieldUnitClass,
} from "@/components/ui/app-field-styles";
import { dirtyTextClass, dirtyNumericTextClass, SAVED_TEXT } from "@/lib/validation/fields";
import {
  FIELD_FORMATS,
  validateFieldValue,
  type FieldFormat,
} from "@/lib/validation/field-formats";
import { formatNumberDisplay, parseNumberInput } from "@/lib/validation/numbers";

export type AppFieldProps = {
  id?: string;
  name?: string;
  value?: string;
  onChange?: (value: string) => void;
  defaultValue?: string;
  savedValue?: string;
  format?: FieldFormat;
  unit?: string;
  decimals?: number;
  validate?: (value: string) => string | null;
  required?: boolean;
  disabled?: boolean;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  className?: string;
  inputClassName?: string;
  label?: string;
  onBlur?: () => void;
};

function normalizeBaseline(...values: Array<string | undefined>) {
  return (values.find((v) => v !== undefined) ?? "").trim();
}

export function AppField({
  id,
  name,
  value: controlledValue,
  onChange,
  defaultValue = "",
  savedValue,
  format = "text",
  unit,
  decimals,
  validate,
  required,
  disabled,
  placeholder,
  multiline = false,
  rows = 3,
  className = "",
  inputClassName,
  onBlur,
}: AppFieldProps) {
  const autoId = useId();
  const fieldId = id ?? autoId;
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const hiddenId = useId();
  const isControlled = controlledValue !== undefined;

  const formatConfig = FIELD_FORMATS[format];
  const isNumeric = formatConfig.numeric;
  const resolvedDecimals = decimals ?? formatConfig.decimals;
  const resolvedUnit = unit ?? formatConfig.unit;

  const baseline = normalizeBaseline(savedValue, defaultValue);

  const [internalValue, setInternalValue] = useState(
    isControlled ? controlledValue : defaultValue
  );
  const [display, setDisplay] = useState(() => {
    const raw = isControlled ? controlledValue : defaultValue;
    if (!isNumeric || !raw.trim()) return raw;
    return formatNumberDisplay(parseNumberInput(raw), resolvedDecimals);
  });
  const [focused, setFocused] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentValue = isControlled ? controlledValue : internalValue;

  useEffect(() => {
    if (!isControlled) {
      setInternalValue(defaultValue);
    }
  }, [defaultValue, isControlled]);

  useEffect(() => {
    if (focused || !isNumeric) return;
    setDisplay(
      currentValue.trim()
        ? formatNumberDisplay(parseNumberInput(currentValue), resolvedDecimals)
        : ""
    );
  }, [currentValue, focused, isNumeric, resolvedDecimals]);

  function commitValue(next: string, nextDisplay?: string) {
    if (!isControlled) setInternalValue(next);
    onChange?.(next);
    if (isNumeric) {
      setDisplay(
        nextDisplay ??
          (next.trim()
            ? formatNumberDisplay(parseNumberInput(next), resolvedDecimals)
            : "")
      );
    }
  }

  function runValidation(value: string) {
    return validateFieldValue(value, {
      format,
      required,
      validate,
    });
  }

  function syncValidity(nextError: string | null) {
    const el = inputRef.current;
    if (el && "setCustomValidity" in el) {
      el.setCustomValidity(nextError ?? "");
    }
  }

  function handleBlur() {
    setFocused(false);
    let nextValue = currentValue;

    if (isNumeric) {
      const parsed = parseNumberInput(display);
      nextValue = String(parsed);
      const formatted = formatNumberDisplay(parsed, resolvedDecimals);
      setDisplay(formatted);
      commitValue(nextValue, formatted);
    }

    const nextError = runValidation(isNumeric ? nextValue : currentValue);
    setError(nextError);
    syncValidity(nextError);
    onBlur?.();
  }

  function handleChange(raw: string) {
    if (isNumeric) {
      setDisplay(raw);
      return;
    }
    const nextError = runValidation(raw);
    setError(nextError);
    syncValidity(nextError);
    commitValue(raw);
  }

  const dirtyClass =
    savedValue !== undefined || defaultValue !== undefined
      ? isNumeric
        ? dirtyNumericTextClass(currentValue, baseline, disabled)
        : dirtyTextClass(currentValue, baseline, disabled)
      : SAVED_TEXT;

  const fieldClass = [
    inputClassName ?? appFieldClass,
    dirtyClass,
    error ? appFieldInvalidClass : "",
    resolvedUnit && !multiline ? "pr-10" : "",
  ]
    .filter(Boolean)
    .join(" ");

  const hiddenValue = isNumeric ? String(parseNumberInput(currentValue)) : currentValue;

  const fieldElement = multiline ? (
    <textarea
      ref={inputRef as React.RefObject<HTMLTextAreaElement>}
      id={fieldId}
      rows={rows}
      value={isNumeric ? display : currentValue}
      placeholder={placeholder}
      disabled={disabled}
      required={required}
      aria-invalid={!!error}
      onFocus={() => setFocused(true)}
      onBlur={handleBlur}
      onChange={(e) => handleChange(e.target.value)}
      className={`${fieldClass} resize-none`}
    />
  ) : (
    <input
      ref={inputRef as React.RefObject<HTMLInputElement>}
      id={fieldId}
      type={format === "email" ? "email" : "text"}
      inputMode={
        isNumeric ? "decimal" : format === "phone" ? "tel" : undefined
      }
      value={isNumeric ? display : currentValue}
      placeholder={placeholder}
      disabled={disabled}
      required={required}
      aria-invalid={!!error}
      onFocus={() => setFocused(true)}
      onBlur={handleBlur}
      onChange={(e) => handleChange(e.target.value)}
      className={fieldClass}
    />
  );

  return (
    <div className={className}>
      {name && (
        <input
          type="hidden"
          id={hiddenId}
          name={name}
          value={hiddenValue}
          readOnly
        />
      )}
      <div className="relative">
        {fieldElement}
        {resolvedUnit && !multiline && (
          <span className={appFieldUnitClass}>{resolvedUnit}</span>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
