"use server";

import { revalidatePath } from "next/cache";
import { requireProjectAccess, requireProjectRoles } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import type {
  TmaDepositGroup,
  WorkTmaEntry,
  WorkTmaDossier,
  WorkTmaEntryStatus,
} from "@/lib/types/database";

const FINANCIAL_BUCKET = "financial-files";

function revalidateTma(projectId: string) {
  revalidatePath(`/pc/projets/${projectId}/suivi-travaux/tma`);
}

export type TmaTriState = "oui" | "non" | "nc";

export type TmaLineInput = {
  localisation: string;
  enterpriseId: string;
  enterpriseName: string;
  natureTravaux: string;
};

export type TmaDossierFormData = {
  logementNumber: string;
  nfStatus: TmaTriState | "";
  pmrStatus: TmaTriState | "";
  lines: TmaLineInput[];
};

export type TmaAnalysisLineInput = {
  id?: string;
  localisation: string;
  natureTravaux: string;
  montantHt: number;
  isRequestLine: boolean;
};

export async function getTmaEntries(projectId: string): Promise<WorkTmaEntry[]> {
  await requireProjectAccess(projectId);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("work_tma_entries")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as WorkTmaEntry[];
}

export async function getOpenTmaLogements(projectId: string): Promise<
  { logementNumber: string; dossierId: string }[]
> {
  await requireProjectAccess(projectId);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("work_tma_dossiers")
    .select("id, logement_number")
    .eq("project_id", projectId)
    .in("status", ["sent", "draft"])
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    logementNumber: row.logement_number,
    dossierId: row.id,
  }));
}

export async function getTmaDossier(
  projectId: string,
  dossierId: string
): Promise<WorkTmaDossier | null> {
  await requireProjectAccess(projectId);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("work_tma_dossiers")
    .select("*")
    .eq("id", dossierId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data ?? null) as WorkTmaDossier | null;
}

export async function getTmaDepositGroups(projectId: string): Promise<TmaDepositGroup[]> {
  const entries = await getTmaEntries(projectId);
  const toAnalyze = entries.filter((e) => e.status === "to_analyze");

  const groups = new Map<string, TmaDepositGroup>();

  for (const entry of toAnalyze) {
    const key = `${entry.quote_id ?? "none"}::${entry.logement_number}::${entry.enterprise_id ?? entry.enterprise_name}`;
    const existing = groups.get(key);
    if (existing) {
      existing.entryIds.push(entry.id);
      existing.lineCount += 1;
      existing.totalHt += entry.montant_ht;
    } else {
      groups.set(key, {
        quoteId: entry.quote_id,
        logementNumber: entry.logement_number,
        enterpriseId: entry.enterprise_id,
        enterpriseName: entry.enterprise_name,
        devisNumber: entry.devis_number,
        devisRecuLe: entry.devis_recu_le,
        depositFilePath: entry.deposit_file_path,
        depositFileName: entry.deposit_file_name,
        entryIds: [entry.id],
        lineCount: 1,
        totalHt: entry.montant_ht,
      });
    }
  }

  return Array.from(groups.values());
}

export async function getTmaAnalysisContext(
  projectId: string,
  entryIds: string[]
): Promise<
  | {
      ok: true;
      entries: WorkTmaEntry[];
      requestLines: WorkTmaEntry[];
      contractAmountHt: number;
      dossier: WorkTmaDossier | null;
    }
  | { ok: false; error: string }
> {
  try {
    await requireProjectAccess(projectId);
    const supabase = await createClient();

    const { data: entries, error } = await supabase
      .from("work_tma_entries")
      .select("*")
      .eq("project_id", projectId)
      .in("id", entryIds);

    if (error || !entries?.length) {
      return { ok: false, error: "Lignes TMA introuvables." };
    }

    const typed = entries as WorkTmaEntry[];
    const first = typed[0];
    const enterpriseId = first.enterprise_id;

    let contractAmountHt = 0;
    if (enterpriseId) {
      const { data: ent } = await supabase
        .from("enterprises")
        .select("contract_amount_ht")
        .eq("id", enterpriseId)
        .maybeSingle();
      contractAmountHt = Number(ent?.contract_amount_ht ?? 0);
    }

    let requestLines: WorkTmaEntry[] = [];
    if (first.dossier_id && enterpriseId) {
      const { data: reqLines } = await supabase
        .from("work_tma_entries")
        .select("*")
        .eq("project_id", projectId)
        .eq("dossier_id", first.dossier_id)
        .eq("enterprise_id", enterpriseId)
        .eq("is_request_line", true)
        .in("status", ["sent", "to_analyze", "analyzed"]);

      requestLines = (reqLines ?? []) as WorkTmaEntry[];
    }

    let dossier: WorkTmaDossier | null = null;
    if (first.dossier_id) {
      dossier = await getTmaDossier(projectId, first.dossier_id);
    }

    return { ok: true, entries: typed, requestLines, contractAmountHt, dossier };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Impossible de charger l'analyse.",
    };
  }
}

async function uploadMouDocuments(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
  dossierId: string,
  files: File[]
): Promise<string[]> {
  const paths: string[] = [];
  for (const file of files) {
    if (!file.size) continue;
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `${projectId}/tma/${dossierId}/mou/${safeName}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const { error } = await supabase.storage.from(FINANCIAL_BUCKET).upload(path, buffer, {
      contentType: file.type || "application/pdf",
      upsert: true,
    });
    if (error) throw new Error(error.message);
    paths.push(path);
  }
  return paths;
}

export async function saveTmaDossier(
  projectId: string,
  formData: FormData,
  options?: { markSent?: boolean }
): Promise<
  | { ok: true; dossierId: string; entryIds: string[] }
  | { ok: false; error: string }
> {
  try {
    await requireProjectRoles(projectId, ["admin", "gestionnaire"]);
    const supabase = await createClient();

    const payloadRaw = formData.get("payload") as string;
    const form = JSON.parse(payloadRaw) as TmaDossierFormData;
    const markSent =
      options?.markSent ?? formData.get("markSent") === "true";
    const mouFiles = formData.getAll("mouFiles").filter((f): f is File => f instanceof File && f.size > 0);

    const validLines = form.lines.filter(
      (line) =>
        line.localisation.trim() ||
        line.enterpriseName.trim() ||
        line.natureTravaux.trim()
    );

    if (!form.logementNumber.trim()) {
      return { ok: false, error: "Le n° de logement est obligatoire." };
    }
    if (validLines.length === 0) {
      return { ok: false, error: "Ajoutez au moins une ligne au tableau." };
    }

    const { data: dossier, error: dossierError } = await supabase
      .from("work_tma_dossiers")
      .insert({
        project_id: projectId,
        logement_number: form.logementNumber.trim(),
        nf_status: form.nfStatus || null,
        pmr_status: form.pmrStatus || null,
        status: markSent ? "sent" : "draft",
        sent_at: markSent ? new Date().toISOString() : null,
      })
      .select("id")
      .single();

    if (dossierError) throw new Error(dossierError.message);

    const mouPaths = mouFiles.length
      ? await uploadMouDocuments(supabase, projectId, dossier.id, mouFiles)
      : [];

    if (mouPaths.length) {
      await supabase
        .from("work_tma_dossiers")
        .update({ mou_document_paths: mouPaths })
        .eq("id", dossier.id);
    }

    const { data: maxRow } = await supabase
      .from("work_tma_entries")
      .select("sort_order")
      .eq("project_id", projectId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    let sortOrder = maxRow?.sort_order ?? 0;
    const entryIds: string[] = [];
    const modifDate = new Date().toISOString().slice(0, 10);
    const entryStatus: WorkTmaEntryStatus = markSent ? "sent" : "draft";

    for (const line of validLines) {
      sortOrder += 1;
      let enterpriseName = line.enterpriseName.trim();
      if (line.enterpriseId) {
        const { data: ent } = await supabase
          .from("enterprises")
          .select("name")
          .eq("id", line.enterpriseId)
          .maybeSingle();
        if (ent?.name) enterpriseName = ent.name;
      }

      const { data: entry, error: entryError } = await supabase
        .from("work_tma_entries")
        .insert({
          project_id: projectId,
          dossier_id: dossier.id,
          logement_number: form.logementNumber.trim(),
          localisation: line.localisation.trim(),
          modif_demandee_le: modifDate,
          nature_travaux: line.natureTravaux.trim(),
          enterprise_id: line.enterpriseId || null,
          enterprise_name: enterpriseName,
          nf_status: form.nfStatus || null,
          pmr_status: form.pmrStatus || null,
          status: entryStatus,
          is_request_line: true,
          sort_order: sortOrder,
        })
        .select("id")
        .single();

      if (entryError) throw new Error(entryError.message);
      entryIds.push(entry.id);
    }

    revalidateTma(projectId);
    return { ok: true, dossierId: dossier.id, entryIds };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Erreur lors de l'enregistrement.",
    };
  }
}

/** Remplit le suivi TMA depuis un devis Outlook (case TMA cochée). */
export async function fillTmaFromQuote(
  projectId: string,
  quoteId: string,
  logementNumber?: string
): Promise<void> {
  const supabase = await createClient();

  const { data: quote, error } = await supabase
    .from("financial_quotes")
    .select(
      "id, quote_number, quote_date, amount_ht, designation, enterprise_id, is_tma, file_path, file_name, enterprise:enterprises(name)"
    )
    .eq("id", quoteId)
    .eq("project_id", projectId)
    .single();

  if (error || !quote?.is_tma || !quote.enterprise_id) return;

  const enterpriseRaw = quote.enterprise as unknown;
  const enterprise = (Array.isArray(enterpriseRaw) ? enterpriseRaw[0] : enterpriseRaw) as {
    name: string;
  } | null;

  const logement = (logementNumber ?? "").trim();
  const depositPayload = {
    quote_id: quote.id,
    devis_number: quote.quote_number ?? "",
    devis_recu_le: quote.quote_date ?? null,
    montant_ht: quote.amount_ht ?? 0,
    enterprise_name: enterprise?.name ?? "",
    deposit_file_path: quote.file_path ?? null,
    deposit_file_name: quote.file_name ?? null,
    status: "to_analyze" as WorkTmaEntryStatus,
  };

  let dossierId: string | null = null;
  if (logement) {
    const { data: dossier } = await supabase
      .from("work_tma_dossiers")
      .select("id")
      .eq("project_id", projectId)
      .eq("logement_number", logement)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    dossierId = dossier?.id ?? null;
  }

  let matchingQuery = supabase
    .from("work_tma_entries")
    .select("id")
    .eq("project_id", projectId)
    .eq("enterprise_id", quote.enterprise_id)
    .eq("is_request_line", true)
    .in("status", ["sent", "draft"]);

  if (logement) {
    matchingQuery = matchingQuery.eq("logement_number", logement);
  }
  if (dossierId) {
    matchingQuery = matchingQuery.eq("dossier_id", dossierId);
  }

  const { data: matchingLines } = await matchingQuery;

  if (matchingLines?.length) {
    for (const line of matchingLines) {
      await supabase
        .from("work_tma_entries")
        .update(depositPayload)
        .eq("id", line.id);
    }
  } else {
    const { data: maxRow } = await supabase
      .from("work_tma_entries")
      .select("sort_order")
      .eq("project_id", projectId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    await supabase.from("work_tma_entries").insert({
      project_id: projectId,
      dossier_id: dossierId,
      enterprise_id: quote.enterprise_id,
      logement_number: logement,
      localisation: "",
      modif_demandee_le: quote.quote_date ?? null,
      nature_travaux: quote.designation ?? "",
      is_request_line: false,
      ...depositPayload,
      sort_order: (maxRow?.sort_order ?? 0) + 1,
    });
  }

  revalidateTma(projectId);
}

export async function saveTmaAnalysis(
  projectId: string,
  context: {
    entryIds: string[];
    logementNumber: string;
    enterpriseId: string | null;
    enterpriseName: string;
    dossierId: string | null;
    quoteId: string | null;
    lines: TmaAnalysisLineInput[];
    markAnalyzed: boolean;
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireProjectRoles(projectId, ["admin", "gestionnaire"]);
    const supabase = await createClient();

    const status: WorkTmaEntryStatus = context.markAnalyzed ? "analyzed" : "to_analyze";
    const existingIds = new Set(context.entryIds);
    const keptIds = new Set<string>();

    const { data: seedRows } = await supabase
      .from("work_tma_entries")
      .select("devis_number, devis_recu_le, deposit_file_path, deposit_file_name, quote_id")
      .eq("project_id", projectId)
      .in("id", context.entryIds)
      .limit(1);

    const seed = seedRows?.[0];

    const { data: maxRow } = await supabase
      .from("work_tma_entries")
      .select("sort_order")
      .eq("project_id", projectId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();
    let sortOrder = maxRow?.sort_order ?? 0;

    for (const line of context.lines) {
      const payload = {
        localisation: line.localisation.trim(),
        nature_travaux: line.natureTravaux.trim(),
        montant_ht: line.montantHt,
        is_request_line: line.isRequestLine,
        status,
        logement_number: context.logementNumber,
        enterprise_id: context.enterpriseId,
        enterprise_name: context.enterpriseName,
        dossier_id: context.dossierId,
        quote_id: context.quoteId ?? seed?.quote_id ?? null,
        devis_number: seed?.devis_number ?? "",
        devis_recu_le: seed?.devis_recu_le ?? null,
        deposit_file_path: seed?.deposit_file_path ?? null,
        deposit_file_name: seed?.deposit_file_name ?? null,
      };

      if (line.id && existingIds.has(line.id)) {
        await supabase.from("work_tma_entries").update(payload).eq("id", line.id);
        keptIds.add(line.id);
      } else {
        sortOrder += 1;
        const { data: created } = await supabase
          .from("work_tma_entries")
          .insert({
            project_id: projectId,
            ...payload,
            sort_order: sortOrder,
          })
          .select("id")
          .single();
        if (created) keptIds.add(created.id);
      }
    }

    for (const id of context.entryIds) {
      if (!keptIds.has(id)) {
        await supabase.from("work_tma_entries").delete().eq("id", id);
      }
    }

    revalidateTma(projectId);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Erreur lors de l'enregistrement.",
    };
  }
}

export async function updateTmaField(
  projectId: string,
  entryId: string,
  field: string,
  value: string | number | null
): Promise<void> {
  await requireProjectRoles(projectId, ["admin", "gestionnaire"]);
  const supabase = await createClient();

  const { error } = await supabase
    .from("work_tma_entries")
    .update({ [field]: value })
    .eq("id", entryId)
    .eq("project_id", projectId);

  if (error) throw new Error(error.message);
  revalidateTma(projectId);
}

export async function deleteTmaEntry(projectId: string, entryId: string): Promise<void> {
  await requireProjectRoles(projectId, ["admin", "gestionnaire"]);
  const supabase = await createClient();

  const { error } = await supabase
    .from("work_tma_entries")
    .delete()
    .eq("id", entryId)
    .eq("project_id", projectId);

  if (error) throw new Error(error.message);
  revalidateTma(projectId);
}

export async function getAnalyzedTmaEntryIds(projectId: string): Promise<string[]> {
  await requireProjectAccess(projectId);
  const supabase = await createClient();

  const { data } = await supabase
    .from("work_tma_entries")
    .select("id")
    .eq("project_id", projectId)
    .eq("status", "analyzed");

  return (data ?? []).map((r) => r.id);
}

export async function markTmaSentToAccounting(
  projectId: string,
  entryIds: string[]
): Promise<void> {
  await requireProjectRoles(projectId, ["admin", "gestionnaire"]);
  const supabase = await createClient();
  const now = new Date().toISOString();

  const { error } = await supabase
    .from("work_tma_entries")
    .update({ status: "sent_to_accounting", accounting_sent_at: now })
    .eq("project_id", projectId)
    .in("id", entryIds);

  if (error) throw new Error(error.message);
  revalidateTma(projectId);
}
