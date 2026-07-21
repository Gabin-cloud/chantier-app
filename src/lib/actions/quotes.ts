"use server";

import { revalidatePath } from "next/cache";
import { requireFinanceAccess } from "@/lib/actions/members";
import { parseMoneyInput } from "@/lib/finance/calculations";
import {
  normalizeQuoteCategory,
  validateQuoteCategory,
} from "@/lib/finance/quote-category";
import { createClient } from "@/lib/supabase/server";
import type { FinancialQuote, FinancialQuoteWithLot } from "@/lib/types/database";

const FINANCIAL_BUCKET = "financial-files";

export type QuoteActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

function quotePaths(projectId: string) {
  return [`/pc/projets/${projectId}/suivi-financier/suivi-devis`];
}

function revalidateQuotes(projectId: string) {
  for (const path of quotePaths(projectId)) {
    revalidatePath(path);
  }
}

function mapQuoteRow(row: Record<string, unknown>): FinancialQuoteWithLot {
  const enterprise = row.enterprise as
    | { name: string; lot_number: string | null; designation: string | null }
    | null
    | undefined;
  const amendment = row.amendment as
    | { amendment_number: number; document_html: string | null; document_path: string | null }
    | null
    | undefined;

  return {
    id: row.id as string,
    project_id: row.project_id as string,
    enterprise_id: row.enterprise_id as string,
    quote_number: row.quote_number as string,
    quote_date: row.quote_date as string,
    is_cie: Boolean(row.is_cie),
    is_ts: Boolean(row.is_ts),
    is_tma: Boolean(row.is_tma),
    designation: (row.designation as string | null) ?? null,
    amount_ht: Number(row.amount_ht),
    is_rejected: Boolean(row.is_rejected),
    validated_at: (row.validated_at as string | null) ?? null,
    amendment_id: (row.amendment_id as string | null) ?? null,
    comment: (row.comment as string | null) ?? null,
    file_path: (row.file_path as string | null) ?? null,
    file_name: (row.file_name as string | null) ?? null,
    signed_file_path: (row.signed_file_path as string | null) ?? null,
    signed_file_name: (row.signed_file_name as string | null) ?? null,
    incoming_file_id: (row.incoming_file_id as string | null) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    lot_number: enterprise?.lot_number ?? null,
    enterprise_name: enterprise?.name ?? "",
    lot_designation: enterprise?.designation ?? null,
    amendment_number: amendment?.amendment_number ?? null,
    amendment_document_html: amendment?.document_html ?? null,
    amendment_document_path: amendment?.document_path ?? null,
  };
}

export async function getProjectQuotes(
  projectId: string
): Promise<FinancialQuoteWithLot[]> {
  await requireFinanceAccess(projectId);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("financial_quotes")
    .select(
      `*,
      enterprise:enterprises(name, lot_number, designation),
      amendment:financial_amendments(amendment_number, document_html, document_path)`
    )
    .eq("project_id", projectId)
    .order("quote_date", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => mapQuoteRow(row as Record<string, unknown>));
}

export async function getQuotesForAmendment(
  projectId: string,
  enterpriseId: string
): Promise<FinancialQuote[]> {
  await requireFinanceAccess(projectId);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("financial_quotes")
    .select("*")
    .eq("project_id", projectId)
    .eq("enterprise_id", enterpriseId)
    .eq("is_rejected", false)
    .is("amendment_id", null)
    .order("quote_date", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as FinancialQuote[];
}

async function uploadQuoteFile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
  enterpriseId: string,
  file: File,
  prefix: string
) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const storagePath = `${projectId}/quotes/${enterpriseId}/${prefix}_${Date.now()}_${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());
  const { error: uploadError } = await supabase.storage
    .from(FINANCIAL_BUCKET)
    .upload(storagePath, buffer, {
      contentType: file.type || "application/octet-stream",
      upsert: false,
    });
  if (uploadError) return { error: uploadError.message as string };
  return { path: storagePath, name: file.name };
}

export async function saveQuote(
  projectId: string,
  formData: FormData,
  options?: { skipRevalidate?: boolean }
): Promise<QuoteActionResult> {
  try {
    await requireFinanceAccess(projectId);
    const supabase = await createClient();

    const quoteId = (formData.get("quoteId") as string) || null;
    const enterpriseId = formData.get("enterpriseId") as string;
    const quoteNumber = ((formData.get("quoteNumber") as string) ?? "").trim();
    const quoteDate =
      (formData.get("quoteDate") as string) || new Date().toISOString().slice(0, 10);
    const designation = ((formData.get("designation") as string) ?? "").trim() || null;
    const amount_ht = parseMoneyInput(String(formData.get("amount_ht") ?? "0"));
    const category = normalizeQuoteCategory({
      is_cie: formData.get("is_cie") === "on" || formData.get("is_cie") === "true",
      is_ts: formData.get("is_ts") === "on" || formData.get("is_ts") === "true",
      is_tma: formData.get("is_tma") === "on" || formData.get("is_tma") === "true",
    });
    const categoryError = validateQuoteCategory(category);
    if (categoryError) return { ok: false, error: categoryError };

    const comment = ((formData.get("comment") as string) ?? "").trim() || null;
    const mode = (formData.get("mode") as string) || "new";
    const file = formData.get("file") as File | null;
    const validatedAt = (formData.get("validatedAt") as string) || null;
    const markRejected = formData.get("markRejected") === "true";

    if (!enterpriseId) {
      return { ok: false, error: "Veuillez sélectionner un lot / entreprise." };
    }

    let filePath: string | undefined;
    let fileName: string | undefined;
    let signedFilePath: string | undefined;
    let signedFileName: string | undefined;

    if (file && file.size > 0) {
      const uploaded = await uploadQuoteFile(
        supabase,
        projectId,
        enterpriseId,
        file,
        mode === "signed" ? "signed" : "quote"
      );
      if ("error" in uploaded) return { ok: false, error: uploaded.error };
      if (mode === "signed" && quoteId) {
        signedFilePath = uploaded.path;
        signedFileName = uploaded.name;
      } else {
        filePath = uploaded.path;
        fileName = uploaded.name;
      }
    }

    if (mode === "signed" && quoteId) {
      const updatePayload: Record<string, unknown> = {
        is_rejected: markRejected,
        validated_at: markRejected ? null : validatedAt,
      };
      if (signedFilePath) {
        updatePayload.signed_file_path = signedFilePath;
        updatePayload.signed_file_name = signedFileName;
      }

      const { error } = await supabase
        .from("financial_quotes")
        .update(updatePayload)
        .eq("id", quoteId)
        .eq("project_id", projectId);

      if (error) return { ok: false, error: error.message };
      if (!options?.skipRevalidate) revalidateQuotes(projectId);
      return { ok: true, id: quoteId };
    }

    const payload: Record<string, unknown> = {
      project_id: projectId,
      enterprise_id: enterpriseId,
      quote_number: quoteNumber,
      quote_date: quoteDate,
      ...category,
      designation,
      amount_ht: Number.isFinite(amount_ht) ? amount_ht : 0,
      comment,
      is_rejected: markRejected,
      validated_at: markRejected ? null : validatedAt || null,
    };

    if (filePath) {
      payload.file_path = filePath;
      payload.file_name = fileName;
    }

    if (quoteId) {
      const { error } = await supabase
        .from("financial_quotes")
        .update(payload)
        .eq("id", quoteId)
        .eq("project_id", projectId);
      if (error) return { ok: false, error: error.message };
      if (!options?.skipRevalidate) revalidateQuotes(projectId);
      return { ok: true, id: quoteId };
    }

    const { data, error } = await supabase
      .from("financial_quotes")
      .insert(payload)
      .select("id")
      .single();

    if (error) return { ok: false, error: error.message };
    if (!options?.skipRevalidate) revalidateQuotes(projectId);
    return { ok: true, id: data.id };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Erreur lors de l'enregistrement du devis.",
    };
  }
}

export async function upsertQuoteFromOutlook(
  projectId: string,
  formData: FormData
): Promise<QuoteActionResult> {
  return saveQuote(projectId, formData, { skipRevalidate: true });
}

export async function updateQuoteField(
  projectId: string,
  quoteId: string,
  field: string,
  value: string | boolean | null
): Promise<QuoteActionResult> {
  await requireFinanceAccess(projectId);
  const supabase = await createClient();

  if (field === "is_cie" || field === "is_ts" || field === "is_tma") {
    const { data: current } = await supabase
      .from("financial_quotes")
      .select("is_cie, is_ts, is_tma")
      .eq("id", quoteId)
      .single();
    const flags = normalizeQuoteCategory({
      is_cie: field === "is_cie" ? Boolean(value) : Boolean(current?.is_cie),
      is_ts: field === "is_ts" ? Boolean(value) : Boolean(current?.is_ts),
      is_tma: field === "is_tma" ? Boolean(value) : Boolean(current?.is_tma),
    });
    const err = validateQuoteCategory(flags);
    if (err) return { ok: false, error: err };
    const { error } = await supabase
      .from("financial_quotes")
      .update(flags)
      .eq("id", quoteId)
      .eq("project_id", projectId);
    if (error) return { ok: false, error: error.message };
    revalidateQuotes(projectId);
    return { ok: true };
  }

  if (field === "validated_at") {
    const str = String(value ?? "").trim().toLowerCase();
    if (str === "non") {
      const { error } = await supabase
        .from("financial_quotes")
        .update({ is_rejected: true, validated_at: null })
        .eq("id", quoteId)
        .eq("project_id", projectId);
      if (error) return { ok: false, error: error.message };
      revalidateQuotes(projectId);
      return { ok: true };
    }
    const { error } = await supabase
      .from("financial_quotes")
      .update({ validated_at: str || null, is_rejected: false })
      .eq("id", quoteId)
      .eq("project_id", projectId);
    if (error) return { ok: false, error: error.message };
    revalidateQuotes(projectId);
    return { ok: true };
  }

  let updateValue: unknown = value;
  if (field === "amount_ht") {
    updateValue = parseMoneyInput(String(value ?? "0"));
  }

  const allowed = new Set([
    "quote_number",
    "quote_date",
    "designation",
    "amount_ht",
    "comment",
  ]);
  if (!allowed.has(field)) {
    return { ok: false, error: "Champ non modifiable." };
  }

  const { error } = await supabase
    .from("financial_quotes")
    .update({ [field]: updateValue })
    .eq("id", quoteId)
    .eq("project_id", projectId);

  if (error) return { ok: false, error: error.message };
  revalidateQuotes(projectId);
  return { ok: true };
}

export async function updateQuoteValidation(
  projectId: string,
  quoteId: string,
  validatedAt: string | null,
  isRejected: boolean
): Promise<QuoteActionResult> {
  return updateQuoteField(
    projectId,
    quoteId,
    "validated_at",
    isRejected ? "non" : validatedAt
  );
}

export async function getQuoteFileUrl(
  projectId: string,
  filePath: string
): Promise<string> {
  await requireFinanceAccess(projectId);
  const supabase = await createClient();
  const { data } = supabase.storage.from(FINANCIAL_BUCKET).getPublicUrl(filePath);
  return data.publicUrl;
}
