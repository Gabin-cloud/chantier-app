"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  addVisitPhase,
  deleteVisitPhase,
  updateVisitPhase,
} from "@/lib/actions/phases";
import { importControlLibraryToProject } from "@/lib/actions/control-library";
import type { PhaseChecklistItem, VisitPhase } from "@/lib/types/database";
import type { WorkControlPlanType } from "@/lib/types/work-control";

type PhaseManagerProps = {
  projectId: string;
  phases: VisitPhase[];
  checklistItems: PhaseChecklistItem[];
  planTypes?: WorkControlPlanType[];
  canEdit: boolean;
};

export function PhaseManager({
  projectId,
  phases,
  checklistItems,
  planTypes = [],
  canEdit,
}: PhaseManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [newPhaseName, setNewPhaseName] = useState("");
  const [editingPhaseId, setEditingPhaseId] = useState<string | null>(null);
  const [editPhaseName, setEditPhaseName] = useState("");
  const [selectedPhaseId, setSelectedPhaseId] = useState(phases[0]?.id ?? "");

  const selectedPhase = phases.find((p) => p.id === selectedPhaseId) ?? null;

  const phaseControls = useMemo(
    () =>
      checklistItems
        .filter((i) => i.phase_id === selectedPhaseId)
        .sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label, "fr")),
    [checklistItems, selectedPhaseId]
  );

  function refresh() {
    router.refresh();
  }

  function handleAddPhase(e: React.FormEvent) {
    e.preventDefault();
    if (!newPhaseName.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await addVisitPhase(projectId, newPhaseName);
        setNewPhaseName("");
        refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur.");
      }
    });
  }

  function handleSavePhase(phaseId: string) {
    if (!editPhaseName.trim()) return;
    startTransition(async () => {
      try {
        await updateVisitPhase(projectId, phaseId, editPhaseName);
        setEditingPhaseId(null);
        refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur.");
      }
    });
  }

  function handleDeletePhase(phaseId: string) {
    if (!confirm("Supprimer cette phase ?")) return;
    startTransition(async () => {
      try {
        await deleteVisitPhase(projectId, phaseId);
        refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur.");
      }
    });
  }

  function handleImportLibrary() {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        const result = await importControlLibraryToProject(projectId);
        setSuccess(
          `${result.imported} point(s) importé(s), ${result.updated} mis à jour depuis la bibliothèque.`
        );
        refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur d'import.");
      }
    });
  }

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-zinc-900">Panneau de contrôle</h2>
          <p className="mt-1 text-sm text-zinc-500">
            Points de contrôle importés depuis la{" "}
            <Link href="/pc/referentiels" className="font-medium text-violet-700 hover:underline">
              bibliothèque globale
            </Link>
            . Modifiez la base commune dans les Référentiels puis propagez.
          </p>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={handleImportLibrary}
            disabled={isPending}
            className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
          >
            Synchroniser la bibliothèque
          </button>
        )}
      </div>

      <div className="mb-6">
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-zinc-500">
          Phases
        </h3>
        <ul className="mb-3 space-y-2">
          {phases.map((phase) => (
            <li
              key={phase.id}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 ${
                selectedPhaseId === phase.id
                  ? "border-emerald-300 bg-emerald-50"
                  : "border-zinc-100 bg-zinc-50"
              }`}
            >
              {editingPhaseId === phase.id ? (
                <>
                  <input
                    value={editPhaseName}
                    onChange={(e) => setEditPhaseName(e.target.value)}
                    className="min-w-0 flex-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => handleSavePhase(phase.id)}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"
                  >
                    OK
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setSelectedPhaseId(phase.id)}
                    className="min-w-0 flex-1 text-left font-semibold text-zinc-900"
                  >
                    {phase.name}
                    <span className="ml-2 text-xs font-normal text-zinc-500">
                      (
                      {checklistItems.filter((i) => i.phase_id === phase.id).length}{" "}
                      points)
                    </span>
                  </button>
                  {canEdit && (
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingPhaseId(phase.id);
                          setEditPhaseName(phase.name);
                        }}
                        className="rounded-lg px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-200"
                      >
                        Modifier
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeletePhase(phase.id)}
                        className="rounded-lg px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-50"
                      >
                        Supprimer
                      </button>
                    </div>
                  )}
                </>
              )}
            </li>
          ))}
        </ul>
        {canEdit && (
          <form onSubmit={handleAddPhase} className="flex gap-2">
            <input
              value={newPhaseName}
              onChange={(e) => setNewPhaseName(e.target.value)}
              placeholder="Nouvelle phase"
              className="min-w-0 flex-1 rounded-xl border border-zinc-200 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={isPending}
              className="shrink-0 rounded-xl bg-zinc-900 px-4 py-2 text-sm font-semibold text-white"
            >
              Ajouter
            </button>
          </form>
        )}
      </div>

      {selectedPhase && (
        <div className="border-t border-zinc-100 pt-4">
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-zinc-500">
            Points de contrôle — {selectedPhase.name}
          </h3>
          {phaseControls.length === 0 ? (
            <p className="text-sm text-zinc-500">
              Aucun point pour cette phase. Synchronisez depuis la bibliothèque globale.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[32rem] text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 text-xs font-semibold uppercase text-zinc-500">
                    <th className="px-2 py-2">Point de contrôle</th>
                    <th className="px-2 py-2">Commentaire d&apos;aide</th>
                    <th className="px-2 py-2">Support plan</th>
                  </tr>
                </thead>
                <tbody>
                  {phaseControls.map((item) => (
                    <tr key={item.id} className="border-b border-zinc-100">
                      <td className="px-2 py-2 font-medium text-zinc-900">{item.label}</td>
                      <td className="px-2 py-2 text-zinc-600">
                        {item.help_comment || "—"}
                      </td>
                      <td className="px-2 py-2 text-xs text-zinc-500">
                        {planTypes.find((t) => t.id === item.plan_type_id)?.name ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {success && (
        <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {success}
        </p>
      )}
      {error && (
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
    </section>
  );
}
