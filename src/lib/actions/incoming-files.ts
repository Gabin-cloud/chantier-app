"use server";

import { revalidatePath } from "next/cache";
import { requireFinanceAccess } from "@/lib/actions/members";
import { canAccessFinance } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import type {
  IncomingFileCategory,
  IncomingFileWithDetails,
} from "@/lib/types/database";

const FINANCIAL_BUCKET = "financial-files";

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
  for (const row of memberships ?? []) {
    if (!canAccessFinance(row.role)) continue;
    const project = row.projects as FinanceProjectOption | FinanceProjectOption[] | null;
    if (Array.isArray(project)) {
      projects.push(...project);
    } else if (project) {
      projects.push(project);
    }
  }

  return projects.sort((a, b) => a.name.localeCompare(b.name, "fr"));
}

function financePaths(projectId: string) {
  return [
    `/pc/projets/${projectId}/finance`,
    `/pc/projets/${projectId}/finance/tri`,
    `/pc/projets/${projectId}/finance/situations`,
    `/pc/projets/${projectId}/finance/recap-situations`,
  ];
}

function revalidateFinance(projectId: string) {
  for (const path of financePaths(projectId)) {
    revalidatePath(path);
  }
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
) {
  await requireFinanceAccess(projectId);

  const file = formData.get("file") as File | null;
  const category = formData.get("category") as IncomingFileCategory | null;
  const enterpriseId = (formData.get("enterpriseId") as string) || null;
  const situationId = (formData.get("situationId") as string) || null;
  const sourceEmail = (formData.get("sourceEmail") as string)?.trim() || null;
  const notes = (formData.get("notes") as string)?.trim() || null;

  if (!file || file.size === 0) {
    throw new Error("Veuillez sélectionner un fichier.");
  }
  if (!category) {
    throw new Error("Veuillez choisir une catégorie.");
  }
  if (!enterpriseId) {
    throw new Error("Veuillez sélectionner un lot.");
  }
  if (category === "facture" && !situationId) {
    throw new Error("Veuillez sélectionner une situation pour une facture.");
  }

  const isPdf =
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  const isImage = file.type.startsWith("image/");
  const isOffice =
    file.name.toLowerCase().endsWith(".doc") ||
    file.name.toLowerCase().endsWith(".docx") ||
    file.name.toLowerCase().endsWith(".xls") ||
    file.name.toLowerCase().endsWith(".xlsx");

  if (!isPdf && !isImage && !isOffice) {
    throw new Error("Formats acceptés : PDF, images, Word, Excel.");
  }

  const supabase = await createClient();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filePath = `${projectId}/incoming/${category}/${enterpriseId}/${Date.now()}_${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from(FINANCIAL_BUCKET)
    .upload(filePath, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });

  if (uploadError) throw new Error(uploadError.message);

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: inserted, error: insertError } = await supabase
    .from("incoming_files")
    .insert({
      project_id: projectId,
      enterprise_id: enterpriseId,
      situation_id: situationId,
      category,
      file_path: filePath,
      file_name: file.name,
      source_email: sourceEmail,
      notes,
      created_by: user?.id ?? null,
    })
    .select("id")
    .single();

  if (insertError) throw new Error(insertError.message);

  if (category === "facture" && situationId) {
    const { error: situationError } = await supabase
      .from("financial_situations")
      .update({
        invoice_file_path: filePath,
        invoice_file_name: file.name,
      })
      .eq("id", situationId)
      .eq("enterprise_id", enterpriseId);

    if (situationError) throw new Error(situationError.message);
  }

  const categoryLabel =
    category.charAt(0).toUpperCase() + category.slice(1);
  await logAudit(
    projectId,
    enterpriseId,
    "incoming_file",
    inserted.id,
    "create",
    `Fichier classé (${categoryLabel}) : ${file.name}`
  );

  revalidateFinance(projectId);
  return inserted.id;
}

export async function getIncomingFileUrl(filePath: string) {
  const supabase = await createClient();
  const { data } = supabase.storage.from(FINANCIAL_BUCKET).getPublicUrl(filePath);
  return data.publicUrl;
}
