/** Violet : champ modifié non enregistré. */
export const DANOBAT_DIRTY_TEXT = "text-[#7c3aed]";
/** Texte enregistré / à jour. */
export const SAVED_TEXT = "text-slate-900";

export function dirtyTextClass(current: string, saved: string, disabled?: boolean) {
  if (disabled) return "text-slate-400";
  const norm = (v: string) => v.trim();
  return norm(current) !== norm(saved) ? DANOBAT_DIRTY_TEXT : SAVED_TEXT;
}

export function validateEmail(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
    return "Adresse e-mail invalide.";
  }
  return null;
}

export function validatePostalCode(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  if (!/^\d{5}$/.test(v)) {
    return "Code postal invalide (5 chiffres).";
  }
  return null;
}

export function validatePhone(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  const digits = v.replace(/[\s.\-()]/g, "");
  if (!/^\+?\d{9,15}$/.test(digits)) {
    return "Numéro de téléphone invalide.";
  }
  return null;
}

export function validateSiret(value: string): string | null {
  const v = value.replace(/\s/g, "");
  if (!v) return null;
  if (!/^\d{14}$/.test(v)) {
    return "SIRET invalide (14 chiffres).";
  }
  return null;
}

export function validatePercent(value: string): string | null {
  const v = value.trim();
  if (!v) return null;
  const n = Number(v);
  if (Number.isNaN(n) || n < 0 || n > 100) {
    return "Pourcentage invalide (0 à 100).";
  }
  return null;
}

export function validateRequired(value: string, label: string): string | null {
  if (!value.trim()) return `${label} est obligatoire.`;
  return null;
}
