"use client";

import { useState, useTransition } from "react";
import type { PreviewDraftResult } from "@/lib/actions/control-board";
import { ModalPanel } from "@/components/ui/ModalPanel";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import {
  normalizeRecipients,
  parseEmailList,
  validateEmailRecipients,
} from "@/lib/email/recipients";

export type EmailConfirmPayload = {
  subject: string;
  recipients: { email: string; name: string }[];
  cc: string;
  htmlBody: string;
  resumeRequestedAt: string;
};

type RecipientRow = { id: string; email: string; name: string };

const inputClass =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200";

function newRecipientId() {
  return `r-${Math.random().toString(36).slice(2, 9)}`;
}

function buildPayload(
  subject: string,
  recipientRows: RecipientRow[],
  cc: string,
  htmlBody: string,
  resumeRequestedAt: string
): { ok: true; payload: EmailConfirmPayload } | { ok: false; error: string } {
  const trimmedSubject = subject.trim();
  const recipients = normalizeRecipients(recipientRows);
  const trimmedBody = htmlBody.trim();

  if (!trimmedSubject) {
    return { ok: false, error: "L'objet du mail est obligatoire." };
  }
  const toError = validateEmailRecipients(recipients, "destinataire");
  if (toError) {
    return { ok: false, error: toError };
  }
  if (!trimmedBody) {
    return { ok: false, error: "Le corps du mail est obligatoire." };
  }
  if (!resumeRequestedAt) {
    return { ok: false, error: "Indiquez la date de reprise demandée." };
  }

  const ccRecipients = parseEmailList(cc);
  const ccError = ccRecipients.length
    ? validateEmailRecipients(ccRecipients, "destinataire en copie")
    : null;
  if (ccError) {
    return { ok: false, error: ccError };
  }

  return {
    ok: true,
    payload: {
      subject: trimmedSubject,
      recipients,
      cc: cc.trim(),
      htmlBody: trimmedBody,
      resumeRequestedAt,
    },
  };
}

export function EmailDraftPreviewModal({
  preview,
  m365Ready,
  isSubmitting,
  onClose,
  onCreateDraft,
  onSend,
}: {
  preview: Extract<PreviewDraftResult, { ok: true }>;
  m365Ready: boolean;
  isSubmitting: boolean;
  onClose: () => void;
  onCreateDraft: (payload: EmailConfirmPayload) => void;
  onSend: (payload: EmailConfirmPayload) => void;
}) {
  const [, startTransition] = useTransition();
  const [subject, setSubject] = useState(preview.subject);
  const [htmlBody, setHtmlBody] = useState(preview.htmlBody);
  const [cc, setCc] = useState(preview.defaultCc);
  const [recipientRows, setRecipientRows] = useState<RecipientRow[]>(
    preview.recipients.map((r) => ({
      id: newRecipientId(),
      email: r.email,
      name: r.name,
    }))
  );
  const [formError, setFormError] = useState<string | null>(null);
  const defaultResume = (() => {
    const d = new Date();
    d.setDate(d.getDate() + 15);
    return d.toISOString().slice(0, 10);
  })();
  const [resumeRequestedAt, setResumeRequestedAt] = useState(defaultResume);

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

  function submit(action: "draft" | "send") {
    setFormError(null);
    const built = buildPayload(
      subject,
      recipientRows,
      cc,
      htmlBody,
      resumeRequestedAt
    );
    if (!built.ok) {
      setFormError(built.error);
      return;
    }
    startTransition(() => {
      if (action === "draft") {
        onCreateDraft(built.payload);
      } else {
        onSend(built.payload);
      }
    });
  }

  return (
    <ModalPanel
      title="Composer le mail"
      subtitle="Modifiez le contenu, puis envoyez ou enregistrez en brouillon"
      onClose={onClose}
      maxWidth="2xl"
    >
      <div className="space-y-4">
        {preview.recipients.length === 0 && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
            <p className="font-semibold">Attention</p>
            <p className="mt-1">
              Aucun destinataire n&apos;est trouvé automatiquement. Ajoutez les destinataires manuellement
              (et ensuite enregistrez/envoyez).
            </p>
          </div>
        )}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 bg-slate-50 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
              <span className="rounded bg-[#0078d4] px-2 py-0.5 text-white">Outlook</span>
              <span>Composition</span>
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
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Date de reprise demandée
              </label>
              <input
                type="date"
                value={resumeRequestedAt}
                onChange={(e) => setResumeRequestedAt(e.target.value)}
                className={inputClass}
              />
              <p className="mt-1 text-[11px] text-slate-500">
                Utilisée dans le mail (balise {"{{date_reprise}}"}) et enregistrée
                avec le rapport.
              </p>
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <label className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                  À
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

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500">
                Copie (Cc)
              </label>
              <input
                type="text"
                value={cc}
                onChange={(e) => setCc(e.target.value)}
                placeholder="email1@entreprise.fr, email2@entreprise.fr"
                className={inputClass}
              />
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

          <div className="px-4 py-3">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Corps du message
            </label>
            <RichTextEditor value={htmlBody} onChange={setHtmlBody} minHeight="220px" />
          </div>
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
            Connectez Microsoft 365 dans Profil pour envoyer ou créer un brouillon Outlook.
          </p>
        )}

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => submit("draft")}
            disabled={isSubmitting || !m365Ready}
            className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-40"
          >
            {isSubmitting ? "En cours…" : "Brouillon Outlook"}
          </button>
          <button
            type="button"
            onClick={() => submit("send")}
            disabled={isSubmitting || !m365Ready}
            className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-40"
          >
            {isSubmitting ? "Envoi…" : "Envoyer"}
          </button>
        </div>
      </div>
    </ModalPanel>
  );
}
