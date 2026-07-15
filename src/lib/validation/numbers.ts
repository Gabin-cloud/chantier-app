export function parseNumberInput(input: string): number {
  const cleaned = input
    .replace(/\s/g, "")
    .replace(/[^\d,.\-]/g, "")
    .replace(",", ".");
  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatNumberDisplay(value: number, decimals = 0): string {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatNumberInputString(value: string, decimals = 0): string {
  if (!value.trim()) return "";
  const parsed = parseNumberInput(value);
  return formatNumberDisplay(parsed, decimals);
}
