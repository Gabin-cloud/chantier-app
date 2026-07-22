"use server";

import { PDFDocument } from "pdf-lib";
import { revalidatePath } from "next/cache";
import { requireFinanceAccess } from "@/lib/actions/members";
import {
  createAmendmentFromQuotes,
  type CreateAmendmentInput,
} from "@/lib/actions/finance";
import { createClient } from "@/lib/supabase/server";

const FINANCIAL_BUCKET = "financial-files";

function decodeBase64Pdf(base64: string): Uint8Array {
  return Buffer.from(base64, "base64");
}

async function appendPdfBytes(
  merged: PDFDocument,
  pdfBytes: Uint8Array
): Promise<void> {
  const source = await PDFDocument.load(pdfBytes);
  const pages = await merged.copyPages(source, source.getPageIndices());
  pages.forEach((page) => merged.addPage(page));
}

export async function uploadAmendmentMergedPdf(
  projectId: string,
  amendmentId: string,
  avenantPdfBase64: string,
  quoteIds: string[],
  localPdfBase64List: string[] = []
): Promise<{ ok: true; documentPath: string } | { ok: false; error: string }> {
  try {
    await requireFinanceAccess(projectId);
    const supabase = await createClient();

    const { data: amendment, error: amendmentError } = await supabase
      .from("financial_amendments")
      .select(
        "id, amendment_number, amendment_type, enterprise:enterprises!inner(project_id, lot_number, name)"
      )
      .eq("id", amendmentId)
      .single();

    if (amendmentError || !amendment) {
      return { ok: false, error: "Avenant introuvable." };
    }

    const enterpriseRaw = amendment.enterprise as unknown;
    const enterprise = (Array.isArray(enterpriseRaw) ? enterpriseRaw[0] : enterpriseRaw) as {
      project_id: string;
      lot_number: string | null;
      name: string;
    };

    if (enterprise.project_id !== projectId) {
      return { ok: false, error: "Avenant introuvable." };
    }

    const merged = await PDFDocument.create();
    await appendPdfBytes(merged, decodeBase64Pdf(avenantPdfBase64));

    for (const localBase64 of localPdfBase64List) {
      if (!localBase64?.trim()) continue;
      try {
        await appendPdfBytes(merged, decodeBase64Pdf(localBase64));
      } catch (err) {
        console.warn(
          "[uploadAmendmentMergedPdf] PDF local ignoré:",
          err instanceof Error ? err.message : err
        );
      }
    }

    if (quoteIds.length > 0) {
      const { data: quotes, error: quotesError } = await supabase
        .from("financial_quotes")
        .select("id, signed_file_path, file_path, quote_number")
        .in("id", quoteIds)
        .eq("project_id", projectId);

      if (quotesError) {
        return { ok: false, error: quotesError.message };
      }

      for (const quote of quotes ?? []) {
        const filePath = quote.signed_file_path ?? quote.file_path;
        if (!filePath) continue;

        const { data: fileBlob, error: downloadError } = await supabase.storage
          .from(FINANCIAL_BUCKET)
          .download(filePath);

        if (downloadError || !fileBlob) {
          console.warn(
            `[uploadAmendmentMergedPdf] Devis ${quote.quote_number ?? quote.id} ignoré:`,
            downloadError?.message
          );
          continue;
        }

        const quoteBytes = new Uint8Array(await fileBlob.arrayBuffer());
        try {
          await appendPdfBytes(merged, quoteBytes);
        } catch (err) {
          console.warn(
            `[uploadAmendmentMergedPdf] PDF devis ${quote.quote_number ?? quote.id} ignoré:`,
            err instanceof Error ? err.message : err
          );
        }
      }
    }

    const mergedBytes = await merged.save();
    const lotLabel = enterprise.lot_number ?? "lot";
    const fileName = `Avenant-${String(amendment.amendment_number).padStart(2, "0")}-${lotLabel}.pdf`;
    const documentPath = `${projectId}/amendments/${amendmentId}/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from(FINANCIAL_BUCKET)
      .upload(documentPath, Buffer.from(mergedBytes), {
        contentType: "application/pdf",
        upsert: true,
      });

    if (uploadError) {
      return { ok: false, error: uploadError.message };
    }

    const { error: updateError } = await supabase
      .from("financial_amendments")
      .update({
        document_path: documentPath,
        document_file_name: fileName,
      })
      .eq("id", amendmentId);

    if (updateError) {
      return { ok: false, error: updateError.message };
    }

    revalidatePath(`/pc/projets/${projectId}/suivi-financier/avenants`);
    revalidatePath(`/pc/projets/${projectId}/suivi-financier/synthese`);

    return { ok: true, documentPath };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Impossible d'enregistrer le PDF.",
    };
  }
}

/** Upload du PDF fusionné via FormData (évite les payloads base64 trop lourds en server action). */
export async function uploadAmendmentMergedPdfFromFormData(
  projectId: string,
  amendmentId: string,
  formData: FormData
): Promise<{ ok: true; documentPath: string } | { ok: false; error: string }> {
  try {
    await requireFinanceAccess(projectId);

    const avenantFile = formData.get("avenantPdf");
    if (!(avenantFile instanceof File) || !avenantFile.size) {
      return { ok: false, error: "PDF avenant manquant." };
    }

    const avenantBuffer = Buffer.from(await avenantFile.arrayBuffer());
    const avenantPdfBase64 = avenantBuffer.toString("base64");

    const localFiles = formData.getAll("localPdfs").filter((f): f is File => f instanceof File);
    const localPdfBase64List = await Promise.all(
      localFiles.map(async (file) => {
        const buffer = Buffer.from(await file.arrayBuffer());
        return buffer.toString("base64");
      })
    );

    const quoteIdsRaw = formData.get("quoteIds");
    const quoteIds: string[] =
      typeof quoteIdsRaw === "string" && quoteIdsRaw ? JSON.parse(quoteIdsRaw) : [];

    return uploadAmendmentMergedPdf(
      projectId,
      amendmentId,
      avenantPdfBase64,
      quoteIds,
      localPdfBase64List
    );
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Impossible d'enregistrer le PDF.",
    };
  }
}

/** Crée l'avenant et fusionne le PDF en une seule action serveur (évite les erreurs RSC). */
export async function createAmendmentWithDocument(
  projectId: string,
  input: CreateAmendmentInput,
  avenantPdfBase64: string,
  localPdfBase64List: string[] = []
): Promise<
  | { ok: true; amendmentId: string; amendmentNumber: number }
  | { ok: false; error: string }
> {
  const created = await createAmendmentFromQuotes(projectId, input);
  if (!created.ok) return created;

  const uploaded = await uploadAmendmentMergedPdf(
    projectId,
    created.amendmentId,
    avenantPdfBase64,
    created.quoteIds,
    localPdfBase64List
  );

  if (!uploaded.ok) {
    return { ok: false, error: uploaded.error };
  }

  return {
    ok: true,
    amendmentId: created.amendmentId,
    amendmentNumber: created.amendmentNumber,
  };
}

export type AmendmentExtraAttachment = {
  name: string;
  path: string;
  url: string | null;
};

function extraAttachmentsPrefix(projectId: string, amendmentId: string): string {
  return `${projectId}/amendments/${amendmentId}/extra`;
}

export async function listAmendmentExtraAttachments(
  projectId: string,
  amendmentId: string
): Promise<
  { ok: true; files: AmendmentExtraAttachment[] } | { ok: false; error: string }
> {
  try {
    await requireFinanceAccess(projectId);
    const supabase = await createClient();
    const prefix = extraAttachmentsPrefix(projectId, amendmentId);

    const { data: files, error } = await supabase.storage
      .from(FINANCIAL_BUCKET)
      .list(prefix);

    if (error) {
      return { ok: false, error: error.message };
    }

    const attachments: AmendmentExtraAttachment[] = (files ?? [])
      .filter((file) => file.name && !file.name.endsWith("/"))
      .map((file) => {
        const path = `${prefix}/${file.name}`;
        const { data } = supabase.storage.from(FINANCIAL_BUCKET).getPublicUrl(path);
        return {
          name: file.name,
          path,
          url: data.publicUrl ?? null,
        };
      });

    return { ok: true, files: attachments };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Impossible de lister les pièces jointes.",
    };
  }
}

export async function uploadAmendmentExtraAttachments(
  projectId: string,
  amendmentId: string,
  formData: FormData
): Promise<
  { ok: true; files: AmendmentExtraAttachment[] } | { ok: false; error: string }
> {
  try {
    await requireFinanceAccess(projectId);
    const supabase = await createClient();

    const { data: amendment, error: amendmentError } = await supabase
      .from("financial_amendments")
      .select("id, enterprise:enterprises!inner(project_id)")
      .eq("id", amendmentId)
      .single();

    if (amendmentError || !amendment) {
      return { ok: false, error: "Avenant introuvable." };
    }

    const enterpriseRaw = amendment.enterprise as unknown;
    const enterprise = (Array.isArray(enterpriseRaw) ? enterpriseRaw[0] : enterpriseRaw) as {
      project_id: string;
    };

    if (enterprise.project_id !== projectId) {
      return { ok: false, error: "Avenant introuvable." };
    }

    const incoming = formData.getAll("files") as File[];
    const files = incoming.filter((file) => file instanceof File && file.size > 0);

    if (files.length === 0) {
      return { ok: true, files: [] };
    }

    const prefix = extraAttachmentsPrefix(projectId, amendmentId);
    const uploaded: AmendmentExtraAttachment[] = [];

    for (const file of files) {
      const isPdf =
        file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
      if (!isPdf) {
        return { ok: false, error: "Seuls les fichiers PDF sont acceptés." };
      }

      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const filePath = `${prefix}/${safeName}`;
      const buffer = Buffer.from(await file.arrayBuffer());

      const { error: uploadError } = await supabase.storage
        .from(FINANCIAL_BUCKET)
        .upload(filePath, buffer, {
          contentType: "application/pdf",
          upsert: true,
        });

      if (uploadError) {
        return { ok: false, error: uploadError.message };
      }

      const { data } = supabase.storage.from(FINANCIAL_BUCKET).getPublicUrl(filePath);
      uploaded.push({
        name: file.name,
        path: filePath,
        url: data.publicUrl ?? null,
      });
    }

    revalidatePath(`/pc/projets/${projectId}/suivi-financier/avenants`);
    revalidatePath(`/pc/projets/${projectId}/suivi-financier/synthese`);

    return { ok: true, files: uploaded };
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : "Impossible d'enregistrer les pièces jointes.",
    };
  }
}
