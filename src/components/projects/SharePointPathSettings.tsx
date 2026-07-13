"use client";

import { useState, useTransition } from "react";
import {
  browseSharePointFolder,
  checkSharePointConnection,
  updateEnterpriseSharePointFolder,
  updateProjectSharePointPath,
} from "@/lib/actions/sharepoint-settings";
import type { Enterprise, Project } from "@/lib/types/database";

type SharePointPathSettingsProps = {
  project: Project;
  enterprises: Enterprise[];
  canEdit: boolean;
};

const inputClass =
  "w-full rounded-xl border-2 border-zinc-200 bg-zinc-50 px-4 py-3 text-base text-zinc-800 placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white focus:outline-none";

export function SharePointPathSettings({
  project,
  enterprises,
  canEdit,
}: SharePointPathSettingsProps) {
  const [isPending, startTransition] = useTransition();
  const [planExePath, setPlanExePath] = useState(
    project.sharepoint_plan_exe_path ?? ""
  );
  const [folderNames, setFolderNames] = useState<Record<string, string>>(() =>
    Object.fromEntries(
      enterprises.map((e) => [e.id, e.sharepoint_folder_name ?? ""])
    )
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<string | null>(null);
  const [browseResult, setBrowseResult] = useState<
    { name: string; isFolder: boolean }[] | null
  >(null);

  function handleSavePath(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    startTransition(async () => {
      try {
        await updateProjectSharePointPath(project.id, planExePath);
        setMessage("Chemin SharePoint enregistré.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur.");
      }
    });
  }

  function handleSaveEnterpriseFolder(enterpriseId: string) {
    setError(null);
    setMessage(null);

    startTransition(async () => {
      try {
        await updateEnterpriseSharePointFolder(
          project.id,
          enterpriseId,
          folderNames[enterpriseId] ?? ""
        );
        setMessage("Dossier entreprise enregistré.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur.");
      }
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
        setError(result.error ?? "Connexion SharePoint impossible.");
      }
    });
  }

  function handleBrowsePath() {
    setBrowseResult(null);
    setError(null);

    startTransition(async () => {
      try {
        const items = await browseSharePointFolder(planExePath.trim());
        setBrowseResult(
          items.map((item) => ({ name: item.name, isFolder: item.isFolder }))
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Impossible de lister le dossier.");
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
    <section className="rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="mb-1 text-lg font-semibold text-zinc-900">
        SharePoint — Plans d&apos;exé
      </h2>
      <p className="mb-4 text-sm text-zinc-500">
        Chemin dans la bibliothèque SERVEUR, relatif à la racine. Chaque lot
        entreprise aura son sous-dossier automatiquement.
      </p>

      {canEdit && (
        <div className="mb-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isPending}
            className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Tester la connexion
          </button>
          {planExePath.trim() && (
            <button
              type="button"
              onClick={handleBrowsePath}
              disabled={isPending}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Voir le contenu du dossier
            </button>
          )}
        </div>
      )}

      {connectionStatus && (
        <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {connectionStatus}
        </p>
      )}

      <form onSubmit={handleSavePath} className="space-y-3">
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700">
            Chemin des plans d&apos;exé (ce chantier)
          </label>
          <input
            value={planExePath}
            onChange={(e) => setPlanExePath(e.target.value)}
            disabled={!canEdit || isPending}
            placeholder="Ex. MON CHANTIER/02-Plans/Plans d'exécution"
            className={inputClass}
          />
          <p className="mt-1 text-xs text-zinc-400">
            Exemple complet :{" "}
            <code className="rounded bg-zinc-100 px-1">
              {planExePath.trim() || "VOTRE CHEMIN"}/Lot 03 - Plomberie/
              2026-07-13_plan.pdf
            </code>
          </p>
        </div>

        {canEdit && (
          <button
            type="submit"
            disabled={isPending}
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending ? "Enregistrement…" : "Enregistrer le chemin"}
          </button>
        )}
      </form>

      {browseResult && (
        <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 px-4 py-3">
          <p className="mb-2 text-xs font-semibold uppercase text-slate-500">
            Contenu du dossier ({browseResult.length})
          </p>
          {browseResult.length === 0 ? (
            <p className="text-sm text-slate-500">Dossier vide ou inexistant.</p>
          ) : (
            <ul className="max-h-40 space-y-1 overflow-y-auto text-sm text-slate-700">
              {browseResult.map((item) => (
                <li key={item.name}>
                  {item.isFolder ? "📁" : "📄"} {item.name}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

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
  );
}
