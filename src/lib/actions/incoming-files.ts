"use server";

import { requireFinanceAccess } from "@/lib/actions/members";
import { canAccessFinance } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/permissions";
import {
  buildEnterpriseFolderName,
  buildPlanExeFileName,
  cleanSharePointRelativePath,
  normalizeSharePointPath,
  uploadToSharePoint,
} from "@/lib/microsoft/sharepoint";
import { createClient } from "@/lib/supabase/server";
import type {
  IncomingFile,
  IncomingFileCategory,
  IncomingFileWithDetails,
} from "@/lib/types/database";
import { INCOMING_FILE_CATEGORY_LABELS } from "@/lib/types/database";

const FINANCIAL_BUCKET = "financial-files";

export type ClassifyIncomingFileResult =
  | { ok: true; id: string; fileName: string; sharepointUrl?: string | null }
  | { ok: false; error: string };

export type FinanceProjectOption = {
  id: string;
  name: string;
};

export async function getFinanceProjects(): Promise<FinanceProjectOption[]> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data: profile } = await supabase
    .from("profiles")
    .select("global_role")
    .eq("id", user.id)
    .single();

  if (profile?.global_role === "super_admin") {
    const { data, error } = await supabase
      .from("projects")
      .select("id, name")
      .order("updated_at", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  }

  const { data: memberships, error } = await supabase
    .from("project_members")
    .select("role, projects!inner(id, name)")
    .eq("user_id", user.id);

  if (error) throw new Error(error.message);

  const projects: FinanceProjectOption[] = [];
  const seen = new Set<string>();
  for (const row of memberships ?? []) {
    // Outlook : finance OU terrain/gestion (attestation NC)
    const allowed =
      canAccessFinance(row.role) ||
      row.role === "admin" ||
      row.role === "gestionnaire" ||
      row.role === "terrain";
    if (!allowed) continue;
    const project = row.projects as FinanceProjectOption | FinanceProjectOption[] | null;
    const list = Array.isArray(project) ? project : project ? [project] : [];
    for (const p of list) {
      if (seen.has(p.id)) continue;
      seen.add(p.id);
      projects.push(p);
    }
  }

  return projects.sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

async function logAudit(
  projectId: string,
  enterpriseId: string | null,
  entityType: string,
  entityId: string | null,
  action: string,
  summary: string
) {
  const supabase = await createClient();
  await supabase.from("financial_audit_log").insert({
    project_id: projectId,
    enterprise_id: enterpriseId,
    entity_type: entityType,
    entity_id: entityId,
    action,
    summary,
  });
}

export type QuickSortLot = {
  id: string;
  name: string;
  lot_number: string | null;
  designation: string | null;
  situations: {
    id: string;
    situation_number: number;
    situation_date: string;
    has_invoice: boolean;
  }[];
};

export async function getQuickSortData(projectId: string): Promise<QuickSortLot[]> {
  await requireFinanceAccess(projectId);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("enterprises")
    .select("id, name, lot_number, designation, financial_situations(id, situation_number, situation_date, invoice_file_path)")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(error.message);

  return (data ?? [])
    .map((lot) => ({
      id: lot.id,
      name: lot.name,
      lot_number: lot.lot_number,
      designation: lot.designation,
      situations: (lot.financial_situations ?? [])
        .sort(
          (a: { situation_number: number }, b: { situation_number: number }) =>
            b.situation_number - a.situation_number
        )
        .map(
          (s: {
            id: string;
            situation_number: number;
            situation_date: string;
            invoice_file_path: string | null;
          }) => ({
            id: s.id,
            situation_number: s.situation_number,
            situation_date: s.situation_date,
            has_invoice: Boolean(s.invoice_file_path),
          })
        ),
    }))
    .sort((a, b) =>
      (a.lot_number ?? "").localeCompare(b.lot_number ?? "", "fr", {
        numeric: true,
      })
    );
}

export async function getIncomingFiles(
  projectId: string
): Promise<IncomingFileWithDetails[]> {
  await requireFinanceAccess(projectId);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("incoming_files")
    .select(
      `*,
      enterprise:enterprises(name, lot_number),
      situation:financial_situations(situation_number)`
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);

  return (data ?? []).map((row) => ({
    id: row.id,
    project_id: row.project_id,
    enterprise_id: row.enterprise_id,
    situation_id: row.situation_id,
    category: row.category,
    file_path: row.file_path,
    file_name: row.file_name,
    storage_provider: row.storage_provider ?? "supabase",
    external_url: row.external_url ?? null,
    external_item_id: row.external_item_id ?? null,
    source_email: row.source_email,
    notes: row.notes,
    created_by: row.created_by,
    created_at: row.created_at,
    enterprise_name: row.enterprise?.name ?? null,
    lot_number: row.enterprise?.lot_number ?? null,
    situation_number: row.situation?.situation_number ?? null,
  }));
}

export async function classifyIncomingFile(
  projectId: string,
  formData: FormData
): Promise<ClassifyIncomingFileResult> {
  try {
    await requireFinanceAccess(projectId);

    const file = formData.get("file") as File | null;
    const category = formData.get("category") as IncomingFileCategory | null;
    const enterpriseId = (formData.get("enterpriseId") as string) || null;
    const situationId = (formData.get("situationId") as string) || null;
    const sourceEmail = (formData.get("sourceEmail") as string)?.trim() || null;
    const notes = (formData.get("notes") as string)?.trim() || null;

    if (!file || file.size === 0) {
      return { ok: false, error: "Veuillez sélectionner un fichier." };
    }
    if (!category) {
      return { ok: false, error: "Veuillez choisir une catégorie." };
    }
    if (!enterpriseId) {
      return { ok: false, error: "Veuillez sélectionner un lot." };
    }
    if (category === "facture" && !situationId) {
      return { ok: false, error: "Veuillez sélectionner une situation pour une facture." };
    }

    const lowerName = file.name.toLowerCase();
    const isPdf =
      file.type === "application/pdf" || lowerName.endsWith(".pdf");
    const isImage = file.type.startsWith("image/");
    const isOffice =
      lowerName.endsWith(".doc") ||
      lowerName.endsWith(".docx") ||
      lowerName.endsWith(".xls") ||
      lowerName.endsWith(".xlsx");
    const isPlanCad =
      lowerName.endsWith(".dwg") ||
      lowerName.endsWith(".dxf") ||
      lowerName.endsWith(".ifc");

    if (category === "plan_exe") {
      if (!isPdf && !isPlanCad) {
        return {
          ok: false,
          error: "Plans d'exé : formats acceptés PDF, DWG, DXF, IFC.",
        };
      }
    } else if (!isPdf && !isImage && !isOffice) {
      return { ok: false, error: "Formats acceptés : PDF, images, Word, Excel." };
    }

    const supabase = await createClient();
    const buffer = Buffer.from(await file.arrayBuffer());
    const {
      data: { user },
    } = await supabase.auth.getUser();

    let filePath: string;
    let fileName = file.name;
    let storageProvider: IncomingFile["storage_provider"] = "supabase";
    let externalUrl: string | null = null;
    let externalItemId: string | null = null;

    if (category === "plan_exe") {
      const { data: project, error: projectError } = await supabase
        .from("projects")
        .select("sharepoint_plan_exe_path")
        .eq("id", projectId)
        .single();

      if (projectError) return { ok: false, error: projectError.message };
      if (!project?.sharepoint_plan_exe_path?.trim()) {
        return {
          ok: false,
          error:
            "Chemin SharePoint des plans d'exé non configuré pour ce chantier. Renseignez-le dans Paramètres du projet.",
        };
      }

      const { data: enterprise, error: enterpriseError } = await supabase
        .from("enterprises")
        .select("name, lot_number, designation, sharepoint_folder_name")
        .eq("id", enterpriseId)
        .eq("project_id", projectId)
        .single();

      if (enterpriseError || !enterprise) {
        return { ok: false, error: "Lot / entreprise introuvable." };
      }

      const enterpriseFolder = buildEnterpriseFolderName(enterprise);
      const folderPath = normalizeSharePointPath(
        cleanSharePointRelativePath(project.sharepoint_plan_exe_path.trim()),
        enterpriseFolder
      );
      const targetFileName = buildPlanExeFileName(file.name);

      const upload = await uploadToSharePoint({
        folderPath,
        fileName: targetFileName,
        content: buffer,
        contentType: file.type || "application/octet-stream",
        userId: user?.id ?? undefined,
      });

      filePath = upload.relativePath;
      fileName = upload.fileName;
      storageProvider = "sharepoint";
      externalUrl = upload.webUrl;
      externalItemId = upload.itemId;
    } else {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      filePath = `${projectId}/incoming/${category}/${enterpriseId}/${Date.now()}_${safeName}`;

      const { error: uploadError } = await supabase.storage
        .from(FINANCIAL_BUCKET)
        .upload(filePath, buffer, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });

      if (uploadError) return { ok: false, error: uploadError.message };
    }

    const { data: inserted, error: insertError } = await supabase
      .from("incoming_files")
      .insert({
        project_id: projectId,
        enterprise_id: enterpriseId,
        situation_id: situationId,
        category,
        file_path: filePath,
        file_name: fileName,
        storage_provider: storageProvider,
        external_url: externalUrl,
        external_item_id: externalItemId,
        source_email: sourceEmail,
        notes,
        created_by: user?.id ?? null,
      })
      .select("id")
      .single();

    if (insertError) return { ok: false, error: insertError.message };

    if (category === "facture" && situationId) {
      const { error: situationError } = await supabase
        .from("financial_situations")
        .update({
          invoice_file_path: filePath,
          invoice_file_name: file.name,
        })
        .eq("id", situationId)
        .eq("enterprise_id", enterpriseId);

      if (situationError) return { ok: false, error: situationError.message };
    }

    const categoryLabel = INCOMING_FILE_CATEGORY_LABELS[category];
    await logAudit(
      projectId,
      enterpriseId,
      "incoming_file",
      inserted.id,
      "create",
      category === "plan_exe"
        ? `Plan d'exé rangé sur SharePoint (${categoryLabel}) : ${fileName}`
        : `Fichier classé (${categoryLabel}) : ${fileName}`
    );

    return {
      ok: true,
      id: inserted.id,
      fileName,
      sharepointUrl: externalUrl,
    };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Erreur lors du classement.",
    };
  }
}

export async function getIncomingFileUrl(filePath: string) {
  const supabase = await createClient();
  const { data } = supabase.storage.from(FINANCIAL_BUCKET).getPublicUrl(filePath);
  return data.publicUrl;
}

export async function resolveIncomingFileUrl(
  file: Pick<
    IncomingFile,
    "file_path" | "external_url" | "storage_provider"
  >
): Promise<string> {
  if (file.storage_provider === "sharepoint" && file.external_url) {
    return file.external_url;
  }
  return getIncomingFileUrl(file.file_path);
}
