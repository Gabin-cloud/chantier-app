import {
  validateEmail,
  validatePercent,
  validatePhone,
  validatePostalCode,
  validateRequired,
  validateSiret,
} from "@/lib/validation/fields";

export type FieldFormat =
  | "text"
  | "email"
  | "postal"
  | "phone"
  | "siret"
  | "number"
  | "money"
  | "percent";

export type FieldFormatConfig = {
  validate?: (value: string) => string | null;
  unit?: string;
  decimals: number;
  numeric: boolean;
};

export const FIELD_FORMATS: Record<FieldFormat, FieldFormatConfig> = {
  text: { decimals: 0, numeric: false },
  email: { validate: validateEmail, decimals: 0, numeric: false },
  postal: { validate: validatePostalCode, decimals: 0, numeric: false },
  phone: { validate: validatePhone, decimals: 0, numeric: false },
  siret: { validate: validateSiret, decimals: 0, numeric: false },
  number: { decimals: 0, numeric: true },
  money: { unit: "€", decimals: 2, numeric: true },
  percent: { validate: validatePercent, unit: "%", decimals: 2, numeric: true },
};

export function validateFieldValue(
  value: string,
  options: {
    format?: FieldFormat;
    required?: boolean;
    label?: string;
    validate?: (value: string) => string | null;
  }
): string | null {
  const trimmed = value.trim();
  if (options.required && !trimmed) {
    return options.label
      ? validateRequired(value, options.label)
      : "Ce champ est obligatoire.";
  }
  if (options.validate) return options.validate(value);
  if (options.format && options.format !== "text") {
    return FIELD_FORMATS[options.format].validate?.(value) ?? null;
  }
  return null;
}
