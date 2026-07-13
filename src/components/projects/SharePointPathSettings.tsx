"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { SharePointFolderPicker } from "@/components/projects/SharePointFolderPicker";
import {
  checkSharePointConnection,
  updateEnterpriseSharePointFolder,
} from "@/lib/actions/sharepoint-settings";
import type { Enterprise, Project } from "@/lib/types/database";

type SharePointPathSettingsProps = {
  project: Project;
  enterprises: Enterprise[];
  canEdit: boolean;
};

export function SharePointPathSettings({
  project,
  enterprises,
  canEdit,
}: SharePointPathSettingsProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [planExePath, setPlanExePath] = useState(
    project.sharepoint_plan_exe_path ?? ""
  );
  const [pickerOpen, setPickerOpen] = useState(false);
  const [folderNames, setFolderNames] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      enterprises.map((e) => [e.id, e.sharepoint_folder_name ?? ""])
    )
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<string | null>(null);

  function handleSaveEnterpriseFolder(enterpriseId: string) {
    setError(null);
    setMessage(null);

    startTransition(async () => {
      const result = await updateEnterpriseSharePointFolder(
        project.id,
        enterpriseId,
        folderNames[enterpriseId] ?? ""
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setMessage("Dossier entreprise enregistré.");
      router.refresh();
    });
  }

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

  function previewEnterpriseFolder(enterprise: Enterprise) {
    const custom = folderNames[enterprise.id]?.trim();
    if (custom) return custom;
    if (enterprise.lot_number && enterprise.designation) {
      return `Lot ${enterprise.lot_number} - ${enterprise.designation}`;
    }
    if (enterprise.lot_number) return `Lot ${enterprise.lot_number}`;
    return enterprise.name;
  }

  return (
    <>
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-1 text-lg font-semibold text-zinc-900">
          SharePoint — Plans d&apos;exé
        </h2>
        <p className="mb-4 text-sm text-zinc-500">
          Parcourez le serveur SharePoint et choisissez le dossier de ce
          chantier. Connectez d&apos;abord votre compte Microsoft 365 dans{" "}
          <strong>Profil</strong> (puis reconnectez-le une fois pour valider
          l&apos;accès SharePoint).
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
          {planExePath.trim() && (
            <p className="mt-2 text-xs text-slate-500">
              Exemple de dépôt :{" "}
              <code className="rounded bg-white px-1">
                {planExePath}/Lot 03 - Plomberie/2026-07-13_plan.pdf
              </code>
            </p>
          )}
        </div>

        {enterprises.length > 0 && (
          <div className="mt-6 border-t border-zinc-100 pt-4">
            <h3 className="mb-2 font-semibold text-zinc-800">
              Dossiers par entreprise (optionnel)
            </h3>
            <p className="mb-3 text-xs text-zinc-500">
              Laissez vide pour utiliser le nom automatique (Lot + désignation).
            </p>
            <ul className="space-y-3">
              {enterprises.map((enterprise) => (
                <li
                  key={enterprise.id}
                  className="rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-3"
                >
                  <p className="text-sm font-medium text-zinc-900">
                    {enterprise.name}
                  </p>
                  <p className="text-xs text-zinc-500">
                    Dossier cible : {previewEnterpriseFolder(enterprise)}
                  </p>
                  {canEdit && (
                    <div className="mt-2 flex gap-2">
                      <input
                        value={folderNames[enterprise.id] ?? ""}
                        onChange={(e) =>
                          setFolderNames((prev) => ({
                            ...prev,
                            [enterprise.id]: e.target.value,
                          }))
                        }
                        placeholder="Nom personnalisé (optionnel)"
                        className="flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm"
                      />
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleSaveEnterpriseFolder(enterprise.id)}
                        className="shrink-0 rounded-lg bg-zinc-800 px-3 py-2 text-xs font-semibold text-white hover:bg-zinc-700 disabled:opacity-50"
                      >
                        OK
                      </button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

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
          }}
        />
      )}
    </>
  );
}
