"use server";

import { revalidatePath } from "next/cache";
import { requireProjectAccess, requireProjectRoles } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import type { WorkTmaEntry, WorkTmaDossier } from "@/lib/types/database";

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
          status: markSent ? "sent" : "draft",
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

/** Remplit une ligne TMA depuis un devis Outlook (case TMA cochée). */
export async function fillTmaFromQuote(
  projectId: string,
  quoteId: string
): Promise<void> {
  const supabase = await createClient();

  const { data: quote, error } = await supabase
    .from("financial_quotes")
    .select(
      "id, quote_number, quote_date, amount_ht, designation, enterprise_id, is_tma, enterprise:enterprises(name)"
    )
    .eq("id", quoteId)
    .eq("project_id", projectId)
    .single();

  if (error || !quote?.is_tma || !quote.enterprise_id) return;

  const enterpriseRaw = quote.enterprise as unknown;
  const enterprise = (Array.isArray(enterpriseRaw) ? enterpriseRaw[0] : enterpriseRaw) as {
    name: string;
  } | null;

  const { data: existing } = await supabase
    .from("work_tma_entries")
    .select("id")
    .eq("project_id", projectId)
    .eq("enterprise_id", quote.enterprise_id)
    .or("devis_number.is.null,devis_number.eq.")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const payload = {
    devis_number: quote.quote_number ?? "",
    devis_recu_le: quote.quote_date ?? null,
    montant_ht: quote.amount_ht ?? 0,
    enterprise_name: enterprise?.name ?? "",
    nature_travaux: quote.designation ?? "",
  };

  if (existing) {
    await supabase.from("work_tma_entries").update(payload).eq("id", existing.id);
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
      enterprise_id: quote.enterprise_id,
      logement_number: "",
      localisation: "",
      modif_demandee_le: quote.quote_date ?? null,
      ...payload,
      sort_order: (maxRow?.sort_order ?? 0) + 1,
      status: "draft",
    });
  }

  revalidateTma(projectId);
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
