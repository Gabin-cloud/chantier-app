"use client";

import { useEffect, useState, useTransition } from "react";
import { ModalPanel } from "@/components/ui/ModalPanel";
import { RichTextEditor } from "@/components/ui/RichTextEditor";
import {
  createTmaMouEmailDraft,
  prepareTmaMouEmailPreview,
  sendTmaMouEmail,
  type TmaMouEmailPreviewResult,
} from "@/lib/actions/tma-mou-email";

type TmaMouEmailStepProps = {
  projectId: string;
  entryIds: string[];
  m365Ready: boolean;
  open: boolean;
  onClose: () => void;
  onComplete: () => void;
};

export function TmaMouEmailStep({
  projectId,
  entryIds,
  m365Ready,
  open,
  onClose,
  onComplete,
}: TmaMouEmailStepProps) {
  const [, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [preview, setPreview] = useState<Extract<TmaMouEmailPreviewResult, { ok: true }> | null>(
    null
  );
  const [subject, setSubject] = useState("");
  const [htmlBody, setHtmlBody] = useState("");
  const [cc, setCc] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [draftLink, setDraftLink] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !entryIds.length) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      const result = await prepareTmaMouEmailPreview(projectId, entryIds);
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
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [open, projectId, entryIds]);

  if (!open) return null;

  function submit(mode: "draft" | "send") {
    setFormError(null);
    setSuccess(null);
    setDraftLink(null);
    setIsSubmitting(true);

    const overrides = { subject, htmlBody, cc };

    startTransition(async () => {
      const result =
        mode === "draft"
          ? await createTmaMouEmailDraft(projectId, entryIds, overrides)
          : await sendTmaMouEmail(projectId, entryIds, overrides);

      setIsSubmitting(false);

      if (!result.ok) {
        setFormError(result.error);
        return;
      }

      setSuccess(
        mode === "draft"
          ? "Brouillon Outlook créé — envoi MOU enregistré."
          : "Mail envoyé au maître d'ouvrage."
      );
      if (mode === "draft" && result.ok && "webLink" in result) {
        setDraftLink(typeof result.webLink === "string" ? result.webLink : null);
      }
      onComplete();
    });
  }

  return (
    <ModalPanel
      title="Envoyer les devis TMA au MOU"
      subtitle="Mail type avec PDF renommés"
      onClose={onClose}
      maxWidth="xl"
    >
      {loading ? (
        <p className="text-sm text-slate-500">Chargement du mail…</p>
      ) : loadError ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{loadError}</p>
      ) : (
        <div className="space-y-4">
          {preview && preview.attachments.length > 0 && (
            <ul className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
              {preview.attachments.map((a) => (
                <li key={a.fileName}>📎 {a.fileName}</li>
              ))}
            </ul>
          )}

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
              Objet
            </label>
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>

          {preview && preview.recipients.length > 0 && (
            <p className="text-xs text-slate-500">
              Destinataires : {preview.recipients.map((r) => r.email).join(", ")}
            </p>
          )}

          {preview && preview.skipped.length > 0 && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              {preview.skipped.join(" · ")}
            </p>
          )}

          <RichTextEditor value={htmlBody} onChange={setHtmlBody} minHeight="200px" />

          <div>
            <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
              Copie (CC)
            </label>
            <input
              value={cc}
              onChange={(e) => setCc(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>

          {formError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>
          )}
          {success && (
            <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {success}
              {draftLink && (
                <a
                  href={draftLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-2 underline"
                >
                  Ouvrir Outlook
                </a>
              )}
            </div>
          )}

          {!m365Ready && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
              Connectez Microsoft 365 dans Profil pour envoyer le mail.
            </p>
          )}

          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" onClick={onClose} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700">
              Fermer
            </button>
            <button
              type="button"
              disabled={isSubmitting || !m365Ready}
              onClick={() => submit("draft")}
              className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 disabled:opacity-40"
            >
              Brouillon Outlook
            </button>
            <button
              type="button"
              disabled={isSubmitting || !m365Ready}
              onClick={() => submit("send")}
              className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              Envoyer
            </button>
          </div>
        </div>
      )}
    </ModalPanel>
  );
}
