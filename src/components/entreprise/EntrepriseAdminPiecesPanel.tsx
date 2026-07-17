"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import Link from "next/link";
import { uploadAdminPieceFile } from "@/lib/actions/admin-pieces";
import { AdminPieceStatusBadge } from "@/components/marche/AdminPieceStatusBadge";
import { ADMIN_PIECE_STATUS_LABELS } from "@/lib/admin-pieces/status";
import type { EnterpriseAdminControlData } from "@/lib/types/admin-pieces";
import type { Project } from "@/lib/types/database";

type EntrepriseAdminPiecesPanelProps = {
  project: Project;
  controlData: EnterpriseAdminControlData;
};

export function EntrepriseAdminPiecesPanel({
  project,
  controlData,
}: EntrepriseAdminPiecesPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleUpload(pieceId: string, file: File) {
    setError(null);
    setMessage(null);
    const formData = new FormData();
    formData.set("file", file);

    startTransition(async () => {
      try {
        await uploadAdminPieceFile(
          project.id,
          controlData.enterprise.id,
          pieceId,
          formData
        );
        setMessage("Pièce déposée — en attente de contrôle DANOBAT.");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur lors du dépôt.");
      }
    });
  }

  return (
    <div className="mx-auto w-full max-w-2xl">
      <header className="mb-6 rounded-2xl bg-white px-6 py-5 shadow-sm ring-1 ring-amber-100">
        <Link
          href={`/entreprise/projets/${project.id}`}
          className="text-sm font-medium text-amber-600 hover:text-amber-700"
        >
          ← Retour au chantier
        </Link>
        <h1 className="mt-3 text-2xl font-bold text-zinc-900">Pièces administratives</h1>
        <p className="mt-2 text-zinc-500">{project.name}</p>
      </header>

      {message && (
        <p className="mb-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {message}
        </p>
      )}
      {error && (
        <p className="mb-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      <div className="space-y-3">
        {controlData.pieces.map((item) => (
          <article
            key={item.piece.id}
            className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm"
          >
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-semibold text-zinc-900">{item.piece.name}</h2>
              <AdminPieceStatusBadge status={item.status} />
              <span className="text-xs text-zinc-500">
                {ADMIN_PIECE_STATUS_LABELS[item.status]}
              </span>
            </div>
            {item.submission?.rejection_comment && (
              <p className="mt-2 rounded-lg bg-red-50 px-2 py-1 text-xs text-red-700">
                {item.submission.rejection_comment}
              </p>
            )}
            <div className="mt-3 flex flex-wrap gap-2">
              {item.fileUrl && (
                <a
                  href={item.fileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-semibold text-amber-700"
                >
                  Voir le fichier déposé
                </a>
              )}
              {(item.status === "pending" ||
                item.status === "rejected" ||
                item.status === "submitted") && (
                <label className="cursor-pointer rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-500">
                  {isPending ? "Envoi…" : "Déposer / remplacer"}
                  <input
                    type="file"
                    className="hidden"
                    accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleUpload(item.piece.id, file);
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
