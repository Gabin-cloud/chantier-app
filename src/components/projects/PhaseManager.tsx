"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AppFormField } from "@/components/ui/AppFormField";
import {
  addVisitPhase,
  deleteVisitPhase,
  updateVisitPhase,
} from "@/lib/actions/phases";
import {
  deleteWorkControlItem,
  upsertWorkControlItem,
} from "@/lib/actions/work-control";
import { importControlLibraryToProject } from "@/lib/actions/control-library";
import { addPhaseZone, deletePhaseZone } from "@/lib/actions/zones";
import type { PhaseChecklistItem, PhaseZone, VisitPhase } from "@/lib/types/database";
import type { WorkControlPlanType } from "@/lib/types/work-control";

type PhaseManagerProps = {
  projectId: string;
  phases: VisitPhase[];
  zones: PhaseZone[];
  checklistItems: PhaseChecklistItem[];
  planTypes?: WorkControlPlanType[];
  canEdit: boolean;
};

export function PhaseManager({
  projectId,
  phases,
  zones,
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
  const [selectedZoneId, setSelectedZoneId] = useState("");
  const [newZoneName, setNewZoneName] = useState("");

  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [formLabel, setFormLabel] = useState("");
  const [formPlanTypeId, setFormPlanTypeId] = useState("");
  const [formHelp, setFormHelp] = useState("");
  const [formPresets, setFormPresets] = useState("");

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

  function resetControlForm() {
    setEditingItemId(null);
    setFormLabel("");
    setFormPlanTypeId("");
    setFormHelp("");
    setFormPresets("");
  }

  function openEditControl(item: PhaseChecklistItem) {
    setEditingItemId(item.id);
    setFormLabel(item.label);
    setFormPlanTypeId(item.plan_type_id ?? "");
    setFormHelp(item.help_comment ?? "");
    setFormPresets(
      Array.isArray(item.preset_comments)
        ? (item.preset_comments as string[]).join("\n")
        : ""
    );
  }

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

  function handleAddZone(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedPhaseId || !newZoneName.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        const zone = await addPhaseZone(projectId, selectedPhaseId, newZoneName);
        setNewZoneName("");
        setSelectedZoneId(zone.id);
        refresh();
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
        refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur.");
      }
    });
  }

  function handleSaveControl(e: React.FormEvent) {
    e.preventDefault();
    const zoneId = activeZoneId;
    if (!selectedPhaseId || !zoneId || !formLabel.trim()) return;
    const zone = phaseZones.find((z) => z.id === zoneId);
    setError(null);
    startTransition(async () => {
      try {
        await upsertWorkControlItem(projectId, {
          phaseId: selectedPhaseId,
          itemId: editingItemId ?? undefined,
          label: formLabel,
          planTypeId: formPlanTypeId || null,
          helpComment: formHelp,
          presetComments: formPresets
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
          zoneId,
          zoneName: zone?.name ?? null,
        });
        resetControlForm();
        setSuccess("Point de contrôle enregistré.");
        refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur.");
      }
    });
  }

  function handleDeleteControl(itemId: string) {
    startTransition(async () => {
      try {
        await deleteWorkControlItem(projectId, itemId);
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
        setSuccess(`${result.imported} point(s) importé(s) depuis la bibliothèque.`);
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
            Configurez les phases, zones et points de contrôle (support plan, aide
            terrain, réponses types tablette).
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
                      resetControlForm();
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

      {selectedPhaseId && (
        <div className="mb-6 border-t border-zinc-100 pt-4">
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-zinc-500">
            2. Zones de chantier
          </h3>
          {phaseZones.length === 0 ? (
            <p className="mb-3 text-sm text-zinc-500">
              Aucune zone pour cette phase.
            </p>
          ) : (
            <ul className="mb-3 flex flex-wrap gap-2">
              {phaseZones.map((zone) => (
                <li key={zone.id}>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedZoneId(zone.id);
                      resetControlForm();
                    }}
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
                placeholder="Nouvelle zone"
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

      {selectedPhaseId && activeZoneId && (
        <div className="border-t border-zinc-100 pt-4">
          <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-zinc-500">
            3. Points de contrôle
          </h3>

          {zoneControls.length > 0 && (
            <ul className="mb-4 space-y-2">
              {zoneControls.map((item) => {
                const typeName =
                  planTypes.find((t) => t.id === item.plan_type_id)?.name ??
                  "—";
                return (
                  <li
                    key={item.id}
                    className="rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-zinc-900">
                          {item.label}
                        </p>
                        <p className="text-[11px] text-zinc-500">
                          Support : {typeName}
                          {item.help_comment ? ` · ${item.help_comment}` : ""}
                        </p>
                      </div>
                      {canEdit && (
                        <div className="flex shrink-0 gap-2 text-xs">
                          <button
                            type="button"
                            onClick={() => openEditControl(item)}
                            className="text-zinc-600 hover:underline"
                          >
                            Modifier
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteControl(item.id)}
                            className="text-red-600"
                          >
                            Suppr.
                          </button>
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {canEdit && (
            <form onSubmit={handleSaveControl} className="space-y-3 rounded-xl border border-zinc-200 bg-white p-3">
              <p className="text-xs font-semibold uppercase text-zinc-500">
                {editingItemId ? "Modifier le point" : "Nouveau point de contrôle"}
              </p>
              <AppFormField
                label="Nom du contrôle"
                name="control_label"
                value={formLabel}
                onChange={setFormLabel}
                required
              />
              <label className="block text-sm font-semibold text-slate-700">
                Support (type de plan)
                <select
                  value={formPlanTypeId}
                  onChange={(e) => setFormPlanTypeId(e.target.value)}
                  className="mt-1.5 block w-full rounded-xl border-2 border-zinc-200 bg-zinc-50 px-3 py-2 text-sm"
                >
                  <option value="">— Non défini —</option>
                  {planTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              <AppFormField
                label="Commentaire d'aide (tablette)"
                name="help_comment"
                value={formHelp}
                onChange={setFormHelp}
                rows={2}
              />
              <AppFormField
                label="Réponses types tablette (une par ligne)"
                name="preset_comments"
                value={formPresets}
                onChange={setFormPresets}
                rows={3}
              />
              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
                >
                  {editingItemId ? "Enregistrer" : "Ajouter"}
                </button>
                {editingItemId && (
                  <button
                    type="button"
                    onClick={resetControlForm}
                    className="rounded-xl border border-zinc-200 px-4 py-2 text-sm"
                  >
                    Annuler
                  </button>
                )}
              </div>
            </form>
          )}
        </div>
      )}

      {success && (
        <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {success}
        </p>
      )}
      {error && (
        <p className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
    </section>
  );
}
