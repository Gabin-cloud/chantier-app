"use client";

import { useState, useTransition } from "react";
import {
  addVisitPhase,
  deleteVisitPhase,
  updateVisitPhase,
} from "@/lib/actions/phases";
import {
  addPhaseChecklistItem,
  deletePhaseChecklistItem,
} from "@/lib/actions/checklist";
import type { PhaseChecklistItem, VisitPhase } from "@/lib/types/database";

type PhaseManagerProps = {
  projectId: string;
  phases: VisitPhase[];
  checklistItems: PhaseChecklistItem[];
  canEdit: boolean;
};

export function PhaseManager({
  projectId,
  phases,
  checklistItems,
  canEdit,
}: PhaseManagerProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [checklistPhaseId, setChecklistPhaseId] = useState(phases[0]?.id ?? "");
  const [newChecklistLabel, setNewChecklistLabel] = useState("");

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await addVisitPhase(projectId, newName);
        setNewName("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur.");
      }
    });
  }

  function handleSave(phaseId: string) {
    if (!editName.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await updateVisitPhase(projectId, phaseId, editName);
        setEditingId(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur.");
      }
    });
  }

  function handleDelete(phaseId: string) {
    if (!confirm("Supprimer cette phase ?")) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteVisitPhase(projectId, phaseId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur.");
      }
    });
  }

  function handleAddChecklistItem(e: React.FormEvent) {
    e.preventDefault();
    if (!checklistPhaseId || !newChecklistLabel.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await addPhaseChecklistItem(projectId, checklistPhaseId, newChecklistLabel);
        setNewChecklistLabel("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur.");
      }
    });
  }

  function handleDeleteChecklistItem(itemId: string) {
    setError(null);
    startTransition(async () => {
      try {
        await deletePhaseChecklistItem(projectId, itemId);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur.");
      }
    });
  }

  const phaseChecklistItems = checklistItems.filter((i) => i.phase_id === checklistPhaseId);

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="mb-1 text-lg font-semibold text-zinc-900">Phases de visite</h2>
      <p className="mb-4 text-sm text-zinc-500">
        Chaque visite appartient à une phase. Les réserves et dessins sont partagés
        entre toutes les visites d&apos;une même phase.
      </p>

      <ul className="mb-4 space-y-2">
        {phases.map((phase) => (
          <li
            key={phase.id}
            className="flex items-center gap-2 rounded-xl border border-zinc-100 bg-zinc-50 px-3 py-2.5"
          >
            {editingId === phase.id ? (
              <>
                <input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="min-w-0 flex-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-sm"
                />
                <button
                  type="button"
                  onClick={() => handleSave(phase.id)}
                  disabled={isPending}
                  className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  OK
                </button>
              </>
            ) : (
              <>
                <span className="min-w-0 flex-1 font-semibold text-zinc-900">{phase.name}</span>
                {canEdit && (
                  <div className="flex gap-1">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(phase.id);
                        setEditName(phase.name);
                      }}
                      className="rounded-lg px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-200"
                    >
                      Modifier
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(phase.id)}
                      disabled={isPending}
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
        <form onSubmit={handleAdd} className="mb-6 flex gap-2 border-t border-zinc-100 pt-4">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nouvelle phase (ex. Contrôle avant CHAP)"
            className="min-w-0 flex-1 rounded-xl border-2 border-zinc-200 bg-zinc-50 px-4 py-2.5 text-sm"
          />
          <button
            type="submit"
            disabled={isPending}
            className="shrink-0 rounded-xl bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-white"
          >
            Ajouter
          </button>
        </form>
      )}

      <div className="border-t border-zinc-100 pt-4">
        <h3 className="mb-2 font-semibold text-zinc-800">Points de contrôle par phase</h3>
        <p className="mb-3 text-sm text-zinc-500">
          Définissez ce qui doit être vérifié pendant une visite de cette phase.
        </p>

        <select
          value={checklistPhaseId}
          onChange={(e) => setChecklistPhaseId(e.target.value)}
          className="mb-3 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm"
        >
          {phases.map((phase) => (
            <option key={phase.id} value={phase.id}>
              {phase.name}
            </option>
          ))}
        </select>

        {phaseChecklistItems.length === 0 ? (
          <p className="mb-3 text-sm text-zinc-500">Aucun point de contrôle pour cette phase.</p>
        ) : (
          <ul className="mb-3 space-y-1.5">
            {phaseChecklistItems.map((item) => (
              <li
                key={item.id}
                className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 text-sm"
              >
                <span>{item.label}</span>
                {canEdit && (
                  <button
                    type="button"
                    onClick={() => handleDeleteChecklistItem(item.id)}
                    className="text-xs text-red-600"
                  >
                    Supprimer
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}

        {canEdit && (
          <form onSubmit={handleAddChecklistItem} className="flex gap-2">
            <input
              value={newChecklistLabel}
              onChange={(e) => setNewChecklistLabel(e.target.value)}
              placeholder="Ex. Vérifier mise en place des huisseries"
              className="min-w-0 flex-1 rounded-xl border border-zinc-200 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={isPending || !checklistPhaseId}
              className="shrink-0 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white"
            >
              Ajouter
            </button>
          </form>
        )}
      </div>

      {error && (
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
    </section>
  );
}
