export type QuoteCategoryFlags = {
  is_cie: boolean;
  is_ts: boolean;
  is_tma: boolean;
};

export function normalizeQuoteCategory(flags: QuoteCategoryFlags): QuoteCategoryFlags {
  const count = Number(flags.is_cie) + Number(flags.is_ts) + Number(flags.is_tma);
  if (count <= 1) return flags;

  if (flags.is_ts) return { is_cie: false, is_ts: true, is_tma: false };
  if (flags.is_tma) return { is_cie: false, is_ts: false, is_tma: true };
  return { is_cie: true, is_ts: false, is_tma: false };
}

export function validateQuoteCategory(flags: QuoteCategoryFlags): string | null {
  const count = Number(flags.is_cie) + Number(flags.is_ts) + Number(flags.is_tma);
  if (count > 1) {
    return "Un devis ne peut être que CIE, TS ou TMA (une seule catégorie).";
  }
  return null;
}
