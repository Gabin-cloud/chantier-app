"use server";

import { revalidatePath } from "next/cache";
import mammoth from "mammoth";
import { getProfile, requireUser } from "@/lib/auth/permissions";
import {
  DEFAULT_AE_BODY_HTML,
  DEFAULT_AE_ENABLED_LABELS,
  DEFAULT_DOCUMENT_LABELS,
  DEFAULT_OS_BODY_HTML,
  DEFAULT_OS_ENABLED_LABELS,
  DOCUMENT_DOC_TYPE_LABELS,
  isValidLabelKey,
  normalizeLabelKey,
  type DocumentDocType,
  type DocumentLabelDefinition,
} from "@/lib/documents/document-labels";
import { createClient } from "@/lib/supabase/server";

const TEMPLATE_BUCKET = "financial-files";

export type OwnerDocumentTemplateData = {
  id: string | null;
  ownerId: string;
  docType: DocumentDocType;
  title: string;
  bodyHtml: string;
  enabledLabelKeys: string[];
  sourceFileName: string | null;
  sourceFilePath: string | null;
  updatedAt: string | null;
};

export type OwnerDocumentTemplatesPageData = {
  canEdit: boolean;
  ownerId: string;
  ownerName: string;
  labels: DocumentLabelDefinition[];
  templates: Record<DocumentDocType, OwnerDocumentTemplateData>;
};

async function canManageDocumentTemplates(userId: string): Promise<boolean> {
  const profile = await getProfile();
  if (profile.global_role === "super_admin") {
    return true;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("project_members")
    .select("role")
    .eq("user_id", userId)
    .in("role", ["admin", "gestionnaire"])
    .limit(1);

  if (error) {
    console.error("[canManageDocumentTemplates]", error.message);
    return false;
  }

  return (data?.length ?? 0) > 0;
}

function mapLabelRow(row: {
  key: string;
  label: string;
  description: string | null;
  example: string | null;
  category: string | null;
  is_system: boolean;
}): DocumentLabelDefinition {
  return {
    key: row.key,
    label: row.label,
    description: row.description ?? "",
    example: row.example ?? "",
    category: row.category ?? "general",
    isSystem: row.is_system,
  };
}

function defaultTemplate(
  ownerId: string,
  docType: DocumentDocType
): OwnerDocumentTemplateData {
  return {
    id: null,
    ownerId,
    docType,
    title: DOCUMENT_DOC_TYPE_LABELS[docType],
    bodyHtml: docType === "os" ? DEFAULT_OS_BODY_HTML : DEFAULT_AE_BODY_HTML,
    enabledLabelKeys:
      docType === "os" ? [...DEFAULT_OS_ENABLED_LABELS] : [...DEFAULT_AE_ENABLED_LABELS],
    sourceFileName: null,
    sourceFilePath: null,
    updatedAt: null,
  };
}

function mapTemplateRow(
  ownerId: string,
  docType: DocumentDocType,
  row: {
    id: string;
    title: string;
    body_html: string;
    enabled_label_keys: string[] | null;
    source_file_name: string | null;
    source_file_path: string | null;
    updated_at: string;
  } | null
): OwnerDocumentTemplateData {
  if (!row) return defaultTemplate(ownerId, docType);
  return {
    id: row.id,
    ownerId,
    docType,
    title: row.title,
    bodyHtml: row.body_html || defaultTemplate(ownerId, docType).bodyHtml,
    enabledLabelKeys:
      row.enabled_label_keys && row.enabled_label_keys.length > 0
        ? row.enabled_label_keys
        : defaultTemplate(ownerId, docType).enabledLabelKeys,
    sourceFileName: row.source_file_name,
    sourceFilePath: row.source_file_path,
    updatedAt: row.updated_at,
  };
}

export async function getOwnerDocumentTemplatesPage(
  ownerId: string
): Promise<OwnerDocumentTemplatesPageData> {
  const user = await requireUser();
  const canEdit = await canManageDocumentTemplates(user.id);
  const supabase = await createClient();

  const { data: owner, error: ownerError } = await supabase
    .from("owner_directory")
    .select("id, name")
    .eq("id", ownerId)
    .maybeSingle();

  if (ownerError) throw new Error(ownerError.message);
  if (!owner) throw new Error("Maître d'ouvrage introuvable.");

  let labels: DocumentLabelDefinition[] = DEFAULT_DOCUMENT_LABELS;

  const { data: labelRows, error: labelsError } = await supabase
    .from("document_labels")
    .select("key, label, description, example, category, is_system")
    .order("category", { ascending: true })
    .order("label", { ascending: true });

  if (!labelsError && labelRows && labelRows.length > 0) {
    labels = labelRows.map(mapLabelRow);
  } else if (labelsError) {
    console.error("[getOwnerDocumentTemplatesPage] labels", labelsError.message);
  }

  const { data: templateRows, error: templatesError } = await supabase
    .from("owner_document_templates")
    .select(
      "id, doc_type, title, body_html, enabled_label_keys, source_file_name, source_file_path, updated_at"
    )
    .eq("owner_id", ownerId)
    .in("doc_type", ["os", "ae"]);

  if (templatesError) {
    console.error("[getOwnerDocumentTemplatesPage] templates", templatesError.message);
  }

  const osRow =
    templateRows?.find((row) => row.doc_type === "os") ?? null;
  const aeRow =
    templateRows?.find((row) => row.doc_type === "ae") ?? null;

  return {
    canEdit,
    ownerId: owner.id,
    ownerName: owner.name,
    labels,
    templates: {
      os: mapTemplateRow(owner.id, "os", osRow),
      ae: mapTemplateRow(owner.id, "ae", aeRow),
    },
  };
}

export async function saveOwnerDocumentTemplate(input: {
  ownerId: string;
  docType: DocumentDocType;
  title: string;
  bodyHtml: string;
  enabledLabelKeys: string[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const user = await requireUser();
    const allowed = await canManageDocumentTemplates(user.id);
    if (!allowed) {
      return { ok: false, error: "Droits insuffisants pour modifier les modèles." };
    }

    if (input.docType !== "os" && input.docType !== "ae") {
      return { ok: false, error: "Type de document invalide." };
    }

    const title = input.title.trim();
    if (!title) {
      return { ok: false, error: "Le titre du modèle est obligatoire." };
    }

    const enabledLabelKeys = Array.from(
      new Set(input.enabledLabelKeys.map((key) => key.trim().toLowerCase()).filter(Boolean))
    );

    const supabase = await createClient();
    const { error } = await supabase.from("owner_document_templates").upsert(
      {
        owner_id: input.ownerId,
        doc_type: input.docType,
        title,
        body_html: input.bodyHtml,
        enabled_label_keys: enabledLabelKeys,
        updated_by: user.id,
      },
      { onConflict: "owner_id,doc_type" }
    );

    if (error) {
      return { ok: false, error: error.message };
    }

    revalidatePath(`/pc/referentiels/maitres-ouvrage/${input.ownerId}`);
    return { ok: true };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Enregistrement impossible.",
    };
  }
}

export async function createDocumentLabel(input: {
  key?: string;
  label: string;
  description?: string;
  example?: string;
  category?: string;
}): Promise<
  { ok: true; label: DocumentLabelDefinition } | { ok: false; error: string }
> {
  try {
    const user = await requireUser();
    const allowed = await canManageDocumentTemplates(user.id);
    if (!allowed) {
      return { ok: false, error: "Droits insuffisants pour créer une étiquette." };
    }

    const label = input.label.trim();
    if (!label) {
      return { ok: false, error: "Le libellé de l'étiquette est obligatoire." };
    }

    const key = normalizeLabelKey(input.key?.trim() || label);
    if (!isValidLabelKey(key)) {
      return {
        ok: false,
        error: "Clé invalide. Utilisez des lettres minuscules, chiffres et underscores.",
      };
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("document_labels")
      .insert({
        key,
        label,
        description: input.description?.trim() ?? "",
        example: input.example?.trim() ?? "",
        category: input.category?.trim() || "general",
        is_system: false,
        created_by: user.id,
      })
      .select("key, label, description, example, category, is_system")
      .single();

    if (error) {
      if (error.code === "23505") {
        return { ok: false, error: "Cette clé d'étiquette existe déjà." };
      }
      return { ok: false, error: error.message };
    }

    revalidatePath("/pc/referentiels");
    return { ok: true, label: mapLabelRow(data) };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Création impossible.",
    };
  }
}

export async function importOwnerDocumentWord(
  formData: FormData
): Promise<
  | {
      ok: true;
      bodyHtml: string;
      sourceFileName: string;
      ownerId: string;
      docType: DocumentDocType;
    }
  | { ok: false; error: string }
> {
  try {
    const user = await requireUser();
    const allowed = await canManageDocumentTemplates(user.id);
    if (!allowed) {
      return { ok: false, error: "Droits insuffisants pour importer un Word." };
    }

    const ownerId = String(formData.get("ownerId") ?? "");
    const docType = String(formData.get("docType") ?? "") as DocumentDocType;
    if (!ownerId) {
      return { ok: false, error: "Maître d'ouvrage manquant." };
    }
    if (docType !== "os" && docType !== "ae") {
      return { ok: false, error: "Type de document invalide." };
    }

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return { ok: false, error: "Fichier Word manquant." };
    }

    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith(".docx")) {
      return {
        ok: false,
        error: "Seuls les fichiers .docx (Word) sont acceptés pour l'import.",
      };
    }

    if (file.size > 8 * 1024 * 1024) {
      return { ok: false, error: "Fichier trop volumineux (max 8 Mo)." };
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const converted = await mammoth.convertToHtml({ buffer });
    const bodyHtml = converted.value?.trim()
      ? `<div style="font-family:'Segoe UI',Arial,sans-serif;color:#111827;line-height:1.55">${converted.value}</div>`
      : "";

    if (!bodyHtml) {
      return { ok: false, error: "Le document Word importé est vide." };
    }

    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "_");
    const filePath = `owner-templates/${ownerId}/${docType}/${Date.now()}_${safeName}`;
    const supabase = await createClient();

    const { error: uploadError } = await supabase.storage
      .from(TEMPLATE_BUCKET)
      .upload(filePath, buffer, {
        contentType:
          file.type ||
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        upsert: true,
      });

    if (uploadError) {
      return { ok: false, error: uploadError.message };
    }

    const defaults = defaultTemplate(ownerId, docType);
    const { error: upsertError } = await supabase.from("owner_document_templates").upsert(
      {
        owner_id: ownerId,
        doc_type: docType,
        title: DOCUMENT_DOC_TYPE_LABELS[docType],
        body_html: bodyHtml,
        enabled_label_keys: defaults.enabledLabelKeys,
        source_file_path: filePath,
        source_file_name: file.name,
        updated_by: user.id,
      },
      { onConflict: "owner_id,doc_type" }
    );

    if (upsertError) {
      return { ok: false, error: upsertError.message };
    }

    revalidatePath(`/pc/referentiels/maitres-ouvrage/${ownerId}`);
    return { ok: true, bodyHtml, sourceFileName: file.name, ownerId, docType };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Import Word impossible.",
    };
  }
}
