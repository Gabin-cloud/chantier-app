"use server";

import { revalidatePath } from "next/cache";
import { requireProjectAccess, requireProjectRoles } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import type { MarkerUpdateData, MarkerWithLinks, VisitFormData } from "@/lib/types/database";

const PHOTOS_BUCKET = "visit-photos";

async function getMarkerLinks(supabase: Awaited<ReturnType<typeof createClient>>, visitId: string) {
  const { data: markers } = await supabase
    .from("markers")
    .select("id")
    .eq("visit_id", visitId);

  if (!markers?.length) return new Map<string, string[]>();

  const markerIds = markers.map((m) => m.id);

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

  const { data: markers, error: markersError } = await supabase
    .from("markers")
    .select("*")
    .eq("visit_id", visitId)
    .order("marker_number", { ascending: true });

  if (markersError) throw new Error(markersError.message);

  const linkMap = await getMarkerLinks(supabase, visitId);

  const markersWithLinks: MarkerWithLinks[] = (markers ?? []).map((marker) => ({
    ...marker,
    linked_marker_ids: linkMap.get(marker.id) ?? [],
  }));

  return { visit, markers: markersWithLinks };
}

export async function createVisit(projectId: string, formData: VisitFormData) {
  await requireProjectRoles(projectId, ["admin", "gestionnaire", "terrain"]);
  const supabase = await createClient();

  const title =
    formData.title?.trim() ||
    `Visite du ${new Date(formData.visit_date ?? Date.now()).toLocaleDateString("fr-FR")}`;

  const { data, error } = await supabase
    .from("visits")
    .insert({
      project_id: projectId,
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
  const { error } = await supabase
    .from("visits")
    .update({ status: "completed" })
    .eq("id", visitId);

  if (error) throw new Error(error.message);

  revalidatePath(`/tablette/projets/${projectId}/visites`);
  revalidatePath(`/tablette/projets/${projectId}/visites/${visitId}`);
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

  const { count, error: countError } = await supabase
    .from("markers")
    .select("*", { count: "exact", head: true })
    .eq("visit_id", visitId);

  if (countError) throw new Error(countError.message);

  const markerNumber = (count ?? 0) + 1;

  const { data, error } = await supabase
    .from("markers")
    .insert({
      visit_id: visitId,
      plan_id: planId,
      x_percent: xPercent,
      y_percent: yPercent,
      marker_number: markerNumber,
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

  revalidatePath(`/tablette/projets/${projectId}/visites/${visitId}`);
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
