"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { SharePointFolderPicker } from "@/components/projects/SharePointFolderPicker";
import { checkSharePointConnection } from "@/lib/actions/sharepoint-settings";
import type { Project } from "@/lib/types/database";

type SharePointPathSettingsProps = {
  project: Project;
  canEdit: boolean;
};

export function SharePointPathSettings({
  project,
  canEdit,
}: SharePointPathSettingsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [planExePath, setPlanExePath] = useState(
    project.sharepoint_plan_exe_path ?? ""
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<string | null>(null);

  function handleTestConnection() {
    setConnectionStatus(null);
    setError(null);

    startTransition(async () => {
      const result = await checkSharePointConnection();
      if (result.ok) {
        setConnectionStatus(
          `Connecté — bibliothèque « ${result.driveName} » accessible.`
        );
      } else {
        const drivesHint = result.availableDrives?.length
          ? ` Bibliothèques visibles : ${result.availableDrives.join(", ")}.`
          : "";
        setError((result.error ?? "Connexion SharePoint impossible.") + drivesHint);
      }
    });
  }

  return (
    <>
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-1 text-lg font-semibold text-zinc-900">
          SharePoint — Lien serveur
        </h2>
        <p className="mb-4 text-sm text-zinc-500">
          Parcourez le serveur SharePoint et choisissez le dossier de ce
          chantier. Connectez d&apos;abord votre compte Microsoft 365 dans{" "}
          <strong>Profil</strong>.
        </p>

        {canEdit && (
          <div className="mb-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                setError(null);
                setPickerOpen(true);
              }}
              disabled={isPending}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Parcourir SharePoint…
            </button>
            <button
              type="button"
              onClick={handleTestConnection}
              disabled={isPending}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Tester la connexion
            </button>
          </div>
        )}

        {connectionStatus && (
          <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {connectionStatus}
          </p>
        )}

        <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <p className="text-xs font-semibold uppercase text-slate-500">
            Dossier choisi pour ce chantier
          </p>
          {planExePath.trim() ? (
            <p className="mt-1 break-all text-sm font-medium text-slate-900">
              {planExePath}
            </p>
          ) : (
            <p className="mt-1 text-sm text-amber-700">
              Aucun dossier sélectionné — cliquez sur « Parcourir SharePoint ».
            </p>
          )}
        </div>

        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}
        {message && (
          <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {message}
          </p>
        )}
      </section>

      {canEdit && (
        <SharePointFolderPicker
          projectId={project.id}
          currentPath={planExePath}
          open={pickerOpen}
          onClose={() => setPickerOpen(false)}
          onSelected={(path) => {
            setPlanExePath(path);
            setMessage("Dossier SharePoint enregistré.");
            setError(null);
            router.refresh();
          }}
        />
      )}
    </>
  );
}
