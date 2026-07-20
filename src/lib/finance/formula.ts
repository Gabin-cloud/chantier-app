/**
 * Évaluation sécurisée de formules type Excel (=1500+200, =MARCHE*0.5).
 * Supporte les opérateurs + - * / ( ) et la variable MARCHE (montant marché HT du lot).
 */

export type FormulaContext = {
  marketHt?: number;
};

function normalizeExpression(raw: string): string {
  let expr = raw.trim();
  if (expr.startsWith("=")) {
    expr = expr.slice(1).trim();
  }
  expr = expr.replace(/\s/g, "");
  expr = expr.replace(/(\d),(\d)/g, "$1.$2");
  return expr;
}

function replaceMarketToken(expr: string, marketHt: number): string {
  return expr.replace(/\bMARCHE\b/gi, String(marketHt));
}

function isSafeExpression(expr: string): boolean {
  return /^[\d+\-*/().]+$/.test(expr);
}

export function evaluateFormula(
  raw: string | null | undefined,
  context: FormulaContext = {}
): number | null {
  if (!raw?.trim()) return null;

  let expr = normalizeExpression(raw);

  if (/\bMARCHE\b/i.test(expr)) {
    const marketHt = context.marketHt ?? 0;
    expr = replaceMarketToken(expr, marketHt);
  }

  if (!isSafeExpression(expr)) return null;

  try {
    const result = Function(`"use strict"; return (${expr})`)() as unknown;
    if (typeof result !== "number" || !Number.isFinite(result)) return null;
    return Math.round(result * 100) / 100;
  } catch {
    return null;
  }
}

export function isFormula(raw: string | null | undefined): boolean {
  return Boolean(raw?.trim().startsWith("="));
}
