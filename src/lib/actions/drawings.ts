"use server";

import { revalidatePath } from "next/cache";
import { requireProjectAccess, requireProjectRoles } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import type { DrawingStroke, PlanDrawing } from "@/lib/types/database";

export async function getPlanDrawings(
  visitId: string,
  planId?: string
): Promise<PlanDrawing[]> {
  const supabase = await createClient();

  const { data: visit, error: visitError } = await supabase
    .from("visits")
    .select("project_id")
    .eq("id", visitId)
    .single();

  if (visitError) throw new Error(visitError.message);
  await requireProjectAccess(visit.project_id);

  let query = supabase.from("plan_drawings").select("*").eq("visit_id", visitId);
  if (planId) query = query.eq("plan_id", planId);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function savePlanDrawings(
  visitId: string,
  projectId: string,
  planId: string,
  strokes: DrawingStroke[],
  pageNumber = 1
) {
  await requireProjectRoles(projectId, ["admin", "gestionnaire", "terrain"]);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("plan_drawings")
    .upsert(
      {
        visit_id: visitId,
        plan_id: planId,
        page_number: pageNumber,
        strokes,
      },
      { onConflict: "visit_id,plan_id,page_number" }
    )
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  revalidatePath(`/tablette/projets/${projectId}/visites/${visitId}`);
  return data;
}
