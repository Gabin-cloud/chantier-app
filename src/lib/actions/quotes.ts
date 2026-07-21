"use server";

import { revalidatePath } from "next/cache";
import { requireFinanceAccess } from "@/lib/actions/members";
import { parseMoneyInput } from "@/lib/finance/calculations";
import { createClient } from "@/lib/supabase/server";
import type { FinancialQuote, FinancialQuoteWithLot } from "@/lib/types/database";

const FINANCIAL_BUCKET = "financial-files";

export type QuoteActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string };

function quotePaths(projectId: string) {
  return [
    `/pc/projets/${projectId}/suivi-financier/suivi-devis`,
    `/pc/projets/${projectId}/suivi-financier/synthese`,
    `/pc/projets/${projectId}/finance/tri`,
  ];
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
      enterprise:enterprises(name, lot_number, designation)`
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

export async function upsertQuoteFromOutlook(
  projectId: string,
  formData: FormData
): Promise<QuoteActionResult> {
  try {
    await requireFinanceAccess(projectId);
    const supabase = await createClient();

    const quoteId = (formData.get("quoteId") as string) || null;
    const enterpriseId = formData.get("enterpriseId") as string;
    const quoteNumber = ((formData.get("quoteNumber") as string) ?? "").trim();
    const quoteDate = (formData.get("quoteDate") as string) || new Date().toISOString().slice(0, 10);
    const designation = ((formData.get("designation") as string) ?? "").trim() || null;
    const amount_ht = parseMoneyInput(String(formData.get("amount_ht") ?? "0"));
    const is_cie = formData.get("is_cie") === "on" || formData.get("is_cie") === "true";
    const is_ts = formData.get("is_ts") === "on" || formData.get("is_ts") === "true";
    const is_tma = formData.get("is_tma") === "on" || formData.get("is_tma") === "true";
    const comment = ((formData.get("comment") as string) ?? "").trim() || null;
    const mode = (formData.get("mode") as string) || "new";
    const file = formData.get("file") as File | null;
    const validatedAt = (formData.get("validatedAt") as string) || null;
    const markRejected = formData.get("markRejected") === "true";

    if (!enterpriseId) {
      return { ok: false, error: "Veuillez sélectionner un lot / entreprise." };
    }

    let filePath: string | null = null;
    let fileName: string | null = null;
    let signedFilePath: string | null = null;
    let signedFileName: string | null = null;

    if (file && file.size > 0) {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const storagePath = `${projectId}/quotes/${enterpriseId}/${Date.now()}_${safeName}`;
      const buffer = Buffer.from(await file.arrayBuffer());
      const { error: uploadError } = await supabase.storage
        .from(FINANCIAL_BUCKET)
        .upload(storagePath, buffer, {
          contentType: file.type || "application/octet-stream",
          upsert: false,
        });
      if (uploadError) return { ok: false, error: uploadError.message };

      if (mode === "signed" && quoteId) {
        signedFilePath = storagePath;
        signedFileName = file.name;
      } else {
        filePath = storagePath;
        fileName = file.name;
      }
    }

    if (mode === "signed" && quoteId) {
      const updatePayload: Record<string, unknown> = {
        is_rejected: markRejected,
      };
      if (validatedAt) updatePayload.validated_at = validatedAt;
      if (markRejected) {
        updatePayload.validated_at = null;
      }
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
      revalidateQuotes(projectId);
      return { ok: true, id: quoteId };
    }

    const payload = {
      project_id: projectId,
      enterprise_id: enterpriseId,
      quote_number: quoteNumber,
      quote_date: quoteDate,
      is_cie,
      is_ts,
      is_tma,
      designation,
      amount_ht: Number.isFinite(amount_ht) ? amount_ht : 0,
      comment,
      is_rejected: markRejected,
      validated_at: markRejected ? null : validatedAt,
      ...(filePath ? { file_path: filePath, file_name: fileName } : {}),
    };

    if (quoteId) {
      const { error } = await supabase
        .from("financial_quotes")
        .update(payload)
        .eq("id", quoteId)
        .eq("project_id", projectId);
      if (error) return { ok: false, error: error.message };
      revalidateQuotes(projectId);
      return { ok: true, id: quoteId };
    }

    const { data, error } = await supabase
      .from("financial_quotes")
      .insert(payload)
      .select("id")
      .single();

    if (error) return { ok: false, error: error.message };
    revalidateQuotes(projectId);
    return { ok: true, id: data.id };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Erreur lors de l'enregistrement du devis.",
    };
  }
}

export async function updateQuoteValidation(
  projectId: string,
  quoteId: string,
  validatedAt: string | null,
  isRejected: boolean
): Promise<QuoteActionResult> {
  await requireFinanceAccess(projectId);
  const supabase = await createClient();

  const { error } = await supabase
    .from("financial_quotes")
    .update({
      validated_at: isRejected ? null : validatedAt,
      is_rejected: isRejected,
    })
    .eq("id", quoteId)
    .eq("project_id", projectId);

  if (error) return { ok: false, error: error.message };
  revalidateQuotes(projectId);
  return { ok: true };
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

export async function linkIncomingFileToQuote(
  projectId: string,
  incomingFileId: string,
  quoteData: {
    enterpriseId: string;
    quoteNumber: string;
    quoteDate: string;
    is_cie: boolean;
    is_ts: boolean;
    is_tma: boolean;
    designation: string | null;
    amount_ht: number;
  }
): Promise<QuoteActionResult> {
  await requireFinanceAccess(projectId);
  const supabase = await createClient();

  const { data: incoming, error: incomingError } = await supabase
    .from("incoming_files")
    .select("file_path, file_name")
    .eq("id", incomingFileId)
    .eq("project_id", projectId)
    .single();

  if (incomingError || !incoming) {
    return { ok: false, error: "Fichier entrant introuvable." };
  }

  const { data, error } = await supabase
    .from("financial_quotes")
    .insert({
      project_id: projectId,
      enterprise_id: quoteData.enterpriseId,
      quote_number: quoteData.quoteNumber,
      quote_date: quoteData.quoteDate,
      is_cie: quoteData.is_cie,
      is_ts: quoteData.is_ts,
      is_tma: quoteData.is_tma,
      designation: quoteData.designation,
      amount_ht: quoteData.amount_ht,
      file_path: incoming.file_path,
      file_name: incoming.file_name,
      incoming_file_id: incomingFileId,
    })
    .select("id")
    .single();

  if (error) return { ok: false, error: error.message };
  revalidateQuotes(projectId);
  return { ok: true, id: data.id };
}
