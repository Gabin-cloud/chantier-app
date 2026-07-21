"use server";

import { revalidatePath } from "next/cache";
import { requireProjectAccess, requireProjectRoles } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import type { WorkTmaEntry } from "@/lib/types/database";

function revalidateTma(projectId: string) {
  revalidatePath(`/pc/projets/${projectId}/suivi-travaux/tma`);
}

export type TmaFormData = {
  logementNumber: string;
  localisation: string;
  modifDemandeeLe: string;
  natureTravaux: string;
  enterpriseId: string;
  enterpriseName: string;
  devisNumber: string;
  devisRecuLe: string;
  mouEnvoi: string;
  mouAcceptation: string;
  montantHt: string;
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

export async function createTmaEntry(
  projectId: string,
  form: TmaFormData
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireProjectRoles(projectId, ["admin", "gestionnaire"]);
    const supabase = await createClient();

    const { data: maxRow } = await supabase
      .from("work_tma_entries")
      .select("sort_order")
      .eq("project_id", projectId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    const sortOrder = (maxRow?.sort_order ?? 0) + 1;
    const montant = parseFloat(form.montantHt.replace(/\s/g, "").replace(",", ".")) || 0;

    let enterpriseName = form.enterpriseName.trim();
    if (form.enterpriseId) {
      const { data: ent } = await supabase
        .from("enterprises")
        .select("name")
        .eq("id", form.enterpriseId)
        .maybeSingle();
      if (ent?.name) enterpriseName = ent.name;
    }

    const { error } = await supabase.from("work_tma_entries").insert({
      project_id: projectId,
      logement_number: form.logementNumber.trim(),
      localisation: form.localisation.trim(),
      modif_demandee_le: form.modifDemandeeLe || null,
      nature_travaux: form.natureTravaux.trim(),
      enterprise_id: form.enterpriseId || null,
      enterprise_name: enterpriseName,
      devis_number: form.devisNumber.trim(),
      devis_recu_le: form.devisRecuLe || null,
      mou_envoi: form.mouEnvoi || null,
      mou_acceptation: form.mouAcceptation || null,
      montant_ht: montant,
      sort_order: sortOrder,
    });

    if (error) throw new Error(error.message);
    revalidateTma(projectId);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Erreur lors de la création.",
    };
  }
}

type TmaField =
  | "logement_number"
  | "localisation"
  | "modif_demandee_le"
  | "nature_travaux"
  | "enterprise_name"
  | "devis_number"
  | "devis_recu_le"
  | "mou_envoi"
  | "mou_acceptation"
  | "montant_ht";

export async function updateTmaField(
  projectId: string,
  entryId: string,
  field: TmaField,
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
