"use client";

import { useTransition } from "react";
import type { PreviewDraftResult } from "@/lib/actions/control-board";
import { ModalPanel } from "@/components/ui/ModalPanel";

export function EmailDraftPreviewModal({
  preview,
  m365Ready,
  isCreating,
  onClose,
  onConfirm,
}: {
  preview: Extract<PreviewDraftResult, { ok: true }>;
  m365Ready: boolean;
  isCreating: boolean;
  onClose: () => void;
  onConfirm: () => void;
}) {
  const [, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(() => {
      onConfirm();
    });
  }

  return (
    <ModalPanel
      title="Aperçu du brouillon"
      subtitle="Relisez le mail avant de l'envoyer dans Outlook"
      onClose={onClose}
      maxWidth="2xl"
    >
      <div className="space-y-4">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              <span className="rounded bg-[#0078d4] px-2 py-0.5 text-white">Outlook</span>
              <span>Brouillon</span>
            </div>
            <p className="mt-2 text-lg font-semibold text-slate-900">{preview.subject}</p>
          </div>

          <div className="space-y-2 border-b border-slate-100 px-4 py-3 text-sm">
            <div className="flex flex-wrap gap-2">
              <span className="font-medium text-slate-500">À</span>
              <div className="flex flex-wrap gap-1.5">
                {preview.recipients.map((recipient) => (
                  <span
                    key={recipient.email}
                    className="rounded-full bg-slate-100 px-2.5 py-0.5 text-slate-700"
                  >
                    {recipient.name} &lt;{recipient.email}&gt;
                  </span>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium text-slate-500">Pièce jointe</span>
              <span className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700">
                PDF {preview.pdfFileName}
              </span>
              {preview.reportUrl && (
                <a
                  href={preview.reportUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-semibold text-emerald-700 underline"
                >
                  Voir le PDF
                </a>
              )}
            </div>
          </div>

          <div
            className="max-h-[50vh] overflow-y-auto px-4 py-4 text-sm text-slate-800"
            dangerouslySetInnerHTML={{ __html: preview.htmlBody }}
          />
        </div>

        {preview.skipped.length > 0 && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Destinataires ignorés : {preview.skipped.join(" · ")}
          </p>
        )}

        {!m365Ready && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Connectez Microsoft 365 dans Profil pour créer le brouillon dans Outlook.
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isCreating}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isCreating || !m365Ready}
            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-40"
          >
            {isCreating ? "Création…" : "Créer dans Outlook"}
          </button>
        </div>
      </div>
    </ModalPanel>
  );
}
