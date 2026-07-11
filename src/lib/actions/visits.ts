"use server";

import { revalidatePath } from "next/cache";
import { requireProjectAccess, requireProjectRoles } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import type { MarkerUpdateData, MarkerWithLinks, VisitFormData } from "@/lib/types/database";
import { computeVisitControlSummary } from "@/lib/control-summary";
import { ensureDefaultPhases } from "@/lib/actions/phases";
import { generateAndStoreVisitReport } from "@/lib/actions/visit-reports";
import { sendVisitCompletedEmail } from "@/lib/notifications/visit-completed";
import { getNotificationSenderEmail } from "@/lib/microsoft/config";

const PHOTOS_BUCKET = "visit-photos";

async function getMarkerLinks(
  supabase: Awaited<ReturnType<typeof createClient>>,
  phaseId: string | null,
  visitId: string
) {
  let markerIds: string[] = [];

  if (phaseId) {
    const { data: markers } = await supabase
      .from("markers")
      .select("id")
      .eq("phase_id", phaseId);
    markerIds = markers?.map((m) => m.id) ?? [];
  } else {
    const { data: markers } = await supabase
      .from("markers")
      .select("id")
      .eq("visit_id", visitId);
    markerIds = markers?.map((m) => m.id) ?? [];
  }

  if (!markerIds.length) return new Map<string, string[]>();

  const [{ data: linksFrom }, { data: linksTo }] = await Promise.all([
    supabase.from("marker_links").select("*").in("from_marker_id", markerIds),
    supabase.from("marker_links").select("*").in("to_marker_id", markerIds),
  ]);

  const seen = new Set<string>();
  const links = [...(linksFrom ?? []), ...(linksTo ?? [])].filter((link) => {
    const key = [link.from_marker_id, link.to_marker_id].sort().join("-");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const linkMap = new Map<string, Set<string>>();

  for (const link of links ?? []) {
    if (!linkMap.has(link.from_marker_id)) linkMap.set(link.from_marker_id, new Set());
    if (!linkMap.has(link.to_marker_id)) linkMap.set(link.to_marker_id, new Set());
    linkMap.get(link.from_marker_id)!.add(link.to_marker_id);
    linkMap.get(link.to_marker_id)!.add(link.from_marker_id);
  }

  const result = new Map<string, string[]>();
  for (const [id, set] of linkMap) {
    result.set(id, Array.from(set));
  }

  return result;
}

export async function getVisits(projectId: string) {
  await requireProjectAccess(projectId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("visits")
    .select("*")
    .eq("project_id", projectId)
    .order("visit_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return data;
}

export async function getVisit(visitId: string): Promise<{
  visit: Awaited<ReturnType<typeof getVisits>>[0];
  markers: MarkerWithLinks[];
}> {
  const supabase = await createClient();

  const { data: visit, error: visitError } = await supabase
    .from("visits")
    .select("*")
    .eq("id", visitId)
    .single();

  if (visitError) throw new Error(visitError.message);

  await requireProjectAccess(visit.project_id);

  let markersQuery = supabase.from("markers").select("*").order("marker_number", {
    ascending: true,
  });

  if (visit.phase_id) {
    markersQuery = markersQuery.eq("phase_id", visit.phase_id);
  } else {
    markersQuery = markersQuery.eq("visit_id", visitId);
  }

  const { data: markers, error: markersError } = await markersQuery;

  if (markersError) throw new Error(markersError.message);

  const linkMap = await getMarkerLinks(supabase, visit.phase_id, visitId);

  const markersWithLinks: MarkerWithLinks[] = (markers ?? []).map((marker) => ({
    ...marker,
    phase_id: marker.phase_id ?? visit.phase_id ?? null,
    status: marker.status ?? "a_traiter",
    enterprise_id: marker.enterprise_id ?? null,
    trade: marker.trade ?? null,
    location_label: marker.location_label ?? null,
    location_preset_id: marker.location_preset_id ?? null,
    checklist_item_id: marker.checklist_item_id ?? null,
    control_result: marker.control_result ?? null,
    linked_marker_ids: linkMap.get(marker.id) ?? [],
  }));

  return { visit, markers: markersWithLinks };
}

export async function createVisit(projectId: string, formData: VisitFormData) {
  await requireProjectRoles(projectId, ["admin", "gestionnaire", "terrain"]);
  const supabase = await createClient();

  let phaseId = formData.phase_id;
  if (!phaseId) {
    const phases = await ensureDefaultPhases(projectId);
    phaseId = phases[0]?.id;
  }

  const title =
    formData.title?.trim() ||
    `Visite du ${new Date(formData.visit_date ?? Date.now()).toLocaleDateString("fr-FR")}`;

  const { data, error } = await supabase
    .from("visits")
    .insert({
      project_id: projectId,
      phase_id: phaseId ?? null,
      zone_id: formData.zone_id || null,
      checklist_item_id: formData.checklist_item_id || null,
      title,
      visit_date: formData.visit_date || new Date().toISOString().slice(0, 10),
      notes: formData.notes?.trim() || null,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  revalidatePath(`/tablette/projets/${projectId}/visites`);

  return data.id;
}

export async function completeVisit(projectId: string, visitId: string) {
  await requireProjectRoles(projectId, ["admin", "gestionnaire", "terrain"]);
  const supabase = await createClient();

  const { data: visit, error: visitFetchError } = await supabase
    .from("visits")
    .select("*")
    .eq("id", visitId)
    .single();

  if (visitFetchError) throw new Error(visitFetchError.message);

  const { data: markers } = await supabase
    .from("markers")
    .select("checklist_item_id, control_result")
    .eq("visit_id", visitId);

  const control_summary = computeVisitControlSummary(markers ?? []);

  const { error } = await supabase
    .from("visits")
    .update({ status: "completed", control_summary })
    .eq("id", visitId);

  if (error) throw new Error(error.message);

  let reportUrl: string | null = null;
  try {
    const report = await generateAndStoreVisitReport(projectId, visitId);
    reportUrl = report.publicUrl;
  } catch (reportErr) {
    console.error("Rapport PDF:", reportErr);
  }

  try {
    await sendVisitCompletedEmails(supabase, projectId, {
      ...visit,
      control_summary,
    }, reportUrl);
  } catch (emailErr) {
    console.error("Emails visite:", emailErr);
  }

  revalidatePath(`/tablette/projets/${projectId}/visites`);
  revalidatePath(`/tablette/projets/${projectId}/visites/${visitId}`);
}

async function sendVisitCompletedEmails(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
  visit: {
    id: string;
    title: string | null;
    visit_date: string;
    phase_id: string | null;
    zone_id: string | null;
    checklist_item_id: string | null;
    control_summary: string | null;
  },
  reportUrl: string | null
) {
  if (!getNotificationSenderEmail()) return;

  const { data: project } = await supabase
    .from("projects")
    .select("name")
    .eq("id", projectId)
    .single();

  const { data: visitMarkers } = await supabase
    .from("markers")
    .select("enterprise_id, control_result")
    .eq("visit_id", visit.id);

  const enterpriseIds = [
    ...new Set(
      (visitMarkers ?? [])
        .map((m) => m.enterprise_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  if (!enterpriseIds.length) return;

  const { data: enterprises } = await supabase
    .from("enterprises")
    .select("id, name, contact_email, email_chantier, contact_name")
    .in("id", enterpriseIds);

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

  const nonConformCount = (visitMarkers ?? []).filter(
    (m) => m.control_result === "ko" || m.control_result === "partial"
  ).length;

  for (const enterprise of enterprises ?? []) {
    const email = enterprise.email_chantier || enterprise.contact_email;
    const status = email ? "sent" : "skipped";
    let errorMessage: string | null = null;

    if (email) {
      try {
        await sendVisitCompletedEmail({
          projectName: project?.name ?? "Chantier",
          visitTitle: visit.title ?? "Visite",
          visitDate: visit.visit_date,
          phaseName,
          zoneName,
          controlLabel,
          controlSummary: (visit.control_summary as "pending" | "ok" | "partial" | "ko") ?? "pending",
          recipientEmail: email,
          recipientName: enterprise.contact_name || enterprise.name,
          markerCount: visitMarkers?.length ?? 0,
          nonConformCount,
          reportUrl,
        });
      } catch (err) {
        errorMessage = err instanceof Error ? err.message : "Erreur inconnue";
        await supabase.from("visit_email_logs").insert({
          visit_id: visit.id,
          recipient_email: email,
          enterprise_name: enterprise.name,
          status: "failed",
          error_message: errorMessage,
        });
        continue;
      }
    }

    await supabase.from("visit_email_logs").insert({
      visit_id: visit.id,
      recipient_email: email ?? "—",
      enterprise_name: enterprise.name,
      status,
      error_message: errorMessage,
    });
  }
}

export async function createMarker(
  visitId: string,
  projectId: string,
  planId: string,
  xPercent: number,
  yPercent: number
) {
  await requireProjectRoles(projectId, ["admin", "gestionnaire", "terrain"]);
  const supabase = await createClient();

  const { data: visit, error: visitError } = await supabase
    .from("visits")
    .select("phase_id, checklist_item_id")
    .eq("id", visitId)
    .single();

  if (visitError) throw new Error(visitError.message);

  const phaseId = visit.phase_id;

  let countQuery = supabase
    .from("markers")
    .select("*", { count: "exact", head: true });

  if (phaseId) {
    countQuery = countQuery.eq("phase_id", phaseId);
  } else {
    countQuery = countQuery.eq("visit_id", visitId);
  }

  const { count, error: countError } = await countQuery;

  if (countError) throw new Error(countError.message);

  const markerNumber = (count ?? 0) + 1;

  const { data, error } = await supabase
    .from("markers")
    .insert({
      visit_id: visitId,
      phase_id: phaseId,
      plan_id: planId,
      x_percent: xPercent,
      y_percent: yPercent,
      marker_number: markerNumber,
      checklist_item_id: visit.checklist_item_id ?? null,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  revalidatePath(`/tablette/projets/${projectId}/visites/${visitId}`);

  return { ...data, linked_marker_ids: [] as string[] };
}

export async function updateMarker(
  visitId: string,
  projectId: string,
  markerId: string,
  data: MarkerUpdateData
) {
  await requireProjectRoles(projectId, ["admin", "gestionnaire", "terrain"]);
  const supabase = await createClient();

  if (data.remark !== undefined) {
    const { error } = await supabase
      .from("markers")
      .update({ remark: data.remark || null })
      .eq("id", markerId);

    if (error) throw new Error(error.message);
  }

  const scalarFields: Partial<{
    status: string;
    enterprise_id: string | null;
    trade: string | null;
    location_label: string | null;
    location_preset_id: string | null;
    checklist_item_id: string | null;
    control_result: string | null;
  }> = {};

  if (data.status !== undefined) scalarFields.status = data.status;
  if (data.enterprise_id !== undefined) scalarFields.enterprise_id = data.enterprise_id;
  if (data.trade !== undefined) scalarFields.trade = data.trade || null;
  if (data.location_label !== undefined) scalarFields.location_label = data.location_label || null;
  if (data.location_preset_id !== undefined) {
    scalarFields.location_preset_id = data.location_preset_id;
  }
  if (data.checklist_item_id !== undefined) {
    scalarFields.checklist_item_id = data.checklist_item_id;
  }
  if (data.control_result !== undefined) {
    scalarFields.control_result = data.control_result;
  }

  if (Object.keys(scalarFields).length > 0) {
    const { error } = await supabase.from("markers").update(scalarFields).eq("id", markerId);
    if (error) throw new Error(error.message);
  }

  if (data.linked_marker_ids !== undefined) {
    await supabase.from("marker_links").delete().eq("from_marker_id", markerId);

    if (data.linked_marker_ids.length > 0) {
      const rows = data.linked_marker_ids.map((toId) => ({
        from_marker_id: markerId,
        to_marker_id: toId,
      }));

      const { error: linkError } = await supabase.from("marker_links").insert(rows);
      if (linkError) throw new Error(linkError.message);
    }
  }

  const { data: visit } = await supabase
    .from("visits")
    .select("phase_id")
    .eq("id", visitId)
    .single();

  if (
    data.control_result !== undefined ||
    data.checklist_item_id !== undefined
  ) {
    await refreshVisitControlSummary(supabase, visitId, visit?.phase_id ?? null);
  }

  revalidatePath(`/tablette/projets/${projectId}/visites/${visitId}`);
}

async function refreshVisitControlSummary(
  supabase: Awaited<ReturnType<typeof createClient>>,
  visitId: string,
  _phaseId: string | null
) {
  const { data: markers } = await supabase
    .from("markers")
    .select("checklist_item_id, control_result")
    .eq("visit_id", visitId);
  const control_summary = computeVisitControlSummary(markers ?? []);
  await supabase.from("visits").update({ control_summary }).eq("id", visitId);
}

export async function uploadMarkerPhoto(
  visitId: string,
  projectId: string,
  markerId: string,
  formData: FormData
) {
  await requireProjectRoles(projectId, ["admin", "gestionnaire", "terrain"]);
  const file = formData.get("photo") as File | null;
  if (!file || file.size === 0) throw new Error("Veuillez sélectionner une photo.");

  const supabase = await createClient();
  const ext = file.name.split(".").pop() ?? "jpg";
  const filePath = `${projectId}/${visitId}/${markerId}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from(PHOTOS_BUCKET)
    .upload(filePath, buffer, { contentType: file.type, upsert: true });

  if (uploadError) throw new Error(uploadError.message);

  const { error } = await supabase
    .from("markers")
    .update({ photo_path: filePath })
    .eq("id", markerId);

  if (error) throw new Error(error.message);

  revalidatePath(`/tablette/projets/${projectId}/visites/${visitId}`);

  const { data } = supabase.storage.from(PHOTOS_BUCKET).getPublicUrl(filePath);
  return data.publicUrl;
}

export async function deleteMarker(visitId: string, projectId: string, markerId: string) {
  await requireProjectRoles(projectId, ["admin", "gestionnaire", "terrain"]);
  const supabase = await createClient();

  const { error } = await supabase.from("markers").delete().eq("id", markerId);
  if (error) throw new Error(error.message);

  revalidatePath(`/tablette/projets/${projectId}/visites/${visitId}`);
}

export async function getMarkerPhotoUrl(photoPath: string) {
  const supabase = await createClient();
  const { data } = supabase.storage.from(PHOTOS_BUCKET).getPublicUrl(photoPath);
  return data.publicUrl;
}
