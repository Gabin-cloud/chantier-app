"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  previewAdminPiecesRejectionEmail,
  reviewAdminPieceSubmission,
  sendAdminPiecesRejectionEmail,
  createAdminPiecesRejectionDraft,
  uploadAdminPieceFile,
} from "@/lib/actions/admin-pieces";
import { AdminPieceStatusBadge } from "@/components/marche/AdminPieceStatusBadge";
import { AdminPieceFileAttach } from "@/components/marche/AdminPieceFileAttach";
import { ADMIN_PIECE_STATUS_LABELS } from "@/lib/admin-pieces/status";
import type { EnterpriseAdminControlData } from "@/lib/types/admin-pieces";
import type { Enterprise } from "@/lib/types/database";
import { ModalPanel } from "@/components/ui/ModalPanel";
import { RichTextEditor } from "@/components/ui/RichTextEditor";

type AdminPiecesControlPanelProps = {
  projectId: string;
  enterprises: Enterprise[];
  initialEnterpriseId: string | null;
  controlData: EnterpriseAdminControlData | null;
  canEdit: boolean;
  m365Ready: boolean;
};

const selectClass =
  "w-full max-w-md rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200";

export function AdminPiecesControlPanel({
  projectId,
  enterprises,
  initialEnterpriseId,
  controlData,
  canEdit,
  m365Ready,
}: AdminPiecesControlPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [activeCommentPieceId, setActiveCommentPieceId] = useState<string | null>(
    null
  );
  const [commentDraft, setCommentDraft] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [emailPreview, setEmailPreview] = useState<{
    subject: string;
    htmlBody: string;
    recipients: { email: string; name: string }[];
    defaultCc: string;
  } | null>(null);
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [emailCc, setEmailCc] = useState("");

  const selectedId = initialEnterpriseId ?? enterprises[0]?.id ?? "";

  const enterpriseOptions = useMemo(
    () =>
      enterprises.map((e) => ({
        id: e.id,
        label: [e.lot_number && `Lot ${e.lot_number}`, e.name]
          .filter(Boolean)
          .join(" — "),
      })),
    [enterprises]
  );

  function onEnterpriseChange(enterpriseId: string) {
    router.push(
      `/pc/projets/${projectId}/marche/pieces?enterprise=${enterpriseId}`
    );
  }

  function handleReview(
    pieceId: string,
    status: "validated" | "rejected",
    rejectionComment?: string
  ) {
    if (!controlData) return;
    setError(null);
    setMessage(null);

    startTransition(async () => {
      try {
        await reviewAdminPieceSubmission(
          projectId,
          controlData.enterprise.id,
          pieceId,
          { status, rejection_comment: rejectionComment }
        );
        setMessage(
          status === "validated" ? "Pièce validée." : "Pièce refusée — commentaire enregistré."
        );
        setActiveCommentPieceId(null);
        setCommentDraft("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur.");
      }
    });
  }

  function handleUpload(pieceId: string, file: File) {
    if (!controlData) return;
    setError(null);
    setMessage(null);

    const formData = new FormData();
    formData.set("file", file);

    startTransition(async () => {
      try {
        await uploadAdminPieceFile(
          projectId,
          controlData.enterprise.id,
          pieceId,
          formData
        );
        setMessage("Fichier enregistré — vous pouvez le contrôler.");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur lors du dépôt.");
      }
    });
  }

  function openEmailPreview() {
    if (!controlData) return;
    setError(null);
    startTransition(async () => {
      const result = await previewAdminPiecesRejectionEmail(
        projectId,
        controlData.enterprise.id
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setEmailPreview(result.preview);
      setEmailSubject(result.preview.subject);
      setEmailBody(result.preview.htmlBody);
      setEmailCc(result.preview.defaultCc);
    });
  }

  function sendEmail(action: "send" | "draft") {
    if (!controlData || !emailPreview) return;
    setError(null);

    startTransition(async () => {
      const payload = {
        subject: emailSubject,
        htmlBody: emailBody,
        recipients: emailPreview.recipients,
        cc: emailCc,
      };

      const result =
        action === "send"
          ? await sendAdminPiecesRejectionEmail(
              projectId,
              controlData.enterprise.id,
              payload
            )
          : await createAdminPiecesRejectionDraft(
              projectId,
              controlData.enterprise.id,
              payload
            );

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setMessage(
        action === "send"
          ? "Mail envoyé à l'entreprise."
          : "Brouillon Outlook créé."
      );
      setEmailPreview(null);
    });
  }

  return (
    <div className="space-y-4">
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-slate-500">
          Entreprise à contrôler
        </label>
        <select
          className={selectClass}
          value={selectedId}
          onChange={(e) => onEnterpriseChange(e.target.value)}
        >
          {enterpriseOptions.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {opt.label}
            </option>
          ))}
        </select>
      </section>

      {message && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {message}
        </p>
      )}
      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {!controlData ? (
        <p className="text-sm text-slate-500">Sélectionnez une entreprise.</p>
      ) : (
        <>
          <div className="space-y-3">
            {controlData.pieces.map((item) => {
              const showComment = activeCommentPieceId === item.piece.id;

              return (
                <article
                  key={item.piece.id}
                  className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold text-slate-900">
                          {item.piece.name}
                        </h3>
                        <AdminPieceStatusBadge status={item.status} />
                        <span className="text-xs text-slate-500">
                          {ADMIN_PIECE_STATUS_LABELS[item.status]}
                        </span>
                      </div>
                      {item.piece.control_notes && (
                        <p className="mt-2 text-xs text-slate-500">
                          <span className="font-semibold text-slate-600">
                            Aide au contrôle :
                          </span>{" "}
                          {item.piece.control_notes}
                        </p>
                      )}
                      {item.submission?.rejection_comment && (
                        <p className="mt-2 rounded-lg bg-red-50 px-2 py-1 text-xs text-red-700">
                          {item.submission.rejection_comment}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-start gap-3">
                      {item.fileUrl && (
                        <a
                          href={item.fileUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                        >
                          Visualiser
                          {item.submission?.file_name
                            ? ` (${item.submission.file_name})`
                            : ""}
                        </a>
                      )}
                      {canEdit && (
                        <AdminPieceFileAttach
                          managerMode
                          isPending={isPending}
                          fileName={item.submission?.file_name}
                          onFile={(file) => handleUpload(item.piece.id, file)}
                        />
                      )}
                    </div>
                  </div>

                  {canEdit && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                      <button
                        type="button"
                        disabled={isPending || !item.submission?.file_path}
                        onClick={() => handleReview(item.piece.id, "validated")}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-40"
                      >
                        Validé
                      </button>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => {
                          setActiveCommentPieceId(
                            showComment ? null : item.piece.id
                          );
                          setCommentDraft(item.submission?.rejection_comment ?? "");
                        }}
                        className="rounded-lg border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-40"
                      >
                        Non validé
                      </button>
                    </div>
                  )}

                  {showComment && canEdit && (
                    <div className="mt-3 rounded-lg border border-red-100 bg-red-50/50 p-3">
                      <label className="mb-1 block text-xs font-semibold text-red-800">
                        Commentaire pour l&apos;entreprise
                      </label>
                      <textarea
                        value={commentDraft}
                        onChange={(e) => setCommentDraft(e.target.value)}
                        rows={3}
                        className="w-full rounded-lg border border-red-200 px-3 py-2 text-sm text-slate-900 outline-none focus:border-red-300"
                        placeholder="Précisez ce qui doit être corrigé ou complété…"
                      />
                      <div className="mt-2 flex justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setActiveCommentPieceId(null)}
                          className="rounded-lg px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-white"
                        >
                          Annuler
                        </button>
                        <button
                          type="button"
                          disabled={isPending || !commentDraft.trim()}
                          onClick={() =>
                            handleReview(item.piece.id, "rejected", commentDraft)
                          }
                          className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-40"
                        >
                          Enregistrer le refus
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>

          {canEdit && (
            <footer className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="text-sm font-semibold text-slate-900">
                Mail récapitulatif
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Générez un e-mail listant les pièces non validées à renvoyer à
                l&apos;entreprise.
              </p>
              <button
                type="button"
                disabled={isPending}
                onClick={openEmailPreview}
                className="mt-3 rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-40"
              >
                Préparer le mail récap
              </button>
            </footer>
          )}
        </>
      )}

      {emailPreview && (
        <ModalPanel
          title="Mail récap — pièces à reprendre"
          subtitle={controlData?.enterprise.name}
          onClose={() => setEmailPreview(null)}
          maxWidth="2xl"
        >
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                Objet
              </label>
              <input
                type="text"
                value={emailSubject}
                onChange={(e) => setEmailSubject(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                Destinataire
              </label>
              <p className="text-sm text-slate-700">
                {emailPreview.recipients.map((r) => r.email).join(", ")}
              </p>
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                Copie (Cc)
              </label>
              <input
                type="text"
                value={emailCc}
                onChange={(e) => setEmailCc(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-semibold uppercase text-slate-500">
                Corps du message
              </label>
              <RichTextEditor
                value={emailBody}
                onChange={setEmailBody}
                minHeight="220px"
              />
            </div>
            {!m365Ready && (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
                Connectez Microsoft 365 dans Profil pour envoyer le mail.
              </p>
            )}
            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
              <button
                type="button"
                onClick={() => setEmailPreview(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Annuler
              </button>
              <button
                type="button"
                disabled={isPending || !m365Ready}
                onClick={() => sendEmail("draft")}
                className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 disabled:opacity-40"
              >
                Brouillon Outlook
              </button>
              <button
                type="button"
                disabled={isPending || !m365Ready}
                onClick={() => sendEmail("send")}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
              >
                Envoyer
              </button>
            </div>
          </div>
        </ModalPanel>
      )}
    </div>
  );
}
