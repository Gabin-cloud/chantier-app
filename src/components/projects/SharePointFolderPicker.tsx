"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { ModalPanel } from "@/components/ui/ModalPanel";
import {
  browseSharePointFolderForProject,
  selectSharePointPlanExeFolder,
} from "@/lib/actions/sharepoint-settings";
import { needsMicrosoftConsentRenewal } from "@/lib/microsoft/errors";

type SharePointFolderPickerProps = {
  projectId: string;
  currentPath: string;
  open: boolean;
  onClose: () => void;
  onSelected: (path: string) => void;
};

type BrowseState = {
  ok: boolean;
  currentPath: string;
  driveName: string;
  items: { name: string; isFolder: boolean }[];
  error?: string;
};

export function SharePointFolderPicker({
  projectId,
  currentPath,
  open,
  onClose,
  onSelected,
}: SharePointFolderPickerProps) {
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  const [browsePath, setBrowsePath] = useState("");
  const [browseState, setBrowseState] = useState<BrowseState | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setBrowsePath(currentPath);
    setActionError(null);
  }, [open, currentPath]);

  useEffect(() => {
    if (!open) return;

    startTransition(async () => {
      const result = await browseSharePointFolderForProject(
        projectId,
        browsePath
      );
      setBrowseState(result);
    });
  }, [open, browsePath, projectId]);

  function openFolder(name: string) {
    setActionError(null);
    setBrowsePath((prev) => (prev ? `${prev}/${name}` : name));
  }

  function navigateToBreadcrumb(index: number) {
    setActionError(null);
    if (index < 0) {
      setBrowsePath("");
      return;
    }
    const segments = browsePath.split("/").filter(Boolean);
    setBrowsePath(segments.slice(0, index + 1).join("/"));
  }

  function handleSelectCurrentFolder() {
    setActionError(null);
    startTransition(async () => {
      try {
        const savedPath = await selectSharePointPlanExeFolder(
          projectId,
          browsePath
        );
        onSelected(savedPath);
        onClose();
      } catch (err) {
        setActionError(
          err instanceof Error ? err.message : "Impossible d'enregistrer le dossier."
        );
      }
    });
  }

  if (!open) return null;

  const breadcrumbs = browsePath.split("/").filter(Boolean);
  const folders =
    browseState?.items.filter((item) => item.isFolder).sort((a, b) =>
      a.name.localeCompare(b.name, "fr", { sensitivity: "base" })
    ) ?? [];

  const displayError = actionError ?? browseState?.error ?? null;
  const consentRequired = displayError
    ? needsMicrosoftConsentRenewal(displayError)
    : false;
  const consentUrl = `/api/auth/microsoft?consent=1&returnTo=${encodeURIComponent(pathname)}`;

  return (
    <ModalPanel
      title="Choisir un dossier SharePoint"
      subtitle={
        browseState?.driveName
          ? `Bibliothèque ${browseState.driveName}`
          : "Parcourez vos dossiers sur le serveur"
      }
      onClose={onClose}
      maxWidth="lg"
    >
      <div className="space-y-4">
        <nav className="flex flex-wrap items-center gap-1 rounded-xl bg-slate-50 px-3 py-2 text-sm">
          <button
            type="button"
            onClick={() => navigateToBreadcrumb(-1)}
            className="font-medium text-blue-600 hover:underline"
          >
            Racine
          </button>
          {breadcrumbs.map((segment, index) => (
            <span key={`${segment}-${index}`} className="flex items-center gap-1">
              <span className="text-slate-300">/</span>
              <button
                type="button"
                onClick={() => navigateToBreadcrumb(index)}
                className="font-medium text-blue-600 hover:underline"
              >
                {segment}
              </button>
            </span>
          ))}
        </nav>

        {isPending && !browseState && (
          <p className="text-sm text-slate-500">Chargement des dossiers…</p>
        )}

        {displayError && (
          <div className="space-y-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            <p>{displayError}</p>
            {consentRequired && (
              <Link
                href={consentUrl}
                className="inline-flex rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Autoriser SharePoint
              </Link>
            )}
          </div>
        )}

        {browseState?.ok && (
          <div className="rounded-xl border border-slate-200">
            {folders.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-slate-500">
                Aucun sous-dossier ici. Vous pouvez quand même choisir ce
                dossier.
              </p>
            ) : (
              <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
                {folders.map((folder) => (
                  <li key={folder.name}>
                    <button
                      type="button"
                      onClick={() => openFolder(folder.name)}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm hover:bg-slate-50"
                    >
                      <span className="text-lg">📁</span>
                      <span className="font-medium text-slate-800">
                        {folder.name}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2">
          <p className="text-xs font-semibold uppercase text-blue-500">
            Dossier sélectionné
          </p>
          <p className="mt-1 break-all text-sm text-blue-900">
            {browsePath.trim() || "(racine de la bibliothèque)"}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={isPending}
            onClick={handleSelectCurrentFolder}
            className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isPending ? "Enregistrement…" : "Choisir ce dossier"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Annuler
          </button>
        </div>
      </div>
    </ModalPanel>
  );
}
