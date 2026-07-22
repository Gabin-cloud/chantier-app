"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { uploadSituationInvoice } from "@/lib/actions/finance";
import { exportMergedSituationPdf } from "@/lib/finance/pdf-export";
import { SituationCertificate } from "@/components/finance/SituationCertificate";
import type {
  FinancialSituation,
  LotWithFinancials,
  Project,
} from "@/lib/types/database";

type SituationExportPanelProps = {
  project: Project;
  lot: LotWithFinancials;
  situation: FinancialSituation;
  invoiceUrl?: string | null;
  ownerSituationTemplate?: {
    templateName: string | null;
    templateUrl: string | null;
  } | null;
};

export function SituationExportPanel({
  project,
  lot,
  situation,
  invoiceUrl,
  ownerSituationTemplate,
}: SituationExportPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const certificateRef = useRef<HTMLDivElement>(null);

  const invoiceIsPdf =
    situation.invoice_file_name?.toLowerCase().endsWith(".pdf") ?? false;

  function handleFile(file: File) {
    setError(null);
    const formData = new FormData();
    formData.append("file", file);

    startTransition(async () => {
      try {
        await uploadSituationInvoice(
          project.id,
          lot.id,
          situation.id,
          formData
        );
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur lors de l'upload.");
      }
    });
  }

  async function handleExportMerged() {
    if (!certificateRef.current) return;
    setError(null);

    try {
      await exportMergedSituationPdf({
        certificateElement: certificateRef.current,
        invoiceUrl: invoiceUrl ?? undefined,
        invoiceIsPdf,
        fileName: `Situation-${lot.lot_number}-n${situation.situation_number}.pdf`,
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Erreur lors de l'export PDF."
      );
    }
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h3 className="mb-2 text-lg font-semibold text-slate-900">
          Facture entreprise
        </h3>
        <p className="mb-4 text-sm text-slate-500">
          Glissez la facture de l&apos;entreprise ici pour la fusionner avec
          l&apos;attestation de situation.
        </p>

        {ownerSituationTemplate?.templateUrl && (
          <div className="mb-4 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3">
            <p className="text-sm font-medium text-blue-900">
              Modèle Excel promoteur
              {ownerSituationTemplate.templateName
                ? ` : ${ownerSituationTemplate.templateName}`
                : ""}
            </p>
            <a
              href={ownerSituationTemplate.templateUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-block text-sm font-semibold text-blue-800 underline"
            >
              Télécharger le modèle situation de travaux
            </a>
          </div>
        )}

        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
          }}
          className={`rounded-xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
            dragOver
              ? "border-blue-400 bg-blue-50"
              : "border-slate-200 bg-slate-50"
          }`}
        >
          <p className="text-sm text-slate-600">
            Déposez un PDF ou une image de facture
          </p>
          <label className="mt-3 inline-block cursor-pointer rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700">
            Parcourir…
            <input
              type="file"
              accept="application/pdf,image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
          </label>
          {situation.invoice_file_name && (
            <p className="mt-3 text-sm font-medium text-emerald-700">
              Fichier joint : {situation.invoice_file_name}
            </p>
          )}
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            Imprimer l&apos;attestation seule
          </button>
          <button
            type="button"
            onClick={handleExportMerged}
            disabled={isPending}
            className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {invoiceUrl
              ? "Exporter PDF fusionné (attestation + facture)"
              : "Exporter PDF attestation"}
          </button>
        </div>

        {error && (
          <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}
      </section>

      <div ref={certificateRef}>
        <SituationCertificate
          project={project}
          lot={lot}
          situation={situation}
        />
      </div>
    </div>
  );
}
