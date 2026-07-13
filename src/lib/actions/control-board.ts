"use server";

import { revalidatePath } from "next/cache";
import { requireProjectAccess, requireProjectRoles, requireUser } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { generateAndStoreVisitReport } from "@/lib/actions/visit-reports";
import {
  buildVisitEmailHtml,
  buildVisitEmailSubject,
} from "@/lib/notifications/visit-completed";
import { createUserMailDraft } from "@/lib/microsoft/graph";
import { getM365ConnectionPublic } from "@/lib/microsoft/m365-store";
import { isMicrosoftOAuthConfigured } from "@/lib/microsoft/config";
import { isAdminClientConfigured } from "@/lib/supabase/admin";
import { isTokenEncryptionConfigured } from "@/lib/microsoft/crypto";
import type { ControlResult, VisitControlSummary } from "@/lib/types/database";

export type ActionResult<T = void> =
  | ({ ok: true } & (T extends void ? object : T))
  | { ok: false; error: string };

export type PrepareDraftResult =
  | {
      ok: true;
      webLink: string | null;
      subject: string;
      recipients: string[];
      skipped: string[];
    }
  | { ok: false; error: string };

async function safeLogVisitEmail(
  supabase: Awaited<ReturnType<typeof createClient>>,
  row: {
    visit_id: string;
    recipient_email: string;
    enterprise_name: string | null;
    status: "sent" | "failed" | "skipped" | "draft";
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
  draftPrepared: boolean;
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
        .in("status", ["sent", "draft"]),
    ]);

  const emailLogs = emailLogsResult.error ? [] : (emailLogsResult.data ?? []);

  const phaseMap = new Map((phases ?? []).map((p) => [p.id, p.name]));
  const zoneMap = new Map((zones ?? []).map((z) => [z.id, z.name]));
  const reportMap = new Map((reports ?? []).map((r) => [r.visit_id, r.file_path]));
  const draftVisits = new Set(
    (emailLogs ?? []).filter((l) => l.status === "draft").map((l) => l.visit_id)
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
      draftPrepared: draftVisits.has(visit.id),
    };
  });
}

export async function getM365DraftReadiness(): Promise<{
  ready: boolean;
  msEmail: string | null;
  message: string | null;
}> {
  if (!isMicrosoftOAuthConfigured()) {
    return {
      ready: false,
      msEmail: null,
      message: "Microsoft 365 n'est pas configuré sur le serveur (variables Azure).",
    };
  }

  if (!isAdminClientConfigured() || !isTokenEncryptionConfigured()) {
    return {
      ready: false,
      msEmail: null,
      message: "Stockage des tokens M365 non configuré (SUPABASE_SERVICE_ROLE_KEY, TOKEN_ENCRYPTION_KEY).",
    };
  }

  try {
    const user = await requireUser();
    const connection = await getM365ConnectionPublic(user.id);
    if (!connection) {
      return {
        ready: false,
        msEmail: null,
        message: "Connectez votre compte Microsoft 365 dans Profil → Microsoft 365.",
      };
    }
    return { ready: true, msEmail: connection.msEmail, message: null };
  } catch {
    return {
      ready: false,
      msEmail: null,
      message: "Connectez-vous et liez votre compte Microsoft 365 dans Profil.",
    };
  }
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

export async function prepareVisitEmailDraftFromPc(
  projectId: string,
  visitId: string
): Promise<PrepareDraftResult> {
  try {
    await requireProjectRoles(projectId, ["admin", "gestionnaire"]);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Accès refusé.",
    };
  }

  const m365 = await getM365DraftReadiness();
  if (!m365.ready) {
    return { ok: false, error: m365.message ?? "Microsoft 365 non connecté." };
  }

  const user = await requireUser();
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
      error: "La visite doit être terminée sur la tablette avant de préparer le brouillon.",
    };
  }

  const { data: project } = await supabase
    .from("projects")
    .select("name")
    .eq("id", projectId)
    .single();

  let reportPath: string | null = null;
  const { data: report } = await supabase
    .from("visit_reports")
    .select("file_path")
    .eq("visit_id", visitId)
    .maybeSingle();

  reportPath = report?.file_path ?? null;

  if (!reportPath) {
    try {
      const generated = await generateAndStoreVisitReport(projectId, visitId);
      reportPath = generated.filePath;
    } catch (err) {
      return {
        ok: false,
        error:
          err instanceof Error
            ? err.message
            : "Générez d'abord le rapport PDF avant le brouillon.",
      };
    }
  }

  const { data: pdfFile, error: downloadError } = await supabase.storage
    .from("visit-photos")
    .download(reportPath);

  if (downloadError || !pdfFile) {
    return {
      ok: false,
      error: downloadError?.message ?? "Impossible de télécharger le rapport PDF.",
    };
  }

  const pdfBase64 = Buffer.from(await pdfFile.arrayBuffer()).toString("base64");
  const pdfFileName = `Rapport-${(visit.title ?? "visite").replace(/[^\w\-àâäéèêëïîôùûüç ]/gi, "").trim() || visitId}.pdf`;

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
        "Aucune entreprise associée aux réserves. Assignez une entreprise sur les pastilles.",
    };
  }

  const { data: enterprises } = await supabase
    .from("enterprises")
    .select("id, name, contact_email, email_chantier, contact_name")
    .in("id", enterpriseIds);

  const recipients: { email: string; name: string }[] = [];
  const skipped: string[] = [];

  for (const enterprise of enterprises ?? []) {
    const email = enterprise.email_chantier || enterprise.contact_email;
    if (!email) {
      skipped.push(`${enterprise.name} : pas d'email`);
      continue;
    }
    recipients.push({
      email,
      name: enterprise.contact_name || enterprise.name,
    });
  }

  if (!recipients.length) {
    return {
      ok: false,
      error: `Aucun destinataire avec email. ${skipped.join(" · ")}`,
    };
  }

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

  const draftInput = {
    projectName: project?.name ?? "Chantier",
    visitTitle: visit.title ?? "Visite",
    visitDate: visit.visit_date,
    phaseName,
    zoneName,
    controlLabel,
    controlSummary: (visit.control_summary as VisitControlSummary) ?? "pending",
    recipients,
    markerCount: visitMarkers?.length ?? 0,
    nonConformCount,
  };

  try {
    const draft = await createUserMailDraft(user.id, {
      subject: buildVisitEmailSubject(draftInput),
      htmlBody: buildVisitEmailHtml(draftInput),
      to: recipients,
      attachments: [
        {
          name: pdfFileName,
          contentType: "application/pdf",
          contentBytes: pdfBase64,
        },
      ],
    });

    for (const recipient of recipients) {
      await safeLogVisitEmail(supabase, {
        visit_id: visitId,
        recipient_email: recipient.email,
        enterprise_name: recipient.name,
        status: "draft",
      });
    }

    revalidateControlBoard(projectId);

    return {
      ok: true,
      webLink: draft.webLink ?? null,
      subject: buildVisitEmailSubject(draftInput),
      recipients: recipients.map((r) => r.email),
      skipped,
    };
  } catch (err) {
    const raw = err instanceof Error ? err.message : "Erreur inconnue";
    return {
      ok: false,
      error: raw.includes("ErrorAccessDenied")
        ? "Microsoft refuse la création du brouillon. Vérifiez que votre compte M365 a la permission Mail.ReadWrite et reconnectez-le dans Profil."
        : raw,
    };
  }
}
