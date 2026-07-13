"use client";

import { useState, useTransition } from "react";
import type { PreviewDraftResult } from "@/lib/actions/control-board";
import { ModalPanel } from "@/components/ui/ModalPanel";

export type DraftConfirmPayload = {
  subject: string;
  recipients: { email: string; name: string }[];
};

type RecipientRow = { id: string; email: string; name: string };

const inputClass =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200";

function newRecipientId() {
  return `r-${Math.random().toString(36).slice(2, 9)}`;
}

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
  onConfirm: (payload: DraftConfirmPayload) => void;
}) {
  const [, startTransition] = useTransition();
  const [subject, setSubject] = useState(preview.subject);
  const [recipientRows, setRecipientRows] = useState<RecipientRow[]>(
    preview.recipients.map((r) => ({
      id: newRecipientId(),
      email: r.email,
      name: r.name,
    }))
  );
  const [formError, setFormError] = useState<string | null>(null);

  function updateRecipient(id: string, field: "email" | "name", value: string) {
    setRecipientRows((rows) =>
      rows.map((row) => (row.id === id ? { ...row, [field]: value } : row))
    );
  }

  function removeRecipient(id: string) {
    setRecipientRows((rows) => rows.filter((row) => row.id !== id));
  }

  function addRecipient() {
    setRecipientRows((rows) => [
      ...rows,
      { id: newRecipientId(), email: "", name: "" },
    ]);
  }

  function handleConfirm() {
    setFormError(null);
    const trimmedSubject = subject.trim();
    const recipients = recipientRows
      .map((row) => ({
        email: row.email.trim(),
        name: row.name.trim() || row.email.trim(),
      }))
      .filter((row) => row.email);

    if (!trimmedSubject) {
      setFormError("L'objet du mail est obligatoire.");
      return;
    }

    if (!recipients.length) {
      setFormError("Ajoutez au moins un destinataire avec une adresse e-mail.");
      return;
    }

    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalid = recipients.find((r) => !emailPattern.test(r.email));
    if (invalid) {
      setFormError(`Adresse e-mail invalide : ${invalid.email}`);
      return;
    }

    startTransition(() => {
      onConfirm({ subject: trimmedSubject, recipients });
    });
  }

  return (
    <ModalPanel
      title="Aperçu du brouillon"
      subtitle="Modifiez l'objet et les destinataires, puis validez"
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
          </div>

          <div className="space-y-3 border-b border-slate-100 px-4 py-3 text-sm">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Objet
              </label>
              <input
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className={inputClass}
              />
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  Destinataires
                </label>
                <button
                  type="button"
                  onClick={addRecipient}
                  className="text-xs font-semibold text-emerald-700 hover:underline"
                >
                  + Ajouter
                </button>
              </div>
              <div className="space-y-2">
                {recipientRows.map((row) => (
                  <div key={row.id} className="flex flex-wrap items-center gap-2">
                    <input
                      type="email"
                      value={row.email}
                      onChange={(e) => updateRecipient(row.id, "email", e.target.value)}
                      placeholder="email@entreprise.fr"
                      className={`${inputClass} min-w-[200px] flex-1`}
                    />
                    <input
                      type="text"
                      value={row.name}
                      onChange={(e) => updateRecipient(row.id, "name", e.target.value)}
                      placeholder="Nom contact"
                      className={`${inputClass} min-w-[140px] flex-1`}
                    />
                    <button
                      type="button"
                      onClick={() => removeRecipient(row.id)}
                      disabled={recipientRows.length <= 1}
                      className="rounded-lg px-2 py-2 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-30"
                      aria-label="Retirer le destinataire"
                    >
                      ✕
                    </button>
                  </div>
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
            className="max-h-[40vh] overflow-y-auto px-4 py-4 text-sm text-slate-800"
            dangerouslySetInnerHTML={{ __html: preview.htmlBody }}
          />
        </div>

        {preview.skipped.length > 0 && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Entreprises sans e-mail (non ajoutées) : {preview.skipped.join(" · ")}
          </p>
        )}

        {formError && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>
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
