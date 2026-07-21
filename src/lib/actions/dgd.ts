"use server";

import { revalidatePath } from "next/cache";
import { requireProjectAccess, requireProjectRoles } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import type { Enterprise, FinancialDgdEntry, FinancialDgdRow } from "@/lib/types/database";

function revalidateDgd(projectId: string) {
  revalidatePath(`/pc/projets/${projectId}/suivi-financier/dgd`);
}

type DgdField =
  | "projet_envoye_danobat"
  | "projet_envoye_mou"
  | "proposition_transmise_entreprise"
  | "projet_retourne_entreprise"
  | "exemplaire_signe_envoye_mou"
  | "dgd_accepte_recu_danobat"
  | "liberation_rg_cb";

type DgdBooleanField =
  | "reserves_reception_levees"
  | "avis_bc_leves"
  | "sous_traitants_payes"
  | "cie_ok"
  | "avenants_ok";

async function ensureDgdRows(
  projectId: string,
  enterprises: Enterprise[]
): Promise<FinancialDgdEntry[]> {
  const supabase = await createClient();

  const { data: existing, error: fetchError } = await supabase
    .from("financial_dgd_entries")
    .select("*")
    .eq("project_id", projectId);

  if (fetchError) throw new Error(fetchError.message);

  const existingByEnterprise = new Map(
    (existing ?? []).map((row) => [row.enterprise_id as string, row as FinancialDgdEntry])
  );

  const missing = enterprises.filter((e) => !existingByEnterprise.has(e.id));
  if (missing.length > 0) {
    const { data: inserted, error: insertError } = await supabase
      .from("financial_dgd_entries")
      .insert(
        missing.map((e) => ({
          project_id: projectId,
          enterprise_id: e.id,
        }))
      )
      .select("*");

    if (insertError) throw new Error(insertError.message);
    for (const row of inserted ?? []) {
      existingByEnterprise.set(row.enterprise_id as string, row as FinancialDgdEntry);
    }
  }

  return enterprises
    .map((e) => existingByEnterprise.get(e.id))
    .filter((row): row is FinancialDgdEntry => Boolean(row));
}

export async function getDgdTracking(projectId: string): Promise<FinancialDgdRow[]> {
  await requireProjectAccess(projectId);
  const supabase = await createClient();

  const { data: enterprises, error: entError } = await supabase
    .from("enterprises")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true });

  if (entError) throw new Error(entError.message);

  const entries = await ensureDgdRows(projectId, (enterprises ?? []) as Enterprise[]);

  return entries.map((entry) => {
    const enterprise = (enterprises ?? []).find((e) => e.id === entry.enterprise_id);
    return {
      ...entry,
      lot_number: enterprise?.lot_number ?? null,
      lot_designation: enterprise?.designation ?? enterprise?.trade ?? null,
      enterprise_name: enterprise?.name ?? "",
    };
  });
}

export async function updateDgdDateField(
  projectId: string,
  entryId: string,
  field: DgdField,
  value: string | null
): Promise<void> {
  await requireProjectRoles(projectId, ["admin", "gestionnaire", "financier"]);
  const supabase = await createClient();

  const { error } = await supabase
    .from("financial_dgd_entries")
    .update({ [field]: value || null })
    .eq("id", entryId)
    .eq("project_id", projectId);

  if (error) throw new Error(error.message);
  revalidateDgd(projectId);
}

export async function updateDgdBooleanField(
  projectId: string,
  entryId: string,
  field: DgdBooleanField,
  value: boolean
): Promise<void> {
  await requireProjectRoles(projectId, ["admin", "gestionnaire", "financier"]);
  const supabase = await createClient();

  const { error } = await supabase
    .from("financial_dgd_entries")
    .update({ [field]: value })
    .eq("id", entryId)
    .eq("project_id", projectId);

  if (error) throw new Error(error.message);
  revalidateDgd(projectId);
}
