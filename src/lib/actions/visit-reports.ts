"use server";

import { revalidatePath } from "next/cache";
import { requireProjectAccess, requireProjectRoles } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { buildVisitReportPdf } from "@/lib/visits/visit-report-pdf";

const REPORTS_BUCKET = "visit-photos";

export async function generateAndStoreVisitReport(
  projectId: string,
  visitId: string
): Promise<{ filePath: string; publicUrl: string }> {
  await requireProjectRoles(projectId, ["admin", "gestionnaire", "terrain"]);
  const supabase = await createClient();

  const { data: visit, error: visitError } = await supabase
    .from("visits")
    .select("*")
    .eq("id", visitId)
    .single();

  if (visitError) throw new Error(visitError.message);

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select("name, address, city")
    .eq("id", projectId)
    .single();

  if (projectError) throw new Error(projectError.message);

  let phaseName: string | null = null;
  if (visit.phase_id) {
    const { data: phase } = await supabase
      .from("visit_phases")
      .select("name")
      .eq("id", visit.phase_id)
      .single();
    phaseName = phase?.name ?? null;
  }

  let zoneName: string | null = null;
  if (visit.zone_id) {
    const { data: zone } = await supabase
      .from("phase_zones")
      .select("name")
      .eq("id", visit.zone_id)
      .single();
    zoneName = zone?.name ?? null;
  }

  let controlLabel: string | null = null;
  if (visit.checklist_item_id) {
    const { data: item } = await supabase
      .from("phase_checklist_items")
      .select("label")
      .eq("id", visit.checklist_item_id)
      .single();
    controlLabel = item?.label ?? null;
  }

  const { data: checklistItems } = visit.phase_id
    ? await supabase
        .from("phase_checklist_items")
        .select("*")
        .eq("phase_id", visit.phase_id)
        .order("sort_order", { ascending: true })
    : { data: [] };

  const { data: zones } = visit.phase_id
    ? await supabase
        .from("phase_zones")
        .select("*")
        .eq("phase_id", visit.phase_id)
    : { data: [] };

  const { data: markers } = await supabase
    .from("markers")
    .select("*")
    .eq("visit_id", visitId)
    .order("marker_number", { ascending: true });

  const { data: enterprises } = await supabase
    .from("enterprises")
    .select("*")
    .eq("project_id", projectId);

  const pdfBytes = buildVisitReportPdf({
    project,
    visit,
    phaseName,
    zoneName,
    controlLabel,
    checklistItems: checklistItems ?? [],
    zones: zones ?? [],
    markers: (markers ?? []).map((m) => ({ ...m, linked_marker_ids: [] })),
    enterprises: enterprises ?? [],
  });

  const filePath = `${projectId}/reports/${visitId}.pdf`;

  const { error: uploadError } = await supabase.storage
    .from(REPORTS_BUCKET)
    .upload(filePath, pdfBytes, {
      contentType: "application/pdf",
      upsert: true,
    });

  if (uploadError) throw new Error(uploadError.message);

  await supabase.from("visit_reports").delete().eq("visit_id", visitId);
  await supabase.from("visit_reports").insert({
    visit_id: visitId,
    file_path: filePath,
  });

  const { data: urlData } = supabase.storage.from(REPORTS_BUCKET).getPublicUrl(filePath);

  revalidatePath(`/tablette/projets/${projectId}/visites/${visitId}`);
  revalidatePath(`/pc/projets/${projectId}`);

  return { filePath, publicUrl: urlData.publicUrl };
}

export async function getVisitReportUrl(visitId: string): Promise<string | null> {
  const supabase = await createClient();

  const { data: visit } = await supabase
    .from("visits")
    .select("project_id")
    .eq("id", visitId)
    .single();

  if (!visit) return null;
  await requireProjectAccess(visit.project_id);

  const { data: report } = await supabase
    .from("visit_reports")
    .select("file_path")
    .eq("visit_id", visitId)
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!report?.file_path) return null;

  const { data } = supabase.storage.from(REPORTS_BUCKET).getPublicUrl(report.file_path);
  return data.publicUrl;
}
