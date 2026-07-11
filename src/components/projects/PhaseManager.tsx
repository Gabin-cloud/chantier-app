"use client";

import { useMemo, useState, useTransition } from "react";
import {
  addVisitPhase,
  deleteVisitPhase,
  updateVisitPhase,
} from "@/lib/actions/phases";
import {
  addPhaseChecklistItem,
  deletePhaseChecklistItem,
} from "@/lib/actions/checklist";
import { importControlLibraryToProject } from "@/lib/actions/control-library";
import { addPhaseZone, deletePhaseZone } from "@/lib/actions/zones";
import type { PhaseChecklistItem, PhaseZone, VisitPhase } from "@/lib/types/database";

type PhaseManagerProps = {
  projectId: string;
  phases: VisitPhase[];
  zones: PhaseZone[];
  checklistItems: PhaseChecklistItem[];
  canEdit: boolean;
};

export function PhaseManager({
  projectId,
  phases,
  zones,
  checklistItems,
  canEdit,
}: PhaseManagerProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [newPhaseName, setNewPhaseName] = useState("");
  const [editingPhaseId, setEditingPhaseId] = useState<string | null>(null);
  const [editPhaseName, setEditPhaseName] = useState("");

  const [selectedPhaseId, setSelectedPhaseId] = useState(phases[0]?.id ?? "");
  const [selectedZoneId, setSelectedZoneId] = useState("");
  const [newZoneName, setNewZoneName] = useState("");
  const [newControlLabel, setNewControlLabel] = useState("");

  const phaseZones = useMemo(
    () => zones.filter((z) => z.phase_id === selectedPhaseId),
    [zones, selectedPhaseId]
  );

  const zoneControls = useMemo(() => {
    if (!selectedZoneId) return [];
    return checklistItems.filter(
      (i) => i.phase_id === selectedPhaseId && i.zone_id === selectedZoneId
    );
  }, [checklistItems, selectedPhaseId, selectedZoneId]);

  const activeZoneId = selectedZoneId || phaseZones[0]?.id || "";

  function handleAddPhase(e: React.FormEvent) {
    e.preventDefault();
    if (!newPhaseName.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await addVisitPhase(projectId, newPhaseName);
        setNewPhaseName("");
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
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur.");
      }
    });
  }

  function handleAddZone(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPhaseId || !newZoneName.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        const zone = await addPhaseZone(projectId, selectedPhaseId, newZoneName);
        setNewZoneName("");
        setSelectedZoneId(zone.id);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur.");
      }
    });
  }

  function handleDeleteZone(zoneId: string) {
    if (!confirm("Supprimer cette zone et ses points de contrôle ?")) return;
    startTransition(async () => {
      try {
        await deletePhaseZone(projectId, zoneId);
        if (selectedZoneId === zoneId) setSelectedZoneId("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur.");
      }
    });
  }

  function handleAddControl(e: React.FormEvent) {
    e.preventDefault();
    const zoneId = activeZoneId;
    if (!selectedPhaseId || !zoneId || !newControlLabel.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        const zone = phaseZones.find((z) => z.id === zoneId);
        await addPhaseChecklistItem(
          projectId,
          selectedPhaseId,
          newControlLabel,
          zoneId,
          zone?.name
        );
        setNewControlLabel("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur.");
      }
    });
  }

  function handleDeleteControl(itemId: string) {
    startTransition(async () => {
      try {
        await deletePhaseChecklistItem(projectId, itemId);
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
        setSuccess(`${result.imported} point(s) importé(s) depuis la bibliothèque.`);
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
            Configurez les phases, les zones de chantier et les points de contrôle.
          </p>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={handleImportLibrary}
            disabled={isPending}
            className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
          >
            Importer bibliothèque
          </button>
        )}
      </div>

      {/* Phases */}
      <div className="mb-6">
        <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-zinc-500">
          1. Phases
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
                    onClick={() => {
                      setSelectedPhaseId(phase.id);
                      setSelectedZoneId("");
                    }}
                    className="min-w-0 flex-1 text-left font-semibold text-zinc-900"
                  >
                    {phase.name}
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

      {/* Zones */}
      {selectedPhaseId && (
        <div className="mb-6 border-t border-zinc-100 pt-4">
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-zinc-500">
            2. Zones de chantier
          </h3>
          {phaseZones.length === 0 ? (
            <p className="mb-3 text-sm text-zinc-500">
              Aucune zone pour cette phase. Ajoutez-en une (ex. Fond de fouille, Sous-sol…).
            </p>
          ) : (
            <ul className="mb-3 flex flex-wrap gap-2">
              {phaseZones.map((zone) => (
                <li key={zone.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedZoneId(zone.id)}
                    className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium ${
                      activeZoneId === zone.id
                        ? "bg-emerald-600 text-white"
                        : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                    }`}
                  >
                    {zone.name}
                    {canEdit && activeZoneId === zone.id && (
                      <span
                        role="button"
                        tabIndex={0}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteZone(zone.id);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleDeleteZone(zone.id);
                        }}
                        className="text-xs opacity-80"
                      >
                        ×
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
          {canEdit && (
            <form onSubmit={handleAddZone} className="flex gap-2">
              <input
                value={newZoneName}
                onChange={(e) => setNewZoneName(e.target.value)}
                placeholder="Nouvelle zone (ex. RESEAUX SOUS DALLAGE)"
                className="min-w-0 flex-1 rounded-xl border border-zinc-200 px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={isPending || !selectedPhaseId}
                className="shrink-0 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
              >
                Ajouter zone
              </button>
            </form>
          )}
        </div>
      )}

      {/* Control points */}
      {selectedPhaseId && activeZoneId && (
        <div className="border-t border-zinc-100 pt-4">
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-zinc-500">
            3. Points de contrôle
          </h3>
          {zoneControls.length === 0 ? (
            <p className="mb-3 text-sm text-zinc-500">Aucun point de contrôle dans cette zone.</p>
          ) : (
            <ul className="mb-3 space-y-1.5">
              {zoneControls.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center justify-between rounded-lg bg-zinc-50 px-3 py-2 text-sm"
                >
                  <span>{item.label}</span>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => handleDeleteControl(item.id)}
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
            <form onSubmit={handleAddControl} className="flex gap-2">
              <input
                value={newControlLabel}
                onChange={(e) => setNewControlLabel(e.target.value)}
                placeholder="Ex. Vérifier mise en place des huisseries"
                className="min-w-0 flex-1 rounded-xl border border-zinc-200 px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={isPending}
                className="shrink-0 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
              >
                Ajouter
              </button>
            </form>
          )}
        </div>
      )}

      {success && (
        <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{success}</p>
      )}
      {error && (
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
    </section>
  );
}
