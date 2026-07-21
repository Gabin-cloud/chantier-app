"use client";

import { useEffect, useState, useTransition } from "react";
import { ModalPanel } from "@/components/ui/ModalPanel";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import {
  createDevisMouEmailDraft,
  prepareDevisMouEmailPreview,
  sendDevisMouEmail,
  type DevisMouEmailPreviewResult,
} from "@/lib/actions/devis-mou-email";
import {
  normalizeRecipients,
  parseEmailList,
  validateEmailRecipients,
} from "@/lib/email/recipients";

type RecipientRow = { id: string; email: string; name: string };

export type DevisMouEmailConfirmPayload = {
  subject: string;
  recipients: { email: string; name: string }[];
  cc: string;
  htmlBody: string;
};

const inputClass =
  "w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200";

function newRecipientId() {
  return `r-${Math.random().toString(36).slice(2, 9)}`;
}

function buildPayload(
  subject: string,
  recipientRows: RecipientRow[],
  cc: string,
  htmlBody: string
): { ok: true; payload: DevisMouEmailConfirmPayload } | { ok: false; error: string } {
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
    },
  };
}

type DevisMouEmailStepProps = {
  projectId: string;
  quoteIds: string[];
  m365Ready: boolean;
  onClose: () => void;
  onSent?: () => void;
};

export function DevisMouEmailStep({
  projectId,
  quoteIds,
  m365Ready,
  onClose,
  onSent,
}: DevisMouEmailStepProps) {
  const [, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [preview, setPreview] = useState<
    Extract<DevisMouEmailPreviewResult, { ok: true }> | null
  >(null);
  const [subject, setSubject] = useState("");
  const [htmlBody, setHtmlBody] = useState("");
  const [cc, setCc] = useState("");
  const [recipientRows, setRecipientRows] = useState<RecipientRow[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [draftLink, setDraftLink] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadPreview() {
      setLoading(true);
      setLoadError(null);
      const result = await prepareDevisMouEmailPreview(projectId, quoteIds);
      if (cancelled) return;

      if (!result.ok) {
        setLoadError(result.error);
        setLoading(false);
        return;
      }

      setPreview(result);
      setSubject(result.subject);
      setHtmlBody(result.htmlBody);
      setCc(result.defaultCc);
      setRecipientRows(
        result.recipients.map((r) => ({
          id: newRecipientId(),
          email: r.email,
          name: r.name,
        }))
      );
      setLoading(false);
    }

    loadPreview();
    return () => {
      cancelled = true;
    };
  }, [projectId, quoteIds]);

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

  async function runEmailAction(
    payload: DevisMouEmailConfirmPayload,
    mode: "draft" | "send"
  ) {
    setIsSubmitting(true);
    setFormError(null);
    setSuccess(null);

    const overrides = {
      subject: payload.subject,
      htmlBody: payload.htmlBody,
      recipients: payload.recipients,
      cc: payload.cc,
    };

    try {
      if (mode === "draft") {
        const result = await createDevisMouEmailDraft(projectId, quoteIds, overrides);
        if (!result.ok) {
          setFormError(result.error);
          return;
        }
        let msg = "Brouillon créé dans Outlook bureau → dossier Brouillons.";
        if (result.skipped.length > 0) {
          msg += ` Ignorés : ${result.skipped.join(" · ")}`;
        }
        setSuccess(msg);
        setDraftLink(result.webLink);
        onSent?.();
      } else {
        const result = await sendDevisMouEmail(projectId, quoteIds, overrides);
        if (!result.ok) {
          setFormError(result.error);
          return;
        }
        let msg = `Mail envoyé à ${result.recipients.length} destinataire(s).`;
        if (result.skipped.length > 0) {
          msg += ` Ignorés : ${result.skipped.join(" · ")}`;
        }
        setSuccess(msg);
        setDraftLink(null);
        onSent?.();
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  function submit(action: "draft" | "send") {
    setFormError(null);
    const built = buildPayload(subject, recipientRows, cc, htmlBody);
    if (!built.ok) {
      setFormError(built.error);
      return;
    }
    startTransition(() => {
      void runEmailAction(built.payload, action);
    });
  }

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="rounded-2xl bg-white px-6 py-8 text-sm text-slate-600 shadow-xl">
          Préparation du mail type…
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
          <p className="text-sm text-red-700">{loadError}</p>
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Fermer
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <ModalPanel
      title="Envoyer les devis au maître d'ouvrage"
      subtitle="Modifiez le contenu, puis envoyez ou enregistrez en brouillon"
      onClose={onClose}
      maxWidth="2xl"
    >
      <div className="space-y-4">
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
                      placeholder="email@mou.fr"
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

            {preview && preview.attachments.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-slate-500">Pièces jointes</span>
                {preview.attachments.map((attachment) => (
                  <span
                    key={attachment.fileName}
                    className="inline-flex items-center gap-1 rounded-lg bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700"
                  >
                    PDF {attachment.fileName}
                    {attachment.pdfUrl && (
                      <a
                        href={attachment.pdfUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="ml-1 text-emerald-700 underline"
                      >
                        Voir
                      </a>
                    )}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="px-4 py-3">
            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
              Corps du message
            </label>
            <RichTextEditor value={htmlBody} onChange={setHtmlBody} minHeight="220px" />
          </div>
        </div>

        {preview && preview.skipped.length > 0 && (
          <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Avertissements : {preview.skipped.join(" · ")}
          </p>
        )}

        {success && (
          <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            <p>{success}</p>
            {draftLink && (
              <a
                href={draftLink}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-1 inline-block text-emerald-700 underline"
              >
                Ouvrir aussi dans Outlook Web (optionnel)
              </a>
            )}
          </div>
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
            {success ? "Terminer" : "Annuler"}
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
