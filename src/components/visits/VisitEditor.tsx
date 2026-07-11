"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { PlanViewer } from "@/components/visits/PlanViewer";
import { PlanPicker } from "@/components/plans/PlanPicker";
import { savePlanDrawings } from "@/lib/actions/drawings";
import { addCustomLocation } from "@/lib/actions/locations";
import {
  completeVisit,
  createMarker,
  deleteMarker,
  updateMarker,
  uploadMarkerPhoto,
} from "@/lib/actions/visits";
import type {
  DrawingStroke,
  Enterprise,
  MarkerStatus,
  MarkerWithLinks,
  Plan,
  PlanDrawing,
  PlanFolder,
  ProjectLocation,
  Visit,
} from "@/lib/types/database";
import {
  DRAW_COLOR_PRESETS,
  DRAW_WIDTH_PRESETS,
  MARKER_STATUS_COLORS,
  MARKER_STATUS_LABELS,
} from "@/lib/types/database";

type PlanWithUrl = Plan & { pdf_url: string };

type MarkerWithPhoto = MarkerWithLinks & {
  photo_public_url: string | null;
  status: MarkerStatus;
  enterprise_id: string | null;
  trade: string | null;
  location_label: string | null;
  location_preset_id: string | null;
};

type VisitEditorProps = {
  projectId: string;
  visit: Visit;
  phaseName?: string | null;
  plans: PlanWithUrl[];
  planFolders?: PlanFolder[];
  enterprises: Enterprise[];
  locations: ProjectLocation[];
  initialMarkers: MarkerWithPhoto[];
  initialDrawings: PlanDrawing[];
};

const STATUS_OPTIONS: MarkerStatus[] = [
  "a_traiter",
  "en_cours",
  "rejetee",
  "levee",
  "constat",
];

export function VisitEditor({
  projectId,
  visit,
  phaseName,
  plans,
  planFolders = [],
  enterprises,
  locations: initialLocations,
  initialMarkers,
  initialDrawings,
}: VisitEditorProps) {
  const router = useRouter();
  const [markers, setMarkers] = useState(initialMarkers);
  const [locations, setLocations] = useState(initialLocations);
  const [drawingsByPlan, setDrawingsByPlan] = useState<Record<string, DrawingStroke[]>>(() => {
    const map: Record<string, DrawingStroke[]> = {};
    for (const drawing of initialDrawings) {
      map[drawing.plan_id] = drawing.strokes ?? [];
    }
    return map;
  });

  const [selectedPlanId, setSelectedPlanId] = useState(plans[0]?.id ?? "");
  const [selectedMarkerId, setSelectedMarkerId] = useState<string | null>(null);
  const [addMode, setAddMode] = useState(false);
  const [drawMode, setDrawMode] = useState(false);
  const [showPlanPicker, setShowPlanPicker] = useState(false);
  const [drawColor, setDrawColor] = useState<string>(DRAW_COLOR_PRESETS[1]);
  const [drawWidth, setDrawWidth] = useState<number>(DRAW_WIDTH_PRESETS[1]);
  const [remarkDraft, setRemarkDraft] = useState("");
  const [linkDraft, setLinkDraft] = useState<string[]>([]);
  const [statusDraft, setStatusDraft] = useState<MarkerStatus>("a_traiter");
  const [enterpriseDraft, setEnterpriseDraft] = useState("");
  const [tradeDraft, setTradeDraft] = useState("");
  const [locationPresetDraft, setLocationPresetDraft] = useState("");
  const [locationLabelDraft, setLocationLabelDraft] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const saveDrawingsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const selectedPlan = plans.find((p) => p.id === selectedPlanId);
  const planMarkers = markers.filter((m) => m.plan_id === selectedPlanId);
  const selectedMarker = markers.find((m) => m.id === selectedMarkerId) ?? null;
  const isCompleted = visit.status === "completed";
  const currentStrokes = drawingsByPlan[selectedPlanId] ?? [];

  const otherMarkers = useMemo(
    () => markers.filter((m) => m.id !== selectedMarkerId),
    [markers, selectedMarkerId]
  );

  const selectedEnterprise = useMemo(
    () => enterprises.find((e) => e.id === enterpriseDraft) ?? null,
    [enterprises, enterpriseDraft]
  );

  const scheduleSaveDrawings = useCallback(
    (planId: string, strokes: DrawingStroke[]) => {
      if (isCompleted) return;
      if (saveDrawingsTimer.current) clearTimeout(saveDrawingsTimer.current);
      saveDrawingsTimer.current = setTimeout(() => {
        startTransition(async () => {
          try {
            await savePlanDrawings(visit.id, projectId, planId, strokes);
          } catch (err) {
            setError(
              err instanceof Error ? err.message : "Erreur lors de la sauvegarde du dessin."
            );
          }
        });
      }, 800);
    },
    [isCompleted, projectId, visit.id]
  );

  useEffect(() => {
    return () => {
      if (saveDrawingsTimer.current) clearTimeout(saveDrawingsTimer.current);
    };
  }, []);

  function selectMarker(marker: MarkerWithPhoto) {
    setSelectedMarkerId(marker.id);
    setRemarkDraft(marker.remark ?? "");
    setLinkDraft(marker.linked_marker_ids);
    setStatusDraft(marker.status ?? "a_traiter");
    setEnterpriseDraft(marker.enterprise_id ?? "");
    setTradeDraft(marker.trade ?? "");
    setLocationPresetDraft(marker.location_preset_id ?? "");
    setLocationLabelDraft(marker.location_label ?? "");
    setAddMode(false);
    setDrawMode(false);
  }

  function handlePlanClick(xPercent: number, yPercent: number) {
    if (!addMode || !selectedPlan || isCompleted) return;

    startTransition(async () => {
      try {
        setError(null);
        const newMarker = await createMarker(
          visit.id,
          projectId,
          selectedPlanId,
          xPercent,
          yPercent
        );
        const withPhoto: MarkerWithPhoto = {
          ...newMarker,
          status: "a_traiter",
          enterprise_id: null,
          trade: null,
          location_label: null,
          location_preset_id: null,
          photo_public_url: null,
        };
        setMarkers((prev) => [...prev, withPhoto]);
        selectMarker(withPhoto);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Impossible d'ajouter la pastille.");
      }
    });
  }

  function handleStrokesChange(strokes: DrawingStroke[]) {
    setDrawingsByPlan((prev) => ({ ...prev, [selectedPlanId]: strokes }));
    scheduleSaveDrawings(selectedPlanId, strokes);
  }

  function handleUndoDrawing() {
    const strokes = currentStrokes.slice(0, -1);
    setDrawingsByPlan((prev) => ({ ...prev, [selectedPlanId]: strokes }));
    scheduleSaveDrawings(selectedPlanId, strokes);
  }

  async function handleSaveMarker() {
    if (!selectedMarker) return;

    startTransition(async () => {
      try {
        setError(null);
        let locationPresetId = locationPresetDraft || null;

        if (locationLabelDraft.trim() && !locationPresetId) {
          const created = await addCustomLocation(projectId, locationLabelDraft.trim());
          setLocations((prev) => {
            if (prev.some((l) => l.id === created.id)) return prev;
            return [...prev, created].sort((a, b) => a.name.localeCompare(b.name, "fr"));
          });
          locationPresetId = created.id;
          setLocationPresetDraft(created.id);
        }

        await updateMarker(visit.id, projectId, selectedMarker.id, {
          remark: remarkDraft,
          linked_marker_ids: linkDraft,
          status: statusDraft,
          enterprise_id: enterpriseDraft || null,
          trade: (selectedEnterprise?.trade ?? tradeDraft) || null,
          location_label: locationLabelDraft || null,
          location_preset_id: locationPresetId,
        });

        setMarkers((prev) =>
          prev.map((m) =>
            m.id === selectedMarker.id
              ? {
                  ...m,
                  remark: remarkDraft,
                  linked_marker_ids: linkDraft,
                  status: statusDraft,
                  enterprise_id: enterpriseDraft || null,
                  trade: (selectedEnterprise?.trade ?? tradeDraft) || null,
                  location_label: locationLabelDraft || null,
                  location_preset_id: locationPresetId,
                }
              : m
          )
        );
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement.");
      }
    });
  }

  function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!selectedMarker || !e.target.files?.[0]) return;

    const formData = new FormData();
    formData.append("photo", e.target.files[0]);

    startTransition(async () => {
      try {
        setError(null);
        const url = await uploadMarkerPhoto(
          visit.id,
          projectId,
          selectedMarker.id,
          formData
        );
        setMarkers((prev) =>
          prev.map((m) =>
            m.id === selectedMarker.id ? { ...m, photo_public_url: url } : m
          )
        );
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur lors de l'upload.");
      }
    });
  }

  function handleDeleteMarker() {
    if (!selectedMarker || !confirm("Supprimer cette pastille ?")) return;

    startTransition(async () => {
      try {
        setError(null);
        await deleteMarker(visit.id, projectId, selectedMarker.id);
        setMarkers((prev) => prev.filter((m) => m.id !== selectedMarker.id));
        setSelectedMarkerId(null);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur lors de la suppression.");
      }
    });
  }

  function handleCompleteVisit() {
    startTransition(async () => {
      try {
        setError(null);
        await completeVisit(projectId, visit.id);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur.");
      }
    });
  }

  function toggleLink(markerId: string) {
    setLinkDraft((prev) =>
      prev.includes(markerId) ? prev.filter((id) => id !== markerId) : [...prev, markerId]
    );
  }

  function locationName(marker: MarkerWithPhoto) {
    if (marker.location_label) return marker.location_label;
    if (marker.location_preset_id) {
      return locations.find((l) => l.id === marker.location_preset_id)?.name ?? null;
    }
    return null;
  }

  if (plans.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
        <p className="text-lg font-semibold text-zinc-900">Aucun plan disponible</p>
        <p className="mt-2 text-zinc-500">
          Importez des plans PDF dans les paramètres du projet avant de commencer
          une visite.
        </p>
        <Link
          href={`/tablette/projets/${projectId}/parametres`}
          className="mt-6 inline-block rounded-xl bg-zinc-900 px-6 py-3 font-semibold text-white"
        >
          Aller aux paramètres
        </Link>
      </div>
    );
  }

  return (
    <div className="tablette-visit-editor flex min-h-0 flex-col md:flex-row">
      <aside className="flex w-full shrink-0 flex-col border-r border-zinc-200 bg-white md:w-72 lg:w-80">
        <div className="border-b border-zinc-100 px-4 py-3">
          <h2 className="text-base font-bold text-zinc-900">Réserves</h2>
          <p className="text-xs text-zinc-500">
            {planMarkers.length} sur ce plan
            {phaseName ? ` · Phase : ${phaseName}` : ""}
          </p>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {planMarkers.length === 0 ? (
            <p className="px-2 py-4 text-sm text-zinc-500">
              Activez le mode pastille et touchez le plan.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {planMarkers.map((marker) => {
                const loc = locationName(marker);
                return (
                  <li key={marker.id}>
                    <button
                      type="button"
                      onClick={() => selectMarker(marker)}
                      className={`w-full rounded-xl px-3 py-2.5 text-left transition-colors ${
                        selectedMarkerId === marker.id
                          ? "bg-amber-50 ring-2 ring-amber-400"
                          : "bg-zinc-50 hover:bg-zinc-100"
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white ${
                            MARKER_STATUS_COLORS[marker.status ?? "a_traiter"]
                          }`}
                        >
                          {marker.marker_number}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-zinc-900">
                            {marker.remark || "Sans remarque"}
                          </p>
                          <p className="text-xs text-zinc-500">
                            {MARKER_STATUS_LABELS[marker.status ?? "a_traiter"]}
                            {loc ? ` · ${loc}` : ""}
                          </p>
                        </div>
                        {marker.photo_public_url && (
                          <span className="text-xs text-emerald-600">📷</span>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {selectedMarker && (
          <div className="max-h-[50vh] shrink-0 overflow-y-auto border-t border-zinc-100 px-4 py-3">
            <h3 className="mb-2 text-sm font-semibold text-zinc-900">
              Réserve n°{selectedMarker.marker_number}
            </h3>

            <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Statut
            </label>
            <select
              value={statusDraft}
              onChange={(e) => setStatusDraft(e.target.value as MarkerStatus)}
              disabled={isCompleted}
              className="mb-3 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm disabled:opacity-60"
            >
              {STATUS_OPTIONS.map((status) => (
                <option key={status} value={status}>
                  {MARKER_STATUS_LABELS[status]}
                </option>
              ))}
            </select>

            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Entreprise
            </label>
            <select
              value={enterpriseDraft}
              onChange={(e) => {
                const id = e.target.value;
                setEnterpriseDraft(id);
                const ent = enterprises.find((x) => x.id === id);
                setTradeDraft(ent?.trade ?? "");
              }}
              disabled={isCompleted}
              className="mb-2 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm disabled:opacity-60"
            >
              <option value="">— Non assignée —</option>
              {enterprises.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                  {e.trade ? ` (${e.trade})` : ""}
                </option>
              ))}
            </select>
            {selectedEnterprise?.trade && (
              <p className="mb-3 text-xs text-zinc-500">
                Corps de métier : {selectedEnterprise.trade}
              </p>
            )}

            <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
              Localisation
            </label>
            <select
              value={locationPresetDraft}
              onChange={(e) => setLocationPresetDraft(e.target.value)}
              disabled={isCompleted}
              className="mb-2 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm disabled:opacity-60"
            >
              <option value="">— Choisir —</option>
              {locations.map((loc) => (
                <option key={loc.id} value={loc.id}>
                  {loc.name}
                  {!loc.is_preset ? " (terrain)" : ""}
                </option>
              ))}
            </select>
            <input
              value={locationLabelDraft}
              onChange={(e) => setLocationLabelDraft(e.target.value)}
              placeholder="Précision (ex. angle fenêtre sud)"
              disabled={isCompleted}
              className="mb-3 w-full rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm disabled:opacity-60"
            />

            <textarea
              value={remarkDraft}
              onChange={(e) => setRemarkDraft(e.target.value)}
              placeholder="Remarque…"
              rows={3}
              disabled={isCompleted}
              className="mb-2 w-full resize-none rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm focus:border-zinc-400 focus:outline-none disabled:opacity-60"
            />

            {otherMarkers.length > 0 && !isCompleted && (
              <div className="mb-2">
                <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  Lier à d&apos;autres pastilles
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {otherMarkers.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleLink(m.id)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                        linkDraft.includes(m.id)
                          ? "bg-zinc-900 text-white"
                          : "bg-zinc-100 text-zinc-700"
                      }`}
                    >
                      #{m.marker_number}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {selectedMarker.photo_public_url && (
              <img
                src={selectedMarker.photo_public_url}
                alt="Photo réserve"
                className="mb-2 max-h-28 w-full rounded-xl object-cover"
              />
            )}

            {!isCompleted && (
              <div className="space-y-2">
                <label className="block">
                  <span className="mb-1 block text-xs font-medium text-zinc-700">Photo</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handlePhotoUpload}
                    disabled={isPending}
                    className="w-full text-xs text-zinc-600"
                  />
                </label>
                <button
                  type="button"
                  onClick={handleSaveMarker}
                  disabled={isPending}
                  className="min-h-10 w-full rounded-xl bg-zinc-900 py-2 text-sm font-bold text-white disabled:opacity-50"
                >
                  Enregistrer
                </button>
                <button
                  type="button"
                  onClick={handleDeleteMarker}
                  disabled={isPending}
                  className="min-h-10 w-full rounded-xl border border-red-200 py-2 text-sm font-medium text-red-600"
                >
                  Supprimer
                </button>
              </div>
            )}
          </div>
        )}

        {error && (
          <p className="shrink-0 px-4 py-2 text-xs font-medium text-red-700">{error}</p>
        )}
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-zinc-100">
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-zinc-200 bg-white px-3 py-2">
          <button
            type="button"
            onClick={() => setShowPlanPicker((v) => !v)}
            className={`shrink-0 rounded-lg px-3 py-2 text-sm font-bold ${
              showPlanPicker ? "bg-emerald-600 text-white" : "bg-zinc-100 text-zinc-800"
            }`}
          >
            📁 Plans
          </button>

          <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-0.5">
            {plans.map((plan) => (
              <button
                key={plan.id}
                type="button"
                onClick={() => {
                  setSelectedPlanId(plan.id);
                  setSelectedMarkerId(null);
                }}
                className={`shrink-0 rounded-lg px-3 py-2 text-sm font-semibold transition-colors ${
                  plan.id === selectedPlanId
                    ? "bg-emerald-600 text-white"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                }`}
              >
                {plan.name}
              </button>
            ))}
          </div>

          <div className="flex shrink-0 flex-wrap gap-2">
            {!isCompleted && (
              <button
                type="button"
                onClick={() => {
                  setAddMode((v) => !v);
                  setDrawMode(false);
                }}
                className={`min-h-10 rounded-lg px-4 py-2 text-sm font-bold ${
                  addMode ? "bg-amber-500 text-white" : "bg-zinc-100 text-zinc-800"
                }`}
              >
                {addMode ? "Pastille active" : "+ Pastille"}
              </button>
            )}
            {!isCompleted && (
              <button
                type="button"
                onClick={() => {
                  setDrawMode((v) => !v);
                  setAddMode(false);
                }}
                className={`min-h-10 rounded-lg px-4 py-2 text-sm font-bold ${
                  drawMode ? "bg-orange-500 text-white" : "bg-zinc-100 text-zinc-800"
                }`}
              >
                {drawMode ? "Dessin actif" : "✏️ Dessin"}
              </button>
            )}
            {!isCompleted && drawMode && (
              <button
                type="button"
                onClick={handleUndoDrawing}
                className="min-h-10 rounded-lg bg-zinc-100 px-4 py-2 text-sm font-bold text-zinc-800"
              >
                Annuler trait
              </button>
            )}
            {!isCompleted && drawMode && (
              <div className="flex items-center gap-1.5 rounded-lg bg-zinc-50 px-2 py-1">
                {DRAW_COLOR_PRESETS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setDrawColor(color)}
                    style={{ backgroundColor: color }}
                    className={`h-7 w-7 rounded-full border-2 ${
                      drawColor === color ? "border-zinc-900" : "border-white"
                    }`}
                    aria-label={`Couleur ${color}`}
                  />
                ))}
                <select
                  value={drawWidth}
                  onChange={(e) => setDrawWidth(Number(e.target.value))}
                  className="rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs font-semibold"
                >
                  {DRAW_WIDTH_PRESETS.map((w) => (
                    <option key={w} value={w}>
                      {w}px
                    </option>
                  ))}
                </select>
              </div>
            )}
            {!isCompleted && (
              <button
                type="button"
                onClick={handleCompleteVisit}
                disabled={isPending}
                className="min-h-10 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-500 disabled:opacity-50"
              >
                Terminer
              </button>
            )}
            {isCompleted && (
              <span className="inline-flex min-h-10 items-center rounded-lg bg-emerald-100 px-4 text-sm font-semibold text-emerald-800">
                Visite terminée
              </span>
            )}
          </div>
        </div>

        <div className="relative flex min-h-0 flex-1">
          {showPlanPicker && (
            <aside className="absolute left-0 top-0 z-30 flex h-full w-64 flex-col border-r border-zinc-200 bg-white shadow-lg">
              <div className="flex items-center justify-between border-b border-zinc-100 px-3 py-2">
                <p className="text-sm font-bold text-zinc-900">Bibliothèque de plans</p>
                <button
                  type="button"
                  onClick={() => setShowPlanPicker(false)}
                  className="rounded-lg px-2 py-1 text-xs text-zinc-500 hover:bg-zinc-100"
                >
                  Fermer
                </button>
              </div>
              <PlanPicker
                folders={planFolders}
                plans={plans}
                selectedPlanId={selectedPlanId}
                onSelect={(id) => {
                  setSelectedPlanId(id);
                  setSelectedMarkerId(null);
                }}
              />
            </aside>
          )}

        <div
          className={`relative min-h-0 flex-1 ${
            addMode ? "ring-2 ring-inset ring-amber-400" : drawMode ? "ring-2 ring-inset ring-orange-400" : ""
          }`}
        >
          {selectedPlan && (
            <PlanViewer
              key={selectedPlan.id}
              projectId={projectId}
              planId={selectedPlan.id}
              addMode={addMode && !isCompleted}
              drawMode={drawMode && !isCompleted}
              drawColor={drawColor}
              drawWidth={drawWidth}
              readOnly={isCompleted}
              markers={planMarkers.map((m) => ({
                id: m.id,
                x_percent: m.x_percent,
                y_percent: m.y_percent,
                marker_number: m.marker_number,
                status: m.status ?? "a_traiter",
              }))}
              strokes={currentStrokes}
              onStrokesChange={handleStrokesChange}
              selectedMarkerId={selectedMarkerId}
              onPlanClick={handlePlanClick}
              onMarkerClick={(id) => {
                const marker = markers.find((m) => m.id === id);
                if (marker) selectMarker(marker);
              }}
            />
          )}
        </div>
        </div>
      </div>
    </div>
  );
}
