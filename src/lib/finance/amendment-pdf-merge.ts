"use server";

import { PDFDocument } from "pdf-lib";
import { revalidatePath } from "next/cache";
import { requireFinanceAccess } from "@/lib/actions/members";
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
  quoteIds: string[]
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

    const enterprise = amendment.enterprise as {
      project_id: string;
      lot_number: string | null;
      name: string;
    };

    if (enterprise.project_id !== projectId) {
      return { ok: false, error: "Avenant introuvable." };
    }

    const merged = await PDFDocument.create();
    await appendPdfBytes(merged, decodeBase64Pdf(avenantPdfBase64));

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
