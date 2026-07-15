"use client";

import { AppField } from "@/components/ui/AppField";
import { appFieldClass } from "@/components/ui/app-field-styles";

type MoneyInputProps = {
  id?: string;
  name?: string;
  value?: number;
  defaultValue?: number;
  onChange?: (value: number) => void;
  savedValue?: number;
  required?: boolean;
  disabled?: boolean;
  className?: string;
};

function toMoneyString(value: number | undefined) {
  return value === undefined ? "" : String(value);
}

export function MoneyInput({
  id,
  name,
  value,
  defaultValue = 0,
  onChange,
  savedValue,
  required,
  disabled,
  className = "",
}: MoneyInputProps) {
  const isControlled = value !== undefined;
  const numericValue = isControlled ? value : defaultValue;

  return (
    <AppField
      id={id}
      name={name}
      format="money"
      value={isControlled ? toMoneyString(value) : undefined}
      defaultValue={toMoneyString(defaultValue)}
      savedValue={savedValue !== undefined ? toMoneyString(savedValue) : undefined}
      onChange={(next) => onChange?.(Number(next) || 0)}
      required={required}
      disabled={disabled}
      className={className}
      inputClassName={appFieldClass}
    />
  );
}
