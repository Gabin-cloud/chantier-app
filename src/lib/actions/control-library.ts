"use server";

import { revalidatePath } from "next/cache";
import { requireProjectRoles } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { findOrCreatePhaseZone } from "@/lib/actions/zones";
import { ensureDefaultPhases } from "@/lib/actions/phases";
import type { ControlLibraryItem } from "@/lib/types/database";

export async function getControlLibrary(): Promise<ControlLibraryItem[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("control_library_items")
    .select("*")
    .order("sort_order", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function importControlLibraryToProject(projectId: string) {
  await requireProjectRoles(projectId, ["admin", "gestionnaire"]);
  const supabase = await createClient();

  const library = await getControlLibrary();
  if (!library.length) throw new Error("La bibliothèque de contrôles est vide.");

  const phases = await ensureDefaultPhases(projectId);
  const phaseByName = new Map(phases.map((p) => [p.name.toLowerCase(), p]));

  let imported = 0;

  for (const item of library) {
    const phase =
      phaseByName.get(item.phase_name.toLowerCase()) ??
      phases.find((p) => p.name.toLowerCase().includes(item.phase_name.toLowerCase().split(" ")[0] ?? "")) ??
      phases[0];

    if (!phase) continue;

    const zone = await findOrCreatePhaseZone(phase.id, item.zone_name);

    const { data: existing } = await supabase
      .from("phase_checklist_items")
      .select("id")
      .eq("phase_id", phase.id)
      .eq("zone_id", zone.id)
      .eq("label", item.label)
      .maybeSingle();

    if (existing) continue;

    const { data: last } = await supabase
      .from("phase_checklist_items")
      .select("sort_order")
      .eq("phase_id", phase.id)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { error } = await supabase.from("phase_checklist_items").insert({
      phase_id: phase.id,
      zone_id: zone.id,
      zone_name: item.zone_name,
      label: item.label,
      sort_order: (last?.sort_order ?? 0) + 1,
    });

    if (!error) imported++;
  }

  revalidatePath(`/tablette/projets/${projectId}/parametres`);
  revalidatePath(`/pc/projets/${projectId}/parametres`);

  return { imported, total: library.length };
}
