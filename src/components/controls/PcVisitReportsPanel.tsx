"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PcVisitRow, PreviewDraftResult } from "@/lib/actions/control-board";
import {
  generateVisitReportFromPc,
  prepareVisitEmailDraftFromPc,
  previewVisitEmailDraftFromPc,
  sendVisitEmailFromPc,
} from "@/lib/actions/control-board";
import {
  EmailDraftPreviewModal,
  type EmailConfirmPayload,
} from "@/components/controls/EmailDraftPreviewModal";

export function PcVisitReportsPanel({
  projectId,
  visits,
  canEdit,
  m365Ready,
  m365Email,
  m365Message,
}: {
  projectId: string;
  visits: PcVisitRow[];
  canEdit: boolean;
  m365Ready: boolean;
  m365Email: string | null;
  m365Message: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [draftLink, setDraftLink] = useState<string | null>(null);
  const [preview, setPreview] = useState<Extract<PreviewDraftResult, { ok: true }> | null>(
    null
  );
  const [previewVisitId, setPreviewVisitId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  function handleGenerate(visitId: string) {
    setError(null);
    setSuccess(null);
    setDraftLink(null);
    setPreview(null);
    startTransition(async () => {
      const result = await generateVisitReportFromPc(projectId, visitId);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuccess("Rapport PDF généré.");
      router.refresh();
    });
  }

  function handleOpenPreview(visitId: string) {
    setError(null);
    setSuccess(null);
    setDraftLink(null);
    setPreview(null);
    setPreviewVisitId(visitId);
    startTransition(async () => {
      const result = await previewVisitEmailDraftFromPc(projectId, visitId);
      if (!result.ok) {
        setError(result.error);
        setPreviewVisitId(null);
        return;
      }
      setPreview(result);
    });
  }

  function handleClosePreview() {
    if (isSubmitting) return;
    setPreview(null);
    setPreviewVisitId(null);
  }

  async function runEmailAction(
    payload: EmailConfirmPayload,
    mode: "draft" | "send"
  ) {
    if (!previewVisitId) return;
    setIsSubmitting(true);
    setError(null);
    try {
      const overrides = {
        subject: payload.subject,
        htmlBody: payload.htmlBody,
        recipients: payload.recipients,
        cc: payload.cc,
        resumeRequestedAt: payload.resumeRequestedAt,
      };

      if (mode === "draft") {
        const result = await prepareVisitEmailDraftFromPc(
          projectId,
          previewVisitId,
          overrides
        );
        if (!result.ok) {
          setError(result.error);
          return;
        }
        let msg = "Brouillon créé dans Outlook bureau → dossier Brouillons.";
        if (result.skipped.length > 0) {
          msg += ` Ignorés : ${result.skipped.join(" · ")}`;
        }
        setSuccess(msg);
        setDraftLink(result.webLink);
      } else {
        const result = await sendVisitEmailFromPc(projectId, previewVisitId, overrides);
        if (!result.ok) {
          setError(result.error);
          return;
        }
        let msg = `Mail envoyé à ${result.recipients.length} destinataire(s).`;
        if (result.skipped.length > 0) {
          msg += ` Ignorés : ${result.skipped.join(" · ")}`;
        }
        setSuccess(msg);
        setDraftLink(null);
      }

      setPreview(null);
      setPreviewVisitId(null);
      router.refresh();
    } finally {
      setIsSubmitting(false);
    }
  }

  if (visits.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
        Aucune visite enregistrée pour ce projet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Générez le PDF, composez le mail dans l&apos;application (objet, destinataires, copie,
        corps), puis <strong>envoyez</strong> ou enregistrez en <strong>brouillon Outlook</strong>.
      </p>

      {!m365Ready && m365Message && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <p className="font-semibold">Compte Microsoft 365 requis</p>
          <p className="mt-1">{m365Message}</p>
          <a href="/pc/profil" className="mt-2 inline-block font-semibold text-amber-800 underline">
            Aller au profil →
          </a>
        </div>
      )}

      {m365Ready && m365Email && (
        <p className="text-sm text-emerald-700">
          Mails envoyés depuis <strong>{m365Email}</strong>
        </p>
      )}

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Visite</th>
              <th className="px-4 py-3 font-semibold">Date</th>
              <th className="px-4 py-3 font-semibold">Phase</th>
              <th className="px-4 py-3 font-semibold">Récap</th>
              <th className="px-4 py-3 font-semibold">Rapport</th>
              <th className="px-4 py-3 font-semibold">Envoi / reprise</th>
              {canEdit && <th className="px-4 py-3 font-semibold">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {visits.map((visit) => (
              <tr key={visit.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium text-slate-900">
                  {visit.title ?? "Visite"}
                  {visit.status === "in_progress" && (
                    <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                      En cours
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {new Date(visit.visit_date).toLocaleDateString("fr-FR")}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {[visit.phaseName, visit.zoneName].filter(Boolean).join(" · ") || "—"}
                </td>
                <td className="px-4 py-3 text-xs text-slate-700">
                  <div className="flex flex-col gap-0.5">
                    <span>
                      <span className="font-semibold text-emerald-700">
                        {visit.conformCount}
                      </span>{" "}
                      conf.
                      <span className="mx-1 text-slate-300">·</span>
                      <span className="font-semibold text-red-600">
                        {visit.nonConformCount}
                      </span>{" "}
                      NC
                    </span>
                    <span className="text-slate-500">
                      {visit.freeRemarkCount} remarque
                      {visit.freeRemarkCount === 1 ? "" : "s"} libre
                      {visit.freeRemarkCount === 1 ? "" : "s"}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3">
                  {visit.reportUrl ? (
                    <a
                      href={visit.reportUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-emerald-700 hover:underline"
                    >
                      PDF
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-slate-600">
                  <div className="flex flex-col gap-0.5">
                    <span>
                      Envoi :{" "}
                      {visit.emailSentAt
                        ? new Date(visit.emailSentAt).toLocaleDateString("fr-FR")
                        : "—"}
                    </span>
                    <span>
                      Reprise :{" "}
                      {visit.resumeRequestedAt
                        ? new Date(visit.resumeRequestedAt).toLocaleDateString(
                            "fr-FR"
                          )
                        : "—"}
                    </span>
                  </div>
                </td>
                {canEdit && (
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {!visit.reportUrl && (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleGenerate(visit.id)}
                          className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-200"
                        >
                          Générer PDF
                        </button>
                      )}
                      <button
                        type="button"
                        disabled={isPending || visit.status !== "completed"}
                        onClick={() => handleOpenPreview(visit.id)}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-40"
                      >
                        Visualiser / mail
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {success && (
        <div className="rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
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
      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>
      )}

      {preview && (
        <EmailDraftPreviewModal
          preview={preview}
          m365Ready={m365Ready}
          isSubmitting={isSubmitting}
          onClose={handleClosePreview}
          onCreateDraft={(payload) => runEmailAction(payload, "draft")}
          onSend={(payload) => runEmailAction(payload, "send")}
        />
      )}
    </div>
  );
}
