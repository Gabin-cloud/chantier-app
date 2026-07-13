"use server";

import { revalidatePath } from "next/cache";
import { requireProjectAccess, requireProjectRoles } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { generateAndStoreVisitReport } from "@/lib/actions/visit-reports";
import { sendVisitCompletedEmail } from "@/lib/notifications/visit-completed";
import {
  getNotificationSenderEmail,
} from "@/lib/microsoft/config";
import type { ControlResult, VisitControlSummary } from "@/lib/types/database";

export type ActionResult<T = void> =
  | ({ ok: true } & (T extends void ? object : T))
  | { ok: false; error: string };

export type SendEmailsResult =
  | { ok: true; sentCount: number; skipped: string[]; failures: string[] }
  | { ok: false; error: string; failures?: string[] };

async function safeLogVisitEmail(
  supabase: Awaited<ReturnType<typeof createClient>>,
  row: {
    visit_id: string;
    recipient_email: string;
    enterprise_name: string | null;
    status: "sent" | "failed" | "skipped";
    error_message?: string | null;
  }
) {
  const { error } = await supabase.from("visit_email_logs").insert(row);
  if (error) {
    console.error("[visit_email_logs]", error.message);
  }
}

export type ControlBoardRow = {
  phaseId: string;
  phaseName: string;
  phaseSortOrder: number;
  zoneId: string | null;
  zoneName: string;
  itemId: string;
  itemLabel: string;
  controlDate: string | null;
  controlResult: ControlResult | null;
  enterpriseId: string | null;
  enterpriseName: string | null;
  visitId: string | null;
  reportUrl: string | null;
  attestationDate: string | null;
  nonConformityResolved: boolean;
  trackingId: string | null;
};

function revalidateControlBoard(projectId: string) {
  revalidatePath(`/pc/projets/${projectId}/controles`);
  revalidatePath(`/pc/projets/${projectId}/rapports`);
}

export async function getProjectControlBoard(
  projectId: string
): Promise<ControlBoardRow[]> {
  await requireProjectAccess(projectId);
  const supabase = await createClient();

  const { data: phases } = await supabase
    .from("visit_phases")
    .select("id, name, sort_order")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true });

  if (!phases?.length) return [];

  const phaseIds = phases.map((p) => p.id);
  const { data: items } = await supabase
    .from("phase_checklist_items")
    .select("*")
    .in("phase_id", phaseIds)
    .order("sort_order", { ascending: true });

  if (!items?.length) return [];

  const { data: markers } = await supabase
    .from("markers")
    .select(
      "id, phase_id, checklist_item_id, control_result, enterprise_id, visit_id, created_at"
    )
    .in("phase_id", phaseIds)
    .not("checklist_item_id", "is", null)
    .order("created_at", { ascending: false });

  const visitIds = [
    ...new Set((markers ?? []).map((m) => m.visit_id).filter(Boolean) as string[]),
  ];

  const { data: visits } = visitIds.length
    ? await supabase
        .from("visits")
        .select("id, visit_date")
        .in("id", visitIds)
    : { data: [] };

  const visitDateMap = new Map((visits ?? []).map((v) => [v.id, v.visit_date]));

  const { data: reports } = visitIds.length
    ? await supabase
        .from("visit_reports")
        .select("visit_id, file_path")
        .in("visit_id", visitIds)
    : { data: [] };

  const reportPathMap = new Map((reports ?? []).map((r) => [r.visit_id, r.file_path]));

  const { data: enterprises } = await supabase
    .from("enterprises")
    .select("id, name")
    .eq("project_id", projectId);

  const { data: zones } = await supabase
    .from("phase_zones")
    .select("id, name, phase_id")
    .in("phase_id", phaseIds);

  const itemIds = items.map((i) => i.id);
  const { data: trackingRows, error: trackingError } = await supabase
    .from("control_point_tracking")
    .select("*")
    .in("checklist_item_id", itemIds);

  const trackingMap = trackingError
    ? new Map<string, never>()
    : new Map((trackingRows ?? []).map((t) => [t.checklist_item_id, t]));

  const enterpriseMap = new Map((enterprises ?? []).map((e) => [e.id, e.name]));
  const zoneMap = new Map((zones ?? []).map((z) => [z.id, z]));
  const phaseMap = new Map(phases.map((p) => [p.id, p]));

  const latestMarkerByItem = new Map<
    string,
    {
      checklist_item_id: string | null;
      control_result: string | null;
      enterprise_id: string | null;
      visit_id: string;
      created_at: string;
    }
  >();
  for (const marker of markers ?? []) {
    if (!marker.checklist_item_id) continue;
    if (!latestMarkerByItem.has(marker.checklist_item_id)) {
      latestMarkerByItem.set(marker.checklist_item_id, marker);
    }
  }

  return items.map((item) => {
    const latest = latestMarkerByItem.get(item.id);
    const tracking = trackingMap.get(item.id);
    const zone = item.zone_id ? zoneMap.get(item.zone_id) : null;
    const phase = phaseMap.get(item.phase_id);
    const visitId = tracking?.visit_id ?? latest?.visit_id ?? null;
    const controlDate =
      tracking?.control_date ??
      (visitId ? visitDateMap.get(visitId) ?? null : null) ??
      (latest ? latest.created_at.slice(0, 10) : null);
    const controlResult =
      (tracking?.control_result as ControlResult | null) ??
      (latest?.control_result as ControlResult | null) ??
      null;
    const enterpriseId = tracking?.enterprise_id ?? latest?.enterprise_id ?? null;

    let reportUrl: string | null = null;
    if (visitId && reportPathMap.has(visitId)) {
      const path = reportPathMap.get(visitId)!;
      const { data } = supabase.storage.from("visit-photos").getPublicUrl(path);
      reportUrl = data.publicUrl;
    }

    return {
      phaseId: item.phase_id,
      phaseName: phase?.name ?? "Phase",
      phaseSortOrder: phase?.sort_order ?? 0,
      zoneId: item.zone_id,
      zoneName:
        zone?.name ?? item.zone_name ?? "Général",
      itemId: item.id,
      itemLabel: item.label,
      controlDate,
      controlResult,
      enterpriseId,
      enterpriseName: enterpriseId ? enterpriseMap.get(enterpriseId) ?? null : null,
      visitId,
      reportUrl,
      attestationDate: tracking?.attestation_date ?? null,
      nonConformityResolved: tracking?.non_conformity_resolved ?? false,
      trackingId: tracking?.id ?? null,
    };
  });
}

export async function updateControlPointTracking(
  projectId: string,
  checklistItemId: string,
  data: {
    attestation_date?: string | null;
    non_conformity_resolved?: boolean;
    notes?: string | null;
  }
) {
  await requireProjectRoles(projectId, ["admin", "gestionnaire"]);
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("control_point_tracking")
    .select("id")
    .eq("checklist_item_id", checklistItemId)
    .maybeSingle();

  const payload = {
    checklist_item_id: checklistItemId,
    attestation_date: data.attestation_date || null,
    non_conformity_resolved: data.non_conformity_resolved ?? false,
    notes: data.notes?.trim() || null,
    updated_at: new Date().toISOString(),
  };

  if (existing) {
    const { error } = await supabase
      .from("control_point_tracking")
      .update(payload)
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("control_point_tracking").insert(payload);
    if (error) throw new Error(error.message);
  }

  revalidateControlBoard(projectId);
}

export async function syncControlBoardFromMarkers(projectId: string) {
  await requireProjectRoles(projectId, ["admin", "gestionnaire"]);
  const supabase = await createClient();

  const { data: phases } = await supabase
    .from("visit_phases")
    .select("id")
    .eq("project_id", projectId);

  if (!phases?.length) return;

  const phaseIds = phases.map((p) => p.id);
  const { data: items } = await supabase
    .from("phase_checklist_items")
    .select("id")
    .in("phase_id", phaseIds);

  if (!items?.length) return;

  const { data: markers } = await supabase
    .from("markers")
    .select("checklist_item_id, control_result, enterprise_id, visit_id, created_at")
    .in("phase_id", phaseIds)
    .not("checklist_item_id", "is", null)
    .order("created_at", { ascending: false });

  const visitIds = [
    ...new Set((markers ?? []).map((m) => m.visit_id).filter(Boolean) as string[]),
  ];
  const { data: visits } = visitIds.length
    ? await supabase.from("visits").select("id, visit_date").in("id", visitIds)
    : { data: [] };
  const visitDateMap = new Map((visits ?? []).map((v) => [v.id, v.visit_date]));

  const latestByItem = new Map<
    string,
    {
      checklist_item_id: string | null;
      control_result: string | null;
      enterprise_id: string | null;
      visit_id: string;
      created_at: string;
    }
  >();
  for (const m of markers ?? []) {
    if (!m.checklist_item_id || latestByItem.has(m.checklist_item_id)) continue;
    latestByItem.set(m.checklist_item_id, m);
  }

  for (const item of items) {
    const latest = latestByItem.get(item.id);
    if (!latest) continue;

    const visitDate = latest.visit_id
      ? visitDateMap.get(latest.visit_id) ?? latest.created_at.slice(0, 10)
      : latest.created_at.slice(0, 10);

    await supabase.from("control_point_tracking").upsert(
      {
        checklist_item_id: item.id,
        visit_id: latest.visit_id,
        control_date: visitDate,
        control_result: latest.control_result,
        enterprise_id: latest.enterprise_id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "checklist_item_id" }
    );
  }

  revalidateControlBoard(projectId);
}

export type PcVisitRow = {
  id: string;
  title: string | null;
  visit_date: string;
  status: string;
  control_summary: VisitControlSummary | null;
  phaseName: string | null;
  zoneName: string | null;
  reportUrl: string | null;
  emailSent: boolean;
};

export async function getPcVisitReports(projectId: string): Promise<PcVisitRow[]> {
  await requireProjectAccess(projectId);
  const supabase = await createClient();

  const { data: visits } = await supabase
    .from("visits")
    .select("*")
    .eq("project_id", projectId)
    .order("visit_date", { ascending: false });

  if (!visits?.length) return [];

  const visitIds = visits.map((v) => v.id);
  const phaseIds = [...new Set(visits.map((v) => v.phase_id).filter(Boolean) as string[])];
  const zoneIds = [...new Set(visits.map((v) => v.zone_id).filter(Boolean) as string[])];

  const [{ data: phases }, { data: zones }, { data: reports }, emailLogsResult] =
    await Promise.all([
      phaseIds.length
        ? supabase.from("visit_phases").select("id, name").in("id", phaseIds)
        : Promise.resolve({ data: [] }),
      zoneIds.length
        ? supabase.from("phase_zones").select("id, name").in("id", zoneIds)
        : Promise.resolve({ data: [] }),
      supabase.from("visit_reports").select("visit_id, file_path").in("visit_id", visitIds),
      supabase
        .from("visit_email_logs")
        .select("visit_id, status")
        .in("visit_id", visitIds)
        .eq("status", "sent"),
    ]);

  const emailLogs = emailLogsResult.error ? [] : (emailLogsResult.data ?? []);

  const phaseMap = new Map((phases ?? []).map((p) => [p.id, p.name]));
  const zoneMap = new Map((zones ?? []).map((z) => [z.id, z.name]));
  const reportMap = new Map((reports ?? []).map((r) => [r.visit_id, r.file_path]));
  const emailedVisits = new Set(
    (emailLogs ?? []).map((l) => l.visit_id)
  );

  return visits.map((visit) => {
    let reportUrl: string | null = null;
    if (reportMap.has(visit.id)) {
      const { data } = supabase.storage
        .from("visit-photos")
        .getPublicUrl(reportMap.get(visit.id)!);
      reportUrl = data.publicUrl;
    }

    return {
      id: visit.id,
      title: visit.title,
      visit_date: visit.visit_date,
      status: visit.status,
      control_summary: visit.control_summary,
      phaseName: visit.phase_id ? phaseMap.get(visit.phase_id) ?? null : null,
      zoneName: visit.zone_id ? zoneMap.get(visit.zone_id) ?? null : null,
      reportUrl,
      emailSent: emailedVisits.has(visit.id),
    };
  });
}

export async function getEmailSetupStatus(): Promise<{
  configured: boolean;
  missing: string[];
}> {
  const missing: string[] = [];
  if (!process.env.AZURE_CLIENT_ID) missing.push("AZURE_CLIENT_ID");
  if (!process.env.AZURE_CLIENT_SECRET) missing.push("AZURE_CLIENT_SECRET");
  if (!process.env.AZURE_TENANT_ID) missing.push("AZURE_TENANT_ID");
  if (!getNotificationSenderEmail()) missing.push("NOTIFICATION_SENDER_EMAIL");
  return { configured: missing.length === 0, missing };
}

export async function generateVisitReportFromPc(
  projectId: string,
  visitId: string
): Promise<ActionResult<{ publicUrl: string }>> {
  try {
    await requireProjectRoles(projectId, ["admin", "gestionnaire"]);
    const result = await generateAndStoreVisitReport(projectId, visitId);
    try {
      await syncControlBoardFromMarkers(projectId);
    } catch {
      // migration 012 optionnelle
    }
    revalidateControlBoard(projectId);
    return { ok: true, publicUrl: result.publicUrl };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Impossible de générer le rapport PDF.",
    };
  }
}

export async function sendVisitEmailsFromPc(
  projectId: string,
  visitId: string
): Promise<SendEmailsResult> {
  try {
    await requireProjectRoles(projectId, ["admin", "gestionnaire"]);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Accès refusé.",
    };
  }

  const setup = await getEmailSetupStatus();
  if (!setup.configured) {
    return {
      ok: false,
      error: `Configuration email incomplète sur le serveur. Variables manquantes : ${setup.missing.join(", ")}. Ajoutez-les dans Vercel (Settings → Environment Variables).`,
    };
  }

  const supabase = await createClient();

  const { data: visit, error: visitError } = await supabase
    .from("visits")
    .select("*")
    .eq("id", visitId)
    .single();

  if (visitError || !visit) {
    return { ok: false, error: visitError?.message ?? "Visite introuvable." };
  }

  if (visit.status !== "completed") {
    return {
      ok: false,
      error: "La visite doit être terminée sur la tablette avant d'envoyer les emails.",
    };
  }

  const { data: project } = await supabase
    .from("projects")
    .select("name")
    .eq("id", projectId)
    .single();

  let reportUrl: string | null = null;
  const { data: report } = await supabase
    .from("visit_reports")
    .select("file_path")
    .eq("visit_id", visitId)
    .maybeSingle();

  if (report?.file_path) {
    const { data } = supabase.storage.from("visit-photos").getPublicUrl(report.file_path);
    reportUrl = data.publicUrl;
  }

  const { data: visitMarkers } = await supabase
    .from("markers")
    .select("enterprise_id, control_result")
    .eq("visit_id", visitId);

  const enterpriseIds = [
    ...new Set(
      (visitMarkers ?? [])
        .map((m) => m.enterprise_id)
        .filter((id): id is string => Boolean(id))
    ),
  ];

  if (!enterpriseIds.length) {
    return {
      ok: false,
      error:
        "Aucune entreprise n'est associée aux réserves de cette visite. Assignez une entreprise sur les pastilles avant d'envoyer.",
    };
  }

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

  let sentCount = 0;
  const skipped: string[] = [];
  const failures: string[] = [];

  for (const enterprise of enterprises ?? []) {
    const email = enterprise.email_chantier || enterprise.contact_email;
    if (!email) {
      skipped.push(`${enterprise.name} : pas d'email renseigné`);
      await safeLogVisitEmail(supabase, {
        visit_id: visitId,
        recipient_email: "—",
        enterprise_name: enterprise.name,
        status: "skipped",
        error_message: "Pas d'email renseigné",
      });
      continue;
    }

    try {
      await sendVisitCompletedEmail({
        projectName: project?.name ?? "Chantier",
        visitTitle: visit.title ?? "Visite",
        visitDate: visit.visit_date,
        phaseName,
        zoneName,
        controlLabel,
        controlSummary: (visit.control_summary as VisitControlSummary) ?? "pending",
        recipientEmail: email,
        recipientName: enterprise.contact_name || enterprise.name,
        markerCount: visitMarkers?.length ?? 0,
        nonConformCount,
        reportUrl,
      });

      await safeLogVisitEmail(supabase, {
        visit_id: visitId,
        recipient_email: email,
        enterprise_name: enterprise.name,
        status: "sent",
      });
      sentCount++;
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Erreur inconnue";
      const msg = raw.includes("ErrorAccessDenied")
        ? "Microsoft Graph refuse l'envoi. Vérifiez dans Azure : permission Mail.Send (Application) + consentement admin, et que NOTIFICATION_SENDER_EMAIL est une boîte mail du tenant."
        : raw;
      failures.push(`${enterprise.name} (${email}) : ${msg}`);
      await safeLogVisitEmail(supabase, {
        visit_id: visitId,
        recipient_email: email,
        enterprise_name: enterprise.name,
        status: "failed",
        error_message: msg,
      });
    }
  }

  if (sentCount === 0) {
    const details = [...skipped, ...failures].join(" · ");
    return {
      ok: false,
      error: details
        ? `Aucun email envoyé. ${details}`
        : "Aucun email n'a pu être envoyé.",
      failures: [...skipped, ...failures],
    };
  }

  revalidateControlBoard(projectId);
  return { ok: true, sentCount, skipped, failures };
}
