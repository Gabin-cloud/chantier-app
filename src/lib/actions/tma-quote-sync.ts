import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

type SupabaseClient = Awaited<ReturnType<typeof createClient>>;

const TMA_TO_QUOTE_FIELD: Record<string, string> = {
  devis_number: "quote_number",
  devis_recu_le: "quote_date",
  mou_envoi: "mou_sent_at",
  mou_acceptation: "mou_return_at",
};

const QUOTE_TO_TMA_FIELD: Record<string, string> = {
  quote_number: "devis_number",
  quote_date: "devis_recu_le",
  mou_sent_at: "mou_envoi",
  mou_return_at: "mou_acceptation",
};

export function revalidateTmaAndQuotes(projectId: string) {
  revalidatePath(`/pc/projets/${projectId}/suivi-travaux/tma`);
  revalidatePath(`/pc/projets/${projectId}/suivi-financier/suivi-devis`);
}

/** Recalcule le montant H.T. du devis à partir des lignes TMA liées. */
export async function syncQuoteAmountFromTmaEntries(
  projectId: string,
  quoteId: string,
  supabase?: SupabaseClient
): Promise<void> {
  const sb = supabase ?? (await createClient());

  const { data: entries } = await sb
    .from("work_tma_entries")
    .select("montant_ht")
    .eq("project_id", projectId)
    .eq("quote_id", quoteId)
    .neq("status", "to_analyze");

  const total = (entries ?? []).reduce((sum, row) => sum + Number(row.montant_ht ?? 0), 0);

  await sb
    .from("financial_quotes")
    .update({ amount_ht: total })
    .eq("id", quoteId)
    .eq("project_id", projectId);
}

/** Propage un champ devis → lignes TMA liées (y compris dépôts en attente). */
export async function syncTmaEntriesFromQuoteField(
  projectId: string,
  quoteId: string,
  quoteField: string,
  value: unknown,
  supabase?: SupabaseClient
): Promise<void> {
  const tmaField = QUOTE_TO_TMA_FIELD[quoteField];
  if (!tmaField) return;

  const sb = supabase ?? (await createClient());

  await sb
    .from("work_tma_entries")
    .update({ [tmaField]: value })
    .eq("project_id", projectId)
    .eq("quote_id", quoteId);
}

/** Propage un champ TMA → devis lié. */
export async function syncQuoteFieldFromTmaEntry(
  projectId: string,
  entryId: string,
  tmaField: string,
  value: unknown,
  supabase?: SupabaseClient
): Promise<void> {
  const quoteField = TMA_TO_QUOTE_FIELD[tmaField];
  const sb = supabase ?? (await createClient());

  const { data: entry } = await sb
    .from("work_tma_entries")
    .select("quote_id, enterprise_id, logement_number, devis_number, devis_recu_le, deposit_file_path, deposit_file_name, enterprise_name")
    .eq("id", entryId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (!entry) return;

  let quoteId = entry.quote_id as string | null;

  if (!quoteId && entry.enterprise_id) {
    quoteId = await ensureFinancialQuoteForTmaEntry(projectId, entryId, sb);
  }

  if (!quoteId) return;

  if (quoteField) {
    await sb
      .from("financial_quotes")
      .update({ [quoteField]: value })
      .eq("id", quoteId)
      .eq("project_id", projectId);
  }

  if (tmaField === "montant_ht") {
    await syncQuoteAmountFromTmaEntries(projectId, quoteId, sb);
  }
}

/** Synchronise devis ↔ TMA après validation d'analyse. */
export async function syncQuoteAfterTmaAnalysis(
  projectId: string,
  quoteId: string | null,
  devisFields: {
    devis_number?: string;
    devis_recu_le?: string | null;
    deposit_file_path?: string | null;
    deposit_file_name?: string | null;
  },
  supabase?: SupabaseClient
): Promise<void> {
  if (!quoteId) return;

  const sb = supabase ?? (await createClient());

  const quoteUpdate: Record<string, unknown> = {
    is_tma: true,
    is_cie: false,
    is_ts: false,
  };

  if (devisFields.devis_number) quoteUpdate.quote_number = devisFields.devis_number;
  if (devisFields.devis_recu_le) quoteUpdate.quote_date = devisFields.devis_recu_le;
  if (devisFields.deposit_file_path) quoteUpdate.file_path = devisFields.deposit_file_path;
  if (devisFields.deposit_file_name) quoteUpdate.file_name = devisFields.deposit_file_name;

  await sb
    .from("financial_quotes")
    .update(quoteUpdate)
    .eq("id", quoteId)
    .eq("project_id", projectId);

  await syncQuoteAmountFromTmaEntries(projectId, quoteId, sb);
}

/** Propage le montant saisi dans le suivi devis vers les lignes TMA liées. */
export async function syncTmaAmountFromQuote(
  projectId: string,
  quoteId: string,
  amountHt: number,
  supabase?: SupabaseClient
): Promise<void> {
  const sb = supabase ?? (await createClient());

  const { data: entries } = await sb
    .from("work_tma_entries")
    .select("id, montant_ht")
    .eq("project_id", projectId)
    .eq("quote_id", quoteId)
    .neq("status", "to_analyze")
    .order("sort_order", { ascending: true });

  const linked = entries ?? [];
  if (linked.length === 0) return;

  if (linked.length === 1) {
    await sb
      .from("work_tma_entries")
      .update({ montant_ht: amountHt })
      .eq("id", linked[0].id);
    return;
  }

  const otherTotal = linked
    .slice(1)
    .reduce((sum, row) => sum + Number(row.montant_ht ?? 0), 0);
  const firstAmount = Math.max(0, amountHt - otherTotal);

  await sb
    .from("work_tma_entries")
    .update({ montant_ht: firstAmount })
    .eq("id", linked[0].id);
}

/** Crée un devis financier TMA si la ligne n'en a pas encore. */
export async function ensureFinancialQuoteForTmaEntry(
  projectId: string,
  entryId: string,
  supabase?: SupabaseClient
): Promise<string | null> {
  const sb = supabase ?? (await createClient());

  const { data: entry } = await sb
    .from("work_tma_entries")
    .select(
      "quote_id, enterprise_id, logement_number, devis_number, devis_recu_le, montant_ht, deposit_file_path, deposit_file_name, nature_travaux"
    )
    .eq("id", entryId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (!entry?.enterprise_id) return null;
  if (entry.quote_id) return entry.quote_id as string;

  const logement = (entry.logement_number as string) || "";
  const designation = logement
    ? `TMA logement ${logement}`
    : (entry.nature_travaux as string) || "TMA";

  const { data: quote, error } = await sb
    .from("financial_quotes")
    .insert({
      project_id: projectId,
      enterprise_id: entry.enterprise_id,
      quote_number: (entry.devis_number as string) || "",
      quote_date: (entry.devis_recu_le as string) || new Date().toISOString().slice(0, 10),
      is_cie: false,
      is_ts: false,
      is_tma: true,
      designation,
      amount_ht: Number(entry.montant_ht ?? 0),
      file_path: (entry.deposit_file_path as string | null) ?? null,
      file_name: (entry.deposit_file_name as string | null) ?? null,
    })
    .select("id")
    .single();

  if (error || !quote) return null;

  await sb
    .from("work_tma_entries")
    .update({ quote_id: quote.id })
    .eq("id", entryId)
    .eq("project_id", projectId);

  return quote.id;
}

/** Propage tous les champs synchronisables d'un devis TMA vers ses lignes. */
export async function syncAllTmaEntriesFromQuote(
  projectId: string,
  quoteId: string,
  supabase?: SupabaseClient
): Promise<void> {
  const sb = supabase ?? (await createClient());

  const { data: quote } = await sb
    .from("financial_quotes")
    .select("quote_number, quote_date, mou_sent_at, mou_return_at, amount_ht")
    .eq("id", quoteId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (!quote) return;

  await sb
    .from("work_tma_entries")
    .update({
      devis_number: quote.quote_number ?? "",
      devis_recu_le: quote.quote_date ?? null,
      mou_envoi: quote.mou_sent_at ?? null,
      mou_acceptation: quote.mou_return_at ?? null,
    })
    .eq("project_id", projectId)
    .eq("quote_id", quoteId);

  if (Number(quote.amount_ht) > 0) {
    await syncTmaAmountFromQuote(projectId, quoteId, Number(quote.amount_ht), sb);
  }
}
