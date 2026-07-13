"use client";

import { useState } from "react";
import { FileSortForm } from "@/components/finance/FileSortForm";
import { useOutlookMailItem } from "@/components/outlook/useOutlookMailItem";
import type { FinanceProjectOption } from "@/lib/actions/incoming-files";

type OutlookFileSortPaneProps = {
  projects: FinanceProjectOption[];
};

export function OutlookFileSortPane({ projects }: OutlookFileSortPaneProps) {
  const { ready, outsideOutlook, mail, error, loadAttachmentFile } =
    useOutlookMailItem();
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [selectedAttachmentId, setSelectedAttachmentId] = useState<string | null>(
    null
  );
  const [loadedFile, setLoadedFile] = useState<File | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [classifiedIds, setClassifiedIds] = useState<Set<string>>(new Set());

  async function handleSelectAttachment(attachmentId: string) {
    setSelectedAttachmentId(attachmentId);
    setLoadError(null);
    setLoadedFile(null);
    setLoadingFile(true);

    try {
      const file = await loadAttachmentFile(attachmentId);
      setLoadedFile(file);
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : "Erreur de chargement du fichier."
      );
    } finally {
      setLoadingFile(false);
    }
  }

  if (outsideOutlook) {
    return (
      <div className="p-4 text-sm text-amber-800">
        Ce volet doit être ouvert depuis Outlook (bouton <strong>Classer</strong>{" "}
        dans la barre d&apos;outils d&apos;un mail).
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="p-4 text-sm text-slate-500">Connexion à Outlook…</div>
    );
  }

  if (error) {
    return <div className="p-4 text-sm text-red-700">{error}</div>;
  }

  if (!mail) {
    return (
      <div className="p-4 text-sm text-slate-500">Aucun mail détecté.</div>
    );
  }

  return (
    <div className="space-y-4 p-4">
      <header className="rounded-xl bg-slate-50 px-3 py-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Mail ouvert
        </p>
        <p className="mt-1 text-sm font-medium text-slate-900 line-clamp-2">
          {mail.subject || "(sans objet)"}
        </p>
        <p className="mt-0.5 text-xs text-slate-500">
          {mail.fromName ? `${mail.fromName} · ` : ""}
          {mail.fromEmail}
        </p>
      </header>

      {projects.length === 0 ? (
        <p className="text-sm text-amber-700">
          Aucun projet accessible avec droits financiers.
        </p>
      ) : (
        <section>
          <label className="mb-1 block text-xs font-semibold text-slate-600">
            Projet
          </label>
          <select
            value={projectId}
            onChange={(e) => setProjectId(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </section>
      )}

      <section>
        <p className="mb-2 text-sm font-semibold text-slate-700">
          Pièces jointes ({mail.attachments.length})
        </p>
        {mail.attachments.length === 0 ? (
          <p className="text-sm text-slate-500">
            Ce mail ne contient pas de pièce jointe.
          </p>
        ) : (
          <div className="space-y-2">
            {mail.attachments.map((att) => {
              const isClassified = classifiedIds.has(att.id);
              const isSelected = selectedAttachmentId === att.id;

              return (
                <button
                  key={att.id}
                  type="button"
                  disabled={isClassified}
                  onClick={() => handleSelectAttachment(att.id)}
                  className={`w-full rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                    isClassified
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : isSelected
                        ? "border-blue-400 bg-blue-50 text-blue-900"
                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  <span className="font-medium">{att.name}</span>
                  <span className="ml-2 text-xs opacity-60">
                    {(att.size / 1024).toFixed(0)} Ko
                  </span>
                  {isClassified && (
                    <span className="ml-2 text-xs font-semibold">✓ Classé</span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </section>

      {loadingFile && (
        <p className="text-sm text-slate-500">Chargement de la pièce jointe…</p>
      )}
      {loadError && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {loadError}
        </p>
      )}

      {loadedFile && projectId && (
        <FileSortForm
          key={`${projectId}-${selectedAttachmentId}-${loadedFile.name}`}
          projectId={projectId}
          file={loadedFile}
          sourceEmail={mail.fromEmail}
          defaultNotes={mail.subject}
          compact
          submitLabel="Classer dans le suivi"
          onClassified={() => {
            if (selectedAttachmentId) {
              setClassifiedIds((prev) => new Set(prev).add(selectedAttachmentId));
            }
          }}
        />
      )}
    </div>
  );
}
