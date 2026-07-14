"use server";

import { revalidatePath } from "next/cache";
import {
  requireProjectAccess,
  requireProjectRoles,
  requireUser,
} from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import type {
  SousTraitanceFormData,
  SousTraitanceRequest,
  SousTraitanceStatus,
} from "@/lib/types/sous-traitance";

export async function getSousTraitanceRequests(
  projectId: string,
  enterpriseId?: string
): Promise<SousTraitanceRequest[]> {
  await requireProjectAccess(projectId);
  const supabase = await createClient();

  let query = supabase
    .from("sous_traitance_requests")
    .select("*, enterprises(name, lot_number, trade)")
    .eq("project_id", projectId)
    .order("updated_at", { ascending: false });

  if (enterpriseId) {
    query = query.eq("enterprise_id", enterpriseId);
  }

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data as unknown as SousTraitanceRequest[];
}

export async function createSousTraitanceRequest(
  projectId: string,
  enterpriseId: string,
  formData: SousTraitanceFormData
): Promise<string> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: membership } = await supabase
    .from("project_members")
    .select("role, enterprise_id")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();

  const isEnterprise =
    membership?.role === "entreprise" &&
    membership.enterprise_id === enterpriseId;
  const isManager =
    membership?.role === "admin" || membership?.role === "gestionnaire";

  if (!isEnterprise && !isManager) {
    throw new Error("Droits insuffisants pour déposer une demande.");
  }

  const { data, error } = await supabase
    .from("sous_traitance_requests")
    .insert({
      project_id: projectId,
      enterprise_id: enterpriseId,
      type: formData.type,
      title: formData.title.trim(),
      description: formData.description.trim(),
      status: "soumise",
      deadline: formData.deadline || null,
      amount_ht: formData.amount_ht ? parseFloat(formData.amount_ht) : null,
      reference: formData.reference.trim() || null,
      created_by: user.id,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  revalidatePath(`/entreprise/projets/${projectId}/sous-traitance`);
  revalidatePath(`/pc/projets/${projectId}/finance/sous-traitance`);

  return data.id;
}

export async function updateSousTraitanceStatus(
  projectId: string,
  requestId: string,
  status: SousTraitanceStatus
) {
  await requireProjectRoles(projectId, ["admin", "gestionnaire"]);
  const supabase = await createClient();

  const { error } = await supabase
    .from("sous_traitance_requests")
    .update({ status })
    .eq("id", requestId)
    .eq("project_id", projectId);

  if (error) throw new Error(error.message);

  revalidatePath(`/entreprise/projets/${projectId}/sous-traitance`);
  revalidatePath(`/pc/projets/${projectId}/finance/sous-traitance`);
}
