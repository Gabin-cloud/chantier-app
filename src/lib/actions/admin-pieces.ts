"use server";

import { revalidatePath } from "next/cache";
import {
  requireProjectAccess,
  requireProjectRoles,
  requireUser,
} from "@/lib/auth/permissions";
import {
  aggregateAdminPieceStatuses,
  type AdminPieceStatus,
} from "@/lib/admin-pieces/status";
import { createUserMailDraft, sendUserMail } from "@/lib/microsoft/graph";
import { getM365ConnectionPublic } from "@/lib/microsoft/m365-store";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  AdminPieceTemplate,
  AdminSyntheseData,
  AdminSyntheseRow,
  EnterpriseAdminControlData,
  EnterpriseAdminSubmission,
  ProjectAdminPiece,
} from "@/lib/types/admin-pieces";
import type { Enterprise } from "@/lib/types/database";

const ADMIN_FILES_BUCKET = "financial-files";

function revalidateAdminPaths(projectId: string) {
  revalidatePath(`/pc/projets/${projectId}/tableau-de-bord`);
  revalidatePath(`/pc/projets/${projectId}/marche/synthese`);
  revalidatePath(`/pc/projets/${projectId}/marche/pieces`);
  revalidatePath(`/pc/projets/${projectId}/parametres`);
  revalidatePath(`/pc/referentiels`);
}

function slugifyKey(name: string) {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 60);
}

async function getSubmissionMap(
  projectId: string,
  enterpriseIds: string[]
): Promise<Map<string, EnterpriseAdminSubmission>> {
  if (enterpriseIds.length === 0) return new Map();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("enterprise_admin_submissions")
    .select("*")
    .eq("project_id", projectId)
    .in("enterprise_id", enterpriseIds);

  if (error) throw new Error(error.message);

  const map = new Map<string, EnterpriseAdminSubmission>();
  for (const row of (data ?? []) as EnterpriseAdminSubmission[]) {
    map.set(`${row.enterprise_id}:${row.project_admin_piece_id}`, row);
  }
  return map;
}

/** Garantit OS + AE pour l'opération. */
export async function ensureDefaultProjectAdminPieces(
  projectId: string
): Promise<ProjectAdminPiece[]> {
  await requireProjectAccess(projectId);
  const supabase = await createClient();

  const { data: existing, error: existingError } = await supabase
    .from("project_admin_pieces")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true });

  if (existingError) throw new Error(existingError.message);
  const pieces = (existing ?? []) as ProjectAdminPiece[];

  const hasOs = pieces.some((p) => p.is_os);
  const hasAe = pieces.some((p) => p.is_ae);

  if (hasOs && hasAe) return pieces;

  const { data: templates, error: tplError } = await supabase
    .from("admin_piece_templates")
    .select("*")
    .eq("is_system", true)
    .order("sort_order", { ascending: true });

  if (tplError) throw new Error(tplError.message);

  const toInsert: Array<Record<string, unknown>> = [];
  for (const tpl of (templates ?? []) as AdminPieceTemplate[]) {
    const isOs = tpl.sort_order === 0;
    const isAe = tpl.sort_order === 1;
    if (isOs && hasOs) continue;
    if (isAe && hasAe) continue;
    if (!isOs && !isAe) continue;

    toInsert.push({
      project_id: projectId,
      template_id: tpl.id,
      piece_key: isOs ? "os" : "ae",
      name: isOs ? "OS" : "Acte d'engagement",
      control_notes: tpl.control_notes,
      sort_order: tpl.sort_order,
      is_os: isOs,
      is_ae: isAe,
    });
  }

  if (toInsert.length > 0) {
    const { error: insertError } = await supabase
      .from("project_admin_pieces")
      .insert(toInsert);
    if (insertError) throw new Error(insertError.message);
  }

  const { data: refreshed, error: refreshError } = await supabase
    .from("project_admin_pieces")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true });

  if (refreshError) throw new Error(refreshError.message);
  return (refreshed ?? []) as ProjectAdminPiece[];
}

export async function getAdminPieceTemplates(): Promise<AdminPieceTemplate[]> {
  await requireUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("admin_piece_templates")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as AdminPieceTemplate[];
}

export async function saveAdminPieceTemplate(input: {
  id?: string;
  name: string;
  control_notes: string;
  sort_order: number;
}): Promise<string> {
  await requireUser();

  const supabase = await createClient();
  const payload = {
    name: input.name.trim(),
    control_notes: input.control_notes.trim(),
    sort_order: input.sort_order,
  };

  if (input.id) {
    const { data: existing } = await supabase
      .from("admin_piece_templates")
      .select("is_system")
      .eq("id", input.id)
      .maybeSingle();

    if (existing?.is_system) {
      throw new Error("Les pièces système OS/AE ne peuvent pas être modifiées.");
    }

    const { error } = await supabase
      .from("admin_piece_templates")
      .update(payload)
      .eq("id", input.id);
    if (error) throw new Error(error.message);
    revalidatePath("/pc/referentiels");
    return input.id;
  }

  const { data, error } = await supabase
    .from("admin_piece_templates")
    .insert(payload)
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/pc/referentiels");
  return data.id as string;
}

export async function deleteAdminPieceTemplate(templateId: string) {
  await requireUser();
  const supabase = await createClient();

  const { data: existing } = await supabase
    .from("admin_piece_templates")
    .select("is_system")
    .eq("id", templateId)
    .maybeSingle();

  if (existing?.is_system) {
    throw new Error("Les pièces système OS/AE ne peuvent pas être supprimées.");
  }

  const { error } = await supabase
    .from("admin_piece_templates")
    .delete()
    .eq("id", templateId);

  if (error) throw new Error(error.message);
  revalidatePath("/pc/referentiels");
}

export async function getProjectAdminPieces(
  projectId: string
): Promise<ProjectAdminPiece[]> {
  await requireProjectAccess(projectId);
  return ensureDefaultProjectAdminPieces(projectId);
}

export async function addProjectAdminPieceFromTemplate(
  projectId: string,
  templateId: string
) {
  await requireProjectRoles(projectId, ["admin", "gestionnaire"]);
  const supabase = await createClient();

  const { data: template, error: tplError } = await supabase
    .from("admin_piece_templates")
    .select("*")
    .eq("id", templateId)
    .single();

  if (tplError) throw new Error(tplError.message);
  const tpl = template as AdminPieceTemplate;
  if (tpl.is_system) {
    throw new Error("OS et AE sont déjà configurés par défaut.");
  }

  const pieceKey = `${slugifyKey(tpl.name)}_${templateId.slice(0, 8)}`;

  const { error } = await supabase.from("project_admin_pieces").insert({
    project_id: projectId,
    template_id: templateId,
    piece_key: pieceKey,
    name: tpl.name,
    control_notes: tpl.control_notes,
    sort_order: tpl.sort_order,
    is_os: false,
    is_ae: false,
  });

  if (error) throw new Error(error.message);
  revalidateAdminPaths(projectId);
}

export async function addCustomProjectAdminPiece(
  projectId: string,
  input: { name: string; control_notes: string }
) {
  await requireProjectRoles(projectId, ["admin", "gestionnaire"]);
  const supabase = await createClient();

  const name = input.name.trim();
  if (!name) throw new Error("Le nom de la pièce est obligatoire.");

  const { data: maxRow } = await supabase
    .from("project_admin_pieces")
    .select("sort_order")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const sortOrder = (maxRow?.sort_order ?? 0) + 1;
  const pieceKey = `${slugifyKey(name)}_${Date.now().toString(36)}`;

  const { error } = await supabase.from("project_admin_pieces").insert({
    project_id: projectId,
    template_id: null,
    piece_key: pieceKey,
    name,
    control_notes: input.control_notes.trim(),
    sort_order: sortOrder,
    is_os: false,
    is_ae: false,
  });

  if (error) throw new Error(error.message);
  revalidateAdminPaths(projectId);
}

export async function updateProjectAdminPiece(
  projectId: string,
  pieceId: string,
  input: { name: string; control_notes: string }
) {
  await requireProjectRoles(projectId, ["admin", "gestionnaire"]);
  const supabase = await createClient();

  const { data: piece } = await supabase
    .from("project_admin_pieces")
    .select("is_os, is_ae")
    .eq("id", pieceId)
    .eq("project_id", projectId)
    .maybeSingle();

  const { error } = await supabase
    .from("project_admin_pieces")
    .update({
      name: input.name.trim(),
      control_notes: input.control_notes.trim(),
    })
    .eq("id", pieceId)
    .eq("project_id", projectId);

  if (error) throw new Error(error.message);
  revalidateAdminPaths(projectId);
  return piece;
}

export async function removeProjectAdminPiece(
  projectId: string,
  pieceId: string
) {
  await requireProjectRoles(projectId, ["admin", "gestionnaire"]);
  const supabase = await createClient();

  const { data: piece } = await supabase
    .from("project_admin_pieces")
    .select("is_os, is_ae")
    .eq("id", pieceId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (piece?.is_os || piece?.is_ae) {
    throw new Error("OS et acte d'engagement ne peuvent pas être retirés.");
  }

  const { error } = await supabase
    .from("project_admin_pieces")
    .delete()
    .eq("id", pieceId)
    .eq("project_id", projectId);

  if (error) throw new Error(error.message);
  revalidateAdminPaths(projectId);
}

function buildSyntheseRows(
  enterprises: Enterprise[],
  pieces: ProjectAdminPiece[],
  submissionMap: Map<string, EnterpriseAdminSubmission>
): AdminSyntheseRow[] {
  return enterprises.map((enterprise) => {
    const cells = pieces.map((piece) => {
      const submission =
        submissionMap.get(`${enterprise.id}:${piece.id}`) ?? null;
      const status: AdminPieceStatus = submission?.status ?? "pending";
      return { piece, submission, status };
    });

    const osAeStatuses = cells
      .filter((c) => c.piece.is_os || c.piece.is_ae)
      .map((c) => c.status);
    const otherStatuses = cells
      .filter((c) => !c.piece.is_os && !c.piece.is_ae)
      .map((c) => c.status);

    return {
      enterprise,
      cells,
      osAeStatus: aggregateAdminPieceStatuses(osAeStatuses),
      otherPiecesStatus: aggregateAdminPieceStatuses(otherStatuses),
    };
  });
}

export async function getAdminSyntheseData(
  projectId: string
): Promise<AdminSyntheseData> {
  await requireProjectAccess(projectId);
  const supabase = await createClient();

  const pieces = await ensureDefaultProjectAdminPieces(projectId);

  const { data: enterprises, error } = await supabase
    .from("enterprises")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(error.message);
  const lots = (enterprises ?? []) as Enterprise[];
  const submissionMap = await getSubmissionMap(
    projectId,
    lots.map((l) => l.id)
  );

  return {
    pieces,
    rows: buildSyntheseRows(lots, pieces, submissionMap),
  };
}

export async function getEnterpriseAdminStatuses(
  projectId: string,
  enterpriseIds: string[]
): Promise<
  Record<string, { osAeStatus: AdminPieceStatus; otherPiecesStatus: AdminPieceStatus }>
> {
  await requireProjectAccess(projectId);
  const supabase = await createClient();

  const pieces = await ensureDefaultProjectAdminPieces(projectId);
  const submissionMap = await getSubmissionMap(projectId, enterpriseIds);

  const { data: enterprises } = await supabase
    .from("enterprises")
    .select("*")
    .eq("project_id", projectId)
    .in("id", enterpriseIds);

  const rows = buildSyntheseRows(
    (enterprises ?? []) as Enterprise[],
    pieces,
    submissionMap
  );

  const result: Record<
    string,
    { osAeStatus: AdminPieceStatus; otherPiecesStatus: AdminPieceStatus }
  > = {};
  for (const row of rows) {
    result[row.enterprise.id] = {
      osAeStatus: row.osAeStatus,
      otherPiecesStatus: row.otherPiecesStatus,
    };
  }
  return result;
}

function getPublicFileUrl(filePath: string | null): string | null {
  if (!filePath) return null;
  const supabase = createAdminClient();
  const { data } = supabase.storage.from(ADMIN_FILES_BUCKET).getPublicUrl(filePath);
  return data.publicUrl;
}

export async function getEnterpriseAdminControlData(
  projectId: string,
  enterpriseId: string
): Promise<EnterpriseAdminControlData> {
  await requireProjectAccess(projectId);
  const supabase = await createClient();

  const { data: enterprise, error: entError } = await supabase
    .from("enterprises")
    .select("*")
    .eq("id", enterpriseId)
    .eq("project_id", projectId)
    .single();

  if (entError) throw new Error(entError.message);

  const pieces = await ensureDefaultProjectAdminPieces(projectId);
  const submissionMap = await getSubmissionMap(projectId, [enterpriseId]);

  const enriched = pieces.map((piece) => {
    const submission =
      submissionMap.get(`${enterpriseId}:${piece.id}`) ?? null;
    const status: AdminPieceStatus = submission?.status ?? "pending";
    return {
      piece,
      submission,
      status,
      fileUrl: getPublicFileUrl(submission?.file_path ?? null),
    };
  });

  return {
    enterprise: enterprise as Enterprise,
    pieces: enriched,
  };
}

export async function uploadAdminPieceFile(
  projectId: string,
  enterpriseId: string,
  pieceId: string,
  formData: FormData
) {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: membership } = await supabase
    .from("project_members")
    .select("role, enterprise_id")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();

  const isManager =
    membership?.role === "admin" || membership?.role === "gestionnaire";
  const isEnterprise =
    membership?.role === "entreprise" && membership.enterprise_id === enterpriseId;

  if (!isManager && !isEnterprise) {
    throw new Error("Droits insuffisants pour déposer cette pièce.");
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Fichier invalide.");
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filePath = `${projectId}/admin-pieces/${enterpriseId}/${pieceId}/${Date.now()}_${safeName}`;

  const { error: uploadError } = await supabase.storage
    .from(ADMIN_FILES_BUCKET)
    .upload(filePath, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: true,
    });

  if (uploadError) throw new Error(uploadError.message);

  const { data: existing } = await supabase
    .from("enterprise_admin_submissions")
    .select("id, status")
    .eq("enterprise_id", enterpriseId)
    .eq("project_admin_piece_id", pieceId)
    .maybeSingle();

  const previousStatus = existing?.status as AdminPieceStatus | undefined;

  let nextStatus: AdminPieceStatus = "submitted";
  if (isManager && previousStatus === "validated") {
    nextStatus = "validated";
  } else if (isEnterprise) {
    nextStatus = "submitted";
  } else if (isManager && !existing) {
    nextStatus = "submitted";
  } else if (isManager && previousStatus) {
    nextStatus =
      previousStatus === "validated" ? "validated" : "submitted";
  }

  const payload: Record<string, unknown> = {
    project_id: projectId,
    enterprise_id: enterpriseId,
    project_admin_piece_id: pieceId,
    status: nextStatus,
    file_path: filePath,
    file_name: file.name,
    submitted_at: new Date().toISOString(),
  };

  if (isEnterprise || nextStatus === "submitted") {
    payload.rejection_comment = null;
    payload.reviewed_at = null;
    payload.reviewed_by = null;
  }

  if (existing?.id) {
    const { error } = await supabase
      .from("enterprise_admin_submissions")
      .update(payload)
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("enterprise_admin_submissions").insert({
      ...payload,
      rejection_comment: null,
      reviewed_at: null,
      reviewed_by: null,
    });
    if (error) throw new Error(error.message);
  }

  revalidateAdminPaths(projectId);
}

export async function reviewAdminPieceSubmission(
  projectId: string,
  enterpriseId: string,
  pieceId: string,
  input: { status: "validated" | "rejected"; rejection_comment?: string }
) {
  await requireProjectRoles(projectId, ["admin", "gestionnaire"]);
  const user = await requireUser();
  const supabase = await createClient();

  if (input.status === "rejected" && !input.rejection_comment?.trim()) {
    throw new Error("Un commentaire est obligatoire pour refuser une pièce.");
  }

  const { data: existing } = await supabase
    .from("enterprise_admin_submissions")
    .select("id, file_path")
    .eq("enterprise_id", enterpriseId)
    .eq("project_admin_piece_id", pieceId)
    .maybeSingle();

  if (!existing?.file_path && input.status === "validated") {
    throw new Error("Aucun fichier déposé — impossible de valider.");
  }

  const payload = {
    project_id: projectId,
    enterprise_id: enterpriseId,
    project_admin_piece_id: pieceId,
    status: input.status,
    rejection_comment:
      input.status === "rejected" ? input.rejection_comment?.trim() ?? null : null,
    reviewed_at: new Date().toISOString(),
    reviewed_by: user.id,
  };

  if (existing?.id) {
    const { error } = await supabase
      .from("enterprise_admin_submissions")
      .update(payload)
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else if (input.status === "rejected") {
    const { error } = await supabase.from("enterprise_admin_submissions").insert({
      ...payload,
      file_path: null,
      file_name: null,
      submitted_at: null,
    });
    if (error) throw new Error(error.message);
  }

  revalidateAdminPaths(projectId);
}

export type AdminPiecesEmailPreview = {
  subject: string;
  htmlBody: string;
  recipients: { email: string; name: string }[];
  defaultCc: string;
};

export async function previewAdminPiecesRejectionEmail(
  projectId: string,
  enterpriseId: string
): Promise<
  { ok: true; preview: AdminPiecesEmailPreview } | { ok: false; error: string }
> {
  try {
    await requireProjectRoles(projectId, ["admin", "gestionnaire"]);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Accès refusé.",
    };
  }

  const control = await getEnterpriseAdminControlData(projectId, enterpriseId);

  const nonValidated = control.pieces.filter((p) => p.status !== "validated");
  if (nonValidated.length === 0) {
    return { ok: false, error: "Toutes les pièces sont validées." };
  }

  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("name")
    .eq("id", projectId)
    .single();

  const email =
    control.enterprise.email_administratif ??
    control.enterprise.contact_email ??
    control.enterprise.email_travaux ??
    "";

  if (!email) {
    return {
      ok: false,
      error: "Aucune adresse e-mail administratif renseignée pour cette entreprise.",
    };
  }

  const listItems = nonValidated
    .map((p) => {
      const comment =
        p.submission?.rejection_comment ??
        (p.status === "pending" ? "Pièce non transmise" : "À corriger");
      return `<li><strong>${p.piece.name}</strong> — ${comment}</li>`;
    })
    .join("");

  const htmlBody = `<p>Bonjour,</p>
<p>Suite à notre contrôle administratif sur l'opération <strong>${project?.name ?? ""}</strong>, merci de bien vouloir reprendre les pièces suivantes :</p>
<ul>${listItems}</ul>
<p>Cordialement,<br/>DANOBAT</p>`;

  return {
    ok: true,
    preview: {
      subject: `[${project?.name ?? "Chantier"}] Pièces administratives — compléments à déposer`,
      htmlBody,
      recipients: [{ email, name: control.enterprise.name }],
      defaultCc: "",
    },
  };
}

export async function sendAdminPiecesRejectionEmail(
  projectId: string,
  enterpriseId: string,
  input: { subject: string; htmlBody: string; recipients: { email: string; name: string }[]; cc?: string }
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    await requireProjectRoles(projectId, ["admin", "gestionnaire"]);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Accès refusé.",
    };
  }

  const user = await requireUser();
  const m365 = await getM365ConnectionPublic(user.id);
  if (!m365) {
    return {
      ok: false,
      error: "Connectez Microsoft 365 dans Profil pour envoyer le mail.",
    };
  }

  try {
    await sendUserMail(user.id, {
      subject: input.subject.trim(),
      htmlBody: input.htmlBody.trim(),
      to: input.recipients,
      cc: input.cc
        ? input.cc.split(",").map((e) => ({ email: e.trim() })).filter((r) => r.email)
        : undefined,
    });
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Erreur lors de l'envoi.",
    };
  }
}

export async function createAdminPiecesRejectionDraft(
  projectId: string,
  enterpriseId: string,
  input: { subject: string; htmlBody: string; recipients: { email: string; name: string }[]; cc?: string }
): Promise<{ ok: true; webLink: string | null } | { ok: false; error: string }> {
  try {
    await requireProjectRoles(projectId, ["admin", "gestionnaire"]);
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Accès refusé.",
    };
  }

  const user = await requireUser();
  const m365 = await getM365ConnectionPublic(user.id);
  if (!m365) {
    return {
      ok: false,
      error: "Connectez Microsoft 365 dans Profil pour créer un brouillon.",
    };
  }

  try {
    const draft = await createUserMailDraft(user.id, {
      subject: input.subject.trim(),
      htmlBody: input.htmlBody.trim(),
      to: input.recipients,
      cc: input.cc
        ? input.cc.split(",").map((e) => ({ email: e.trim() })).filter((r) => r.email)
        : undefined,
    });
    return { ok: true, webLink: draft.webLink ?? null };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Erreur lors de la création du brouillon.",
    };
  }
}
