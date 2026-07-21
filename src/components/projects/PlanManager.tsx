"use client";

import { useRouter } from "next/navigation";
import { useMemo, useRef, useState, useTransition } from "react";
import {
  createPlanFolder,
  deletePlan,
  deletePlanFolder,
  movePlanToFolder,
  uploadPlan,
} from "@/lib/actions/plans";
import type { Plan, PlanFolder } from "@/lib/types/database";
import { DocumentLink } from "@/components/documents/DocumentLink";

type PlanWithUrl = Plan & { pdf_url: string };

type PlanManagerProps = {
  projectId: string;
  initialPlans: PlanWithUrl[];
  initialFolders?: PlanFolder[];
};

export function PlanManager({
  projectId,
  initialPlans,
  initialFolders = [],
}: PlanManagerProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [planName, setPlanName] = useState("");
  const [uploadFolderId, setUploadFolderId] = useState("");
  const [newFolderName, setNewFolderName] = useState("");
  const [newFolderParentId, setNewFolderParentId] = useState("");

  const folderLabel = useMemo(() => {
    const map = new Map(initialFolders.map((f) => [f.id, f.name]));
    return (folderId: string | null) => {
      if (!folderId) return "Racine";
      return map.get(folderId) ?? "Dossier";
    };
  }, [initialFolders]);

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setSuccess(null);

    const formData = new FormData();
    formData.append("file", file);
    if (planName.trim()) formData.append("name", planName.trim());

    startTransition(async () => {
      try {
        await uploadPlan(projectId, formData, uploadFolderId || null);
        setPlanName("");
        if (fileInputRef.current) fileInputRef.current.value = "";
        setSuccess("Plan importé avec succès.");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur lors de l'import.");
      }
    });
  }

  function handleCreateFolder(e: React.FormEvent) {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await createPlanFolder(projectId, newFolderName, newFolderParentId || null);
        setNewFolderName("");
        setSuccess("Dossier créé.");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur.");
      }
    });
  }

  function handleDelete(planId: string) {
    if (!confirm("Supprimer ce plan PDF ?")) return;
    setError(null);
    startTransition(async () => {
      try {
        await deletePlan(projectId, planId);
        setSuccess("Plan supprimé.");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur lors de la suppression.");
      }
    });
  }

  function handleDeleteFolder(folderId: string) {
    if (!confirm("Supprimer ce dossier ? Les plans resteront à la racine.")) return;
    setError(null);
    startTransition(async () => {
      try {
        await deletePlanFolder(projectId, folderId);
        setSuccess("Dossier supprimé.");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur.");
      }
    });
  }

  function handleMovePlan(planId: string, folderId: string) {
    startTransition(async () => {
      try {
        await movePlanToFolder(projectId, planId, folderId || null);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur.");
      }
    });
  }

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="mb-1 text-lg font-semibold text-zinc-900">Plans PDF</h2>
      <p className="mb-4 text-sm text-zinc-500">
        Organisez les plans en dossiers et sous-dossiers, comme sur un ordinateur.
      </p>

      {initialFolders.length > 0 && (
        <div className="mb-4 rounded-xl bg-zinc-50 px-4 py-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">
            Dossiers
          </p>
          <ul className="space-y-1">
            {initialFolders.map((folder) => (
              <li key={folder.id} className="flex items-center justify-between text-sm">
                <span>
                  📁 {folder.name}
                  {folder.parent_id
                    ? ` (dans ${folderLabel(folder.parent_id)})`
                    : ""}
                </span>
                <button
                  type="button"
                  onClick={() => handleDeleteFolder(folder.id)}
                  className="text-xs text-red-600"
                >
                  Supprimer
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}

      {initialPlans.length === 0 ? (
        <p className="mb-4 rounded-xl bg-zinc-50 px-4 py-3 text-sm text-zinc-500">
          Aucun plan importé. Ajoutez un PDF pour commencer.
        </p>
      ) : (
        <ul className="mb-4 space-y-3">
          {initialPlans.map((plan) => (
            <li
              key={plan.id}
              className="flex flex-col gap-2 rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-zinc-900">{plan.name}</p>
                <p className="text-sm text-zinc-500">{folderLabel(plan.folder_id)}</p>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <select
                  value={plan.folder_id ?? ""}
                  onChange={(e) => handleMovePlan(plan.id, e.target.value)}
                  className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs"
                >
                  <option value="">Racine</option>
                  {initialFolders.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
                <DocumentLink
                  url={plan.pdf_url}
                  title={plan.name}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100"
                >
                  Voir
                </DocumentLink>
                <button
                  type="button"
                  onClick={() => handleDelete(plan.id)}
                  disabled={isPending}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  Supprimer
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={handleCreateFolder} className="mb-4 space-y-2 border-t border-zinc-100 pt-4">
        <h3 className="font-semibold text-zinc-800">Nouveau dossier</h3>
        <input
          value={newFolderName}
          onChange={(e) => setNewFolderName(e.target.value)}
          placeholder="Nom du dossier (ex. Architecture, RDC…)"
          className="w-full rounded-xl border-2 border-zinc-200 bg-zinc-50 px-4 py-3 text-base"
        />
        <select
          value={newFolderParentId}
          onChange={(e) => setNewFolderParentId(e.target.value)}
          className="w-full rounded-xl border-2 border-zinc-200 bg-zinc-50 px-4 py-3 text-base"
        >
          <option value="">Dossier parent : racine</option>
          {initialFolders.map((f) => (
            <option key={f.id} value={f.id}>
              Dans : {f.name}
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={isPending}
          className="min-h-10 w-full rounded-xl bg-zinc-800 px-4 py-2 text-sm font-semibold text-white"
        >
          Créer le dossier
        </button>
      </form>

      <div className="space-y-3 border-t border-zinc-100 pt-4">
        <h3 className="font-semibold text-zinc-800">Importer un plan PDF</h3>
        <select
          value={uploadFolderId}
          onChange={(e) => setUploadFolderId(e.target.value)}
          className="w-full rounded-xl border-2 border-zinc-200 bg-zinc-50 px-4 py-3 text-base"
        >
          <option value="">Importer à la racine</option>
          {initialFolders.map((f) => (
            <option key={f.id} value={f.id}>
              Dans : {f.name}
            </option>
          ))}
        </select>
        <input
          type="text"
          value={planName}
          onChange={(e) => setPlanName(e.target.value)}
          placeholder="Nom du plan (optionnel)"
          className="w-full rounded-xl border-2 border-zinc-200 bg-zinc-50 px-4 py-3 text-base text-zinc-800 placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white focus:outline-none"
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,.pdf"
          onChange={handleUpload}
          disabled={isPending}
          className="w-full rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 px-4 py-4 text-sm text-zinc-600 file:mr-4 file:rounded-lg file:border-0 file:bg-zinc-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-zinc-800"
        />
        {isPending && <p className="text-sm text-zinc-500">Import en cours…</p>}
      </div>

      {error && (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
      {success && (
        <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          {success}
        </p>
      )}
    </section>
  );
}
