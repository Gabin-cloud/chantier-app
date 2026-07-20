"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { VisitReportPreview } from "@/components/visits/VisitReportPreview";
import { MarkerPhotoAnnotator } from "@/components/visits/MarkerPhotoAnnotator";
import { PlanViewer } from "@/components/visits/PlanViewer";
import { PlanPicker } from "@/components/plans/PlanPicker";
import { savePlanDrawings } from "@/lib/actions/checklist";
import { addCustomLocation } from "@/lib/actions/locations";
import {
  completeVisit,
  createMarker,
  deleteMarker,
  updateMarker,
  uploadMarkerPhoto,
  uploadMarkerPhotoAndResolve,
} from "@/lib/actions/visits";
import type {
  ControlResult,
  DrawingStroke,
  Enterprise,
  MarkerStatus,
  MarkerWithLinks,
  PhaseChecklistItem,
  Plan,
  PlanDrawing,
  PlanFolder,
  ProjectLocation,
  TabletMarkerVisualState,
  Visit,
  VisitControlSummary,
} from "@/lib/types/database";
import {
  CONTROL_RESULT_COLORS,
  CONTROL_RESULT_LABELS,
  DRAW_COLOR_PRESETS,
  DRAW_WIDTH_PRESETS,
  markerControlHex,
  TABLET_MARKER_STATE_LABELS,
  VISIT_CONTROL_SUMMARY_LABELS,
} from "@/lib/types/database";
import { computeVisitControlSummary } from "@/lib/control-summary";
import {
  DEFAULT_MARKER_FILTERS,
  isPriorVisitMarker,
  matchesMarkerFilters,
  TABLET_FILTER_STATES,
  toggleFilterValue,
  type MarkerListFilters,
  type WorkControlExecutionLite,
} from "@/lib/marker-filters";
import type { WorkControlExecutionMapEntry } from "@/lib/actions/work-control";
import type { WorkControlPlanLevel } from "@/lib/types/work-control";

type PlanWithUrl = Plan & { pdf_url: string };

type MarkerWithPhoto = MarkerWithLinks & {
  photo_public_url: string | null;
  status: MarkerStatus;
  enterprise_id: string | null;
  trade: string | null;
  location_label: string | null;
  location_preset_id: string | null;
  checklist_item_id: string | null;
  plan_level_id: string | null;
  control_result: ControlResult | null;
};

type VisitEditorProps = {
  projectId: string;
  visit: Visit;
  phaseName?: string | null;
  zoneName?: string | null;
  controlLabel?: string | null;
  reportUrl?: string | null;
  plans: PlanWithUrl[];
  planFolders?: PlanFolder[];
  checklistItems?: PhaseChecklistItem[];
  planLevelsByPlan?: Record<string, WorkControlPlanLevel[]>;
  enterprises: Enterprise[];
  locations: ProjectLocation[];
  initialMarkers: MarkerWithPhoto[];
  initialDrawings: PlanDrawing[];
  inheritedControlResults?: Record<string, ControlResult>;
  workControlExecutions?: WorkControlExecutionMapEntry[];
};

const CONTROL_STATUS_OPTIONS: ControlResult[] = ["ko", "ok", "pending"];
const SWIPE_RESOLVE_THRESHOLD = 80;

function SwipeableMarkerRow({
  children,
  onResolve,
  disabled,
}: {
  children: React.ReactNode;
  onResolve: () => void;
  disabled?: boolean;
}) {
  const startXRef = useRef<number | null>(null);
  const [offsetX, setOffsetX] = useState(0);
  const swipedRef = useRef(false);

  function onPointerDown(e: React.PointerEvent<HTMLLIElement>) {
    if (disabled) return;
    startXRef.current = e.clientX;
    swipedRef.current = false;
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent<HTMLLIElement>) {
    if (disabled || startXRef.current == null) return;
    const dx = e.clientX - startXRef.current;
    setOffsetX(dx);
    if (Math.abs(dx) > 12) swipedRef.current = true;
  }

  function onPointerUp(e: React.PointerEvent<HTMLLIElement>) {
    if (disabled || startXRef.current == null) {
      setOffsetX(0);
      startXRef.current = null;
      return;
    }
    const dx = e.clientX - startXRef.current;
    startXRef.current = null;
    setOffsetX(0);
    if (Math.abs(dx) > SWIPE_RESOLVE_THRESHOLD) {
      onResolve();
    }
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  }

  return (
    <li
      className="relative overflow-hidden rounded-xl"
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={() => {
        startXRef.current = null;
        setOffsetX(0);
      }}
    >
      {!disabled && Math.abs(offsetX) > 20 && (
        <div
          className={`absolute inset-y-0 flex w-20 items-center justify-center text-xs font-bold text-white ${
            offsetX > 0 ? "left-0 bg-blue-600" : "right-0 bg-blue-600"
          }`}
        >
          Lever
        </div>
      )}
      <div
        style={{
          transform: `translateX(${offsetX}px)`,
          transition: startXRef.current == null ? "transform 0.15s ease" : undefined,
        }}
        onClickCapture={(e) => {
          if (swipedRef.current) {
            e.preventDefault();
            e.stopPropagation();
            swipedRef.current = false;
          }
        }}
      >
        {children}
      </div>
    </li>
  );
}

export function VisitEditor({
  projectId,
  visit,
  phaseName,
  zoneName,
  controlLabel,
  reportUrl,
  plans,
  planFolders = [],
  checklistItems = [],
  planLevelsByPlan = {},
  enterprises,
  locations: initialLocations,
  initialMarkers,
  initialDrawings,
  inheritedControlResults = {},
  workControlExecutions = [],
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
  /** Outil actif : pastille (défaut) ou dessin — toujours l'un des deux. */
  const [placeTool, setPlaceTool] = useState<"pastille" | "dessin">("pastille");
  const [showPlanPicker, setShowPlanPicker] = useState(false);
  const [drawColor, setDrawColor] = useState<string>(DRAW_COLOR_PRESETS[1]);
  const [drawWidth, setDrawWidth] = useState<number>(DRAW_WIDTH_PRESETS[1]);
  const [remarkDraft, setRemarkDraft] = useState("");
  const [statusDraft, setStatusDraft] = useState<MarkerStatus>("a_traiter");
  const [enterpriseDraft, setEnterpriseDraft] = useState("");
  const [tradeDraft, setTradeDraft] = useState("");
  const [locationPresetDraft, setLocationPresetDraft] = useState("");
  const [locationLabelDraft, setLocationLabelDraft] = useState("");
  const [checklistItemDraft, setChecklistItemDraft] = useState("");
  const [planLevelDraft, setPlanLevelDraft] = useState("");
  const [presetCommentDraft, setPresetCommentDraft] = useState("");
  const [controlResultDraft, setControlResultDraft] = useState<ControlResult | "">("");
  const [showReport, setShowReport] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [markerFilters, setMarkerFilters] = useState<MarkerListFilters>(
    DEFAULT_MARKER_FILTERS
  );
  /** null = toutes les entreprises ; [] = aucune ; [ids] = filtre actif */
  const [enterpriseFilterIds, setEnterpriseFilterIds] = useState<string[] | null>(null);
  const [pendingPhoto, setPendingPhoto] = useState<{
    file: File;
    mode: "upload" | "resolve";
  } | null>(null);
  const [unlockedMarkerIds, setUnlockedMarkerIds] = useState<Set<string>>(
    () => new Set()
  );
  const saveDrawingsTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const executionMap = useMemo(() => {
    const map = new Map<string, WorkControlExecutionLite>();
    for (const ex of workControlExecutions) {
      map.set(`${ex.checklist_item_id}:${ex.plan_level_id}`, ex);
    }
    return map;
  }, [workControlExecutions]);

  const visibleMarkers = useMemo(
    () => markers.filter((m) => matchesMarkerFilters(m, markerFilters, executionMap)),
    [markers, markerFilters, executionMap]
  );

  const markersByPlan = useMemo(() => {
    const byPlanId = new Map<string, MarkerWithPhoto[]>();
    for (const m of visibleMarkers) {
      const list = byPlanId.get(m.plan_id) ?? [];
      list.push(m);
      byPlanId.set(m.plan_id, list);
    }
    return plans
      .map((plan) => ({ plan, markers: byPlanId.get(plan.id) ?? [] }))
      .filter((g) => g.markers.length > 0);
  }, [visibleMarkers, plans]);

  const selectedPlan = plans.find((p) => p.id === selectedPlanId);
  const planMarkers = visibleMarkers.filter((m) => m.plan_id === selectedPlanId);
  const selectedMarker =
    markers.find((m) => m.id === selectedMarkerId) ?? null;
  const selectedMarkerIsPrior =
    selectedMarker != null && isPriorVisitMarker(selectedMarker.visit_id, visit.id);
  const selectedMarkerLocked =
    selectedMarkerIsPrior &&
    selectedMarker != null &&
    !unlockedMarkerIds.has(selectedMarker.id);
  const isCompleted = visit.status === "completed";
  const addMode = !isCompleted && placeTool === "pastille";
  const drawMode = !isCompleted && placeTool === "dessin";
  const currentStrokes = drawingsByPlan[selectedPlanId] ?? [];

  const selectedEnterprise = useMemo(
    () => enterprises.find((e) => e.id === enterpriseDraft) ?? null,
    [enterprises, enterpriseDraft]
  );

  const visitMarkersForSummary = useMemo(
    () => markers.filter((m) => m.visit_id === visit.id),
    [markers, visit.id]
  );

  const visitControlSummary: VisitControlSummary = useMemo(
    () =>
      visit.control_summary ??
      computeVisitControlSummary(visitMarkersForSummary),
    [visit.control_summary, visitMarkersForSummary]
  );

  const filteredChecklistItems = useMemo(() => {
    if (!selectedPlan?.plan_type_id) return checklistItems;
    return checklistItems.filter(
      (item) =>
        !item.plan_type_id || item.plan_type_id === selectedPlan.plan_type_id
    );
  }, [checklistItems, selectedPlan?.plan_type_id]);

  const selectedChecklistItem = useMemo(
    () => filteredChecklistItems.find((i) => i.id === checklistItemDraft) ?? null,
    [filteredChecklistItems, checklistItemDraft]
  );

  const planLevels = useMemo(
    () => planLevelsByPlan[selectedPlanId] ?? [],
    [planLevelsByPlan, selectedPlanId]
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

  useEffect(() => {
    setMarkerFilters((prev) => ({
      ...prev,
      enterpriseIds:
        enterpriseFilterIds === null
          ? []
          : enterpriseFilterIds.length === 0
            ? ["__none__"]
            : enterpriseFilterIds,
    }));
  }, [enterpriseFilterIds]);

  useEffect(() => {
    const levels = planLevelsByPlan[selectedPlanId] ?? [];
    if (levels.length && !planLevelDraft) {
      setPlanLevelDraft(levels[0]!.id);
    }
  }, [selectedPlanId, planLevelsByPlan, planLevelDraft]);

  function isMarkerDraftIncomplete() {
    return !enterpriseDraft && !remarkDraft.trim();
  }

  function applySelectMarker(marker: MarkerWithPhoto) {
    setSelectedMarkerId(marker.id);
    setRemarkDraft(marker.remark ?? "");
    setStatusDraft(marker.status ?? "a_traiter");
    setEnterpriseDraft(marker.enterprise_id ?? "");
    setTradeDraft(marker.trade ?? "");
    setLocationPresetDraft(marker.location_preset_id ?? "");
    setLocationLabelDraft(marker.location_label ?? "");
    setChecklistItemDraft(marker.checklist_item_id ?? "");
    setPlanLevelDraft(
      marker.plan_level_id ??
        planLevelsByPlan[marker.plan_id]?.[0]?.id ??
        ""
    );
    setPresetCommentDraft("");
    setControlResultDraft(marker.control_result ?? "");
  }

  async function handleMarkerSwitchAway(): Promise<void> {
    if (!selectedMarkerId) return;
    const current = markers.find((m) => m.id === selectedMarkerId);
    if (!current || current.visit_id !== visit.id) return;

    if (isMarkerDraftIncomplete()) {
      try {
        setError(null);
        await deleteMarker(visit.id, projectId, selectedMarkerId);
        setMarkers((prev) => prev.filter((m) => m.id !== selectedMarkerId));
        setSelectedMarkerId(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur lors de la suppression.");
      }
      return;
    }

    await saveMarkerDraft(selectedMarkerId);
  }

  async function saveMarkerDraft(markerId: string): Promise<boolean> {
    if (markerId !== selectedMarkerId) return false;

    if (
      (controlResultDraft === "ok" || controlResultDraft === "ko") &&
      !enterpriseDraft
    ) {
      setError("Sélectionnez l'entreprise pour Conforme ou À lever.");
      return false;
    }

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

      const isPrior =
        selectedMarker != null && isPriorVisitMarker(selectedMarker.visit_id, visit.id);

      await updateMarker(visit.id, projectId, markerId, {
        remark: remarkDraft,
        linked_marker_ids: [],
        status: statusDraft,
        enterprise_id: enterpriseDraft || null,
        trade: (selectedEnterprise?.trade ?? tradeDraft) || null,
        location_label: locationLabelDraft || null,
        location_preset_id: locationPresetId,
        checklist_item_id: checklistItemDraft || null,
        plan_level_id: planLevelDraft || null,
        control_result: controlResultDraft || null,
        preset_comment: presetCommentDraft || null,
        unlock_edit: isPrior && !selectedMarkerLocked,
      });

      setMarkers((prev) =>
        prev.map((m) =>
          m.id === markerId
            ? {
                ...m,
                remark: remarkDraft,
                linked_marker_ids: [],
                status: statusDraft,
                enterprise_id: enterpriseDraft || null,
                trade: (selectedEnterprise?.trade ?? tradeDraft) || null,
                location_label: locationLabelDraft || null,
                location_preset_id: locationPresetId,
                checklist_item_id: checklistItemDraft || null,
                plan_level_id: planLevelDraft || null,
                control_result: controlResultDraft || null,
              }
            : m
        )
      );
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement.");
      return false;
    }
  }

  function selectMarker(marker: MarkerWithPhoto) {
    if (selectedMarkerId === marker.id) return;

    void (async () => {
      await handleMarkerSwitchAway();
      applySelectMarker(marker);
    })();
  }

  function isEnterpriseFilterChecked(id: string) {
    if (enterpriseFilterIds === null) return true;
    return enterpriseFilterIds.includes(id);
  }

  function toggleEnterpriseFilter(id: string) {
    setEnterpriseFilterIds((prev) => {
      if (prev === null) {
        return enterprises.map((e) => e.id).filter((x) => x !== id);
      }
      if (prev.includes(id)) {
        const next = prev.filter((x) => x !== id);
        return next.length === 0 ? [] : next;
      }
      const next = [...prev, id];
      return next.length === enterprises.length ? null : next;
    });
  }

  function checklistLabel(marker: MarkerWithPhoto) {
    return checklistItems.find((i) => i.id === marker.checklist_item_id)?.label ?? null;
  }

  function enterpriseName(marker: MarkerWithPhoto) {
    if (!marker.enterprise_id) return "Sans entreprise";
    return enterprises.find((e) => e.id === marker.enterprise_id)?.name ?? "Sans entreprise";
  }

  function markerRowSubtitle(marker: MarkerWithPhoto) {
    if (marker.remark?.trim()) return marker.remark.trim();
    return checklistLabel(marker) ?? "Sans remarque";
  }

  function handleChecklistItemChange(itemId: string) {
    setChecklistItemDraft(itemId);
    if (itemId && !controlResultDraft && inheritedControlResults[itemId]) {
      setControlResultDraft(inheritedControlResults[itemId]);
    }
  }

  function handlePlanClick(xPercent: number, yPercent: number) {
    if (!addMode || !selectedPlan || isCompleted) return;

    void (async () => {
      if (selectedMarkerId) {
        const current = markers.find((m) => m.id === selectedMarkerId);
        if (current && current.visit_id === visit.id) {
          if (isMarkerDraftIncomplete()) {
            try {
              setError(null);
              await deleteMarker(visit.id, projectId, selectedMarkerId);
              setMarkers((prev) => prev.filter((m) => m.id !== selectedMarkerId));
              setSelectedMarkerId(null);
            } catch (err) {
              setError(
                err instanceof Error ? err.message : "Impossible d'ajouter la pastille."
              );
              return;
            }
          } else {
            const saved = await saveMarkerDraft(selectedMarkerId);
            if (!saved) return;
          }
        }
      }

      const previous = [...markers]
        .filter((m) => m.visit_id === visit.id)
        .sort((a, b) => b.marker_number - a.marker_number)[0];
      const inheritedEnterpriseId = previous?.enterprise_id ?? null;
      const inheritedTrade = previous?.trade ?? null;

      startTransition(async () => {
        try {
          setError(null);
          const newMarker = await createMarker(
            visit.id,
            projectId,
            selectedPlanId,
            xPercent,
            yPercent,
            {
              control_result: "ko",
              enterprise_id: inheritedEnterpriseId,
              trade: inheritedTrade,
            }
          );
          const withPhoto: MarkerWithPhoto = {
            ...newMarker,
            status: "a_traiter",
            enterprise_id: inheritedEnterpriseId,
            trade: inheritedTrade,
            location_label: null,
            location_preset_id: null,
            checklist_item_id:
              visit.checklist_item_id ?? newMarker.checklist_item_id ?? null,
            control_result: "ko",
            photo_public_url: null,
          };
          setMarkers((prev) => [...prev, withPhoto]);
          applySelectMarker(withPhoto);
          setControlResultDraft("ko");
          setEnterpriseDraft(inheritedEnterpriseId ?? "");
          setTradeDraft(inheritedTrade ?? "");
        } catch (err) {
          setError(err instanceof Error ? err.message : "Impossible d'ajouter la pastille.");
        }
      });
    })();
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

  async function handleAnnotatedPhotoConfirm(blob: Blob) {
    const pending = pendingPhoto;
    setPendingPhoto(null);
    if (!pending || !selectedMarker) return;

    const formData = new FormData();
    formData.append("photo", blob, pending.file.name || "photo.jpg");
    const id = selectedMarker.id;

    startTransition(async () => {
      try {
        setError(null);
        if (pending.mode === "resolve") {
          const url = await uploadMarkerPhotoAndResolve(
            visit.id,
            projectId,
            id,
            formData
          );
          setMarkers((prev) =>
            prev.map((m) =>
              m.id === id ? { ...m, photo_public_url: url, status: "levee" } : m
            )
          );
          setSelectedMarkerId(null);
        } else {
          const url = await uploadMarkerPhoto(visit.id, projectId, id, formData);
          setMarkers((prev) =>
            prev.map((m) =>
              m.id === id ? { ...m, photo_public_url: url } : m
            )
          );
        }
      } catch (err) {
        setError(
          err instanceof Error
            ? err.message
            : pending.mode === "resolve"
              ? "Erreur photo + levée."
              : "Erreur lors de l'upload."
        );
      }
    });
  }

  function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!selectedMarker || !e.target.files?.[0]) return;
    const file = e.target.files[0];
    e.target.value = "";
    setPendingPhoto({ file, mode: "upload" });
  }

  function handlePhotoAndResolve(e: React.ChangeEvent<HTMLInputElement>) {
    if (!selectedMarker || !e.target.files?.[0]) return;
    const file = e.target.files[0];
    e.target.value = "";
    setPendingPhoto({ file, mode: "resolve" });
  }

  function handleResolveMarker(markerId?: string) {
    const id = markerId ?? selectedMarker?.id;
    if (!id) return;
    startTransition(async () => {
      try {
        setError(null);
        await updateMarker(visit.id, projectId, id, {
          resolve_only: true,
        });
        setMarkers((prev) =>
          prev.map((m) => (m.id === id ? { ...m, status: "levee" } : m))
        );
        if (selectedMarkerId === id) setSelectedMarkerId(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur.");
      }
    });
  }

  function handleUnresolveMarker(markerId?: string) {
    const id = markerId ?? selectedMarker?.id;
    if (!id) return;
    startTransition(async () => {
      try {
        setError(null);
        await updateMarker(visit.id, projectId, id, {
          unresolve_only: true,
        });
        setMarkers((prev) =>
          prev.map((m) =>
            m.id === id
              ? {
                  ...m,
                  status: "a_traiter",
                  control_result: m.enterprise_id ? "ko" : m.control_result,
                }
              : m
          )
        );
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur.");
      }
    });
  }

  function toggleUnlockMarker(markerId: string) {
    setUnlockedMarkerIds((prev) => {
      const next = new Set(prev);
      if (next.has(markerId)) next.delete(markerId);
      else next.add(markerId);
      return next;
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

  if (plans.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-8 text-center shadow-sm">
        <p className="text-lg font-semibold text-zinc-900">Aucun plan disponible</p>
        <p className="mt-2 text-zinc-500">
          Importez des plans PDF dans la bibliothèque de plans avant de commencer
          une visite.
        </p>
        <Link
          href={`/tablette/projets/${projectId}/plans`}
          className="mt-6 inline-block rounded-xl bg-zinc-900 px-6 py-3 font-semibold text-white"
        >
          Bibliothèque de plans
        </Link>
      </div>
    );
  }

  return (
    <div className="tablette-visit-editor flex min-h-0 flex-col md:flex-row">
      <aside className="flex w-full shrink-0 flex-col border-r border-zinc-200 bg-white md:w-72 lg:w-80">
        <div className="border-b border-zinc-100 px-4 py-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                visitControlSummary === "ok"
                  ? "bg-emerald-100 text-emerald-800"
                  : visitControlSummary === "partial"
                    ? "bg-amber-100 text-amber-800"
                    : visitControlSummary === "ko"
                      ? "bg-red-100 text-red-800"
                      : "bg-zinc-100 text-zinc-700"
              }`}
            >
              {VISIT_CONTROL_SUMMARY_LABELS[visitControlSummary]}
            </span>
            <button
              type="button"
              onClick={() => setShowReport(true)}
              className="rounded-lg bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-700"
            >
              Aperçu rapport
            </button>
            {isCompleted && reportUrl && (
              <a
                href={reportUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800"
              >
                PDF
              </a>
            )}
          </div>
          <h2 className="text-base font-bold text-zinc-900">Pastilles</h2>
          <p className="text-xs text-zinc-500">
            {visibleMarkers.length} pastille{visibleMarkers.length !== 1 ? "s" : ""} visible
            {phaseName ? ` · ${phaseName}` : ""}
            {controlLabel ? ` · ${controlLabel}` : ""}
          </p>
          <div className="mt-2 space-y-2">
            <details className="group relative">
              <summary className="cursor-pointer list-none rounded-lg bg-zinc-100 px-2.5 py-1.5 text-[11px] font-semibold text-zinc-700 marker:content-none [&::-webkit-details-marker]:hidden">
                Entreprises
                <span className="ml-1 text-zinc-400">
                  {enterpriseFilterIds === null
                    ? "(toutes)"
                    : enterpriseFilterIds.length === 0
                      ? "(aucune)"
                      : `(${enterpriseFilterIds.length})`}
                </span>
              </summary>
              <div className="absolute left-0 right-0 z-20 mt-1 rounded-xl border border-zinc-200 bg-white p-2 shadow-lg">
                <div className="mb-2 flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setEnterpriseFilterIds(null)}
                    className="rounded-lg bg-zinc-100 px-2 py-1 text-[10px] font-semibold text-zinc-700"
                  >
                    Tout cocher
                  </button>
                  <button
                    type="button"
                    onClick={() => setEnterpriseFilterIds([])}
                    className="rounded-lg bg-zinc-100 px-2 py-1 text-[10px] font-semibold text-zinc-700"
                  >
                    Tout décocher
                  </button>
                </div>
                <div className="max-h-40 space-y-1 overflow-y-auto">
                  {enterprises.map((e) => (
                    <label
                      key={e.id}
                      className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1 hover:bg-zinc-50"
                    >
                      <input
                        type="checkbox"
                        checked={isEnterpriseFilterChecked(e.id)}
                        onChange={() => toggleEnterpriseFilter(e.id)}
                        className="h-4 w-4 rounded border-zinc-300"
                      />
                      <span className="text-[11px] font-medium text-zinc-800">{e.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            </details>
            <div className="flex flex-wrap gap-1.5">
              {TABLET_FILTER_STATES.map((state: TabletMarkerVisualState) => {
                const active = markerFilters.states.includes(state);
                return (
                  <button
                    key={state}
                    type="button"
                    onClick={() =>
                      setMarkerFilters((f) => ({
                        ...f,
                        states: toggleFilterValue(f.states, state),
                      }))
                    }
                    className={`rounded-lg px-2 py-1 text-[11px] font-semibold ${
                      active
                        ? "bg-zinc-900 text-white"
                        : "bg-zinc-100 text-zinc-700"
                    }`}
                  >
                    {TABLET_MARKER_STATE_LABELS[state]}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
          {visibleMarkers.length === 0 ? (
            <p className="px-2 py-4 text-sm text-zinc-500">
              Aucune pastille pour ce filtre. Activez le mode pastille et touchez le plan.
            </p>
          ) : (
            <div className="space-y-3">
              {markersByPlan.map(({ plan, markers: groupMarkers }) => (
                <div key={plan.id}>
                  <p className="sticky top-0 z-10 bg-white px-2 py-1 text-[10px] font-bold uppercase tracking-wide text-zinc-400">
                    {plan.name}
                  </p>
                  <ul className="space-y-1.5">
                    {groupMarkers.map((marker) => {
                      const isPrior = isPriorVisitMarker(marker.visit_id, visit.id);
                      const isLocked = isPrior && !unlockedMarkerIds.has(marker.id);
                      const canSwipeResolve =
                        isPrior && !isCompleted && marker.status !== "levee";
                      const row = (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedPlanId(marker.plan_id);
                            selectMarker(marker);
                          }}
                          className={`w-full rounded-xl px-3 py-2.5 text-left transition-colors ${
                            selectedMarkerId === marker.id
                              ? "bg-amber-50 ring-2 ring-amber-400"
                              : "bg-zinc-50 hover:bg-zinc-100"
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <span
                              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
                              style={{
                                backgroundColor: markerControlHex(
                                  marker.control_result,
                                  marker.status
                                ),
                              }}
                            >
                              {marker.marker_number}
                            </span>
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-medium text-zinc-900">
                                {enterpriseName(marker)}
                              </p>
                              <p className="truncate text-xs text-zinc-500">
                                {markerRowSubtitle(marker)}
                              </p>
                            </div>
                            {isLocked && (
                              <span className="text-sm" title="Verrouillée">
                                🔒
                              </span>
                            )}
                            {marker.photo_public_url && (
                              <span className="text-xs text-emerald-600">📷</span>
                            )}
                          </div>
                        </button>
                      );

                      if (!canSwipeResolve) {
                        return <li key={marker.id}>{row}</li>;
                      }

                      return (
                        <SwipeableMarkerRow
                          key={marker.id}
                          disabled={isPending}
                          onResolve={() => handleResolveMarker(marker.id)}
                        >
                          {row}
                        </SwipeableMarkerRow>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>

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
              <div className="flex overflow-hidden rounded-lg border border-zinc-200">
                <button
                  type="button"
                  onClick={() => setPlaceTool("pastille")}
                  className={`min-h-10 px-3 py-2 text-sm font-bold ${
                    placeTool === "pastille"
                      ? "bg-amber-500 text-white"
                      : "bg-white text-zinc-700 hover:bg-zinc-50"
                  }`}
                >
                  Pastille
                </button>
                <button
                  type="button"
                  onClick={() => setPlaceTool("dessin")}
                  className={`min-h-10 px-3 py-2 text-sm font-bold ${
                    placeTool === "dessin"
                      ? "bg-orange-500 text-white"
                      : "bg-white text-zinc-700 hover:bg-zinc-50"
                  }`}
                >
                  Dessin
                </button>
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

        {!isCompleted && (
          <div
            className={`flex shrink-0 items-center gap-3 border-b px-3 py-1.5 ${
              placeTool === "pastille"
                ? "border-amber-200 bg-amber-50"
                : "border-orange-200 bg-orange-50"
            }`}
          >
            <p className="min-w-0 flex-1 text-xs font-medium text-zinc-700">
              {placeTool === "pastille"
                ? "Mode pastille — touchez le plan pour placer"
                : "Mode dessin — glissez sur le plan pour tracer"}
            </p>
            {drawMode && (
              <>
                <button
                  type="button"
                  onClick={handleUndoDrawing}
                  className="shrink-0 rounded-lg bg-white/80 px-3 py-1 text-xs font-bold text-zinc-800"
                >
                  Annuler trait
                </button>
                <div className="flex shrink-0 items-center gap-1.5 rounded-lg bg-white/80 px-2 py-1">
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
              </>
            )}
          </div>
        )}

        {selectedMarker && (
          <div className="max-h-[40vh] shrink-0 overflow-y-auto border-b border-zinc-200 bg-white px-3 py-2">
            <div className="mb-1.5 flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-semibold text-zinc-900">
                Pastille n°{selectedMarker.marker_number}
              </h3>
              {selectedMarkerIsPrior && (
                <button
                  type="button"
                  onClick={() => toggleUnlockMarker(selectedMarker.id)}
                  className="rounded-lg bg-zinc-100 px-2 py-1 text-[10px] font-semibold text-zinc-700"
                  title={
                    selectedMarkerLocked
                      ? "Déverrouiller pour modifier"
                      : "Reverrouiller"
                  }
                >
                  {selectedMarkerLocked ? "🔒 Déverrouiller" : "🔓 Modifiable"}
                </button>
              )}
              {!isCompleted && selectedMarkerIsPrior && selectedMarker.status === "levee" && (
                <button
                  type="button"
                  disabled={isPending}
                  onClick={() => handleUnresolveMarker()}
                  className="rounded-lg border border-amber-300 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-900 disabled:opacity-40"
                >
                  Délever
                </button>
              )}
              {!isCompleted &&
                selectedMarkerIsPrior &&
                !selectedMarkerLocked &&
                selectedMarker.status !== "levee" && (
                  <>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => handleResolveMarker()}
                      className="rounded-lg bg-emerald-600 px-2.5 py-1 text-xs font-semibold text-white disabled:opacity-40"
                    >
                      Lever
                    </button>
                    <label className="cursor-pointer rounded-lg border border-zinc-300 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700">
                      Photo + lever
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        disabled={isPending}
                        onChange={handlePhotoAndResolve}
                      />
                    </label>
                  </>
                )}
            </div>

            {selectedMarkerLocked && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                Pastille d&apos;une visite antérieure — lecture seule. Vous pouvez la
                lever (avec ou sans photo) ou déverrouiller pour modifier.
                {selectedMarker.status !== "levee" && (
                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={isPending || isCompleted}
                      onClick={() => handleResolveMarker()}
                      className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-40"
                    >
                      Lever la pastille
                    </button>
                    <label className="cursor-pointer rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-700">
                      Photo + lever
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        disabled={isCompleted || isPending}
                        onChange={handlePhotoAndResolve}
                      />
                    </label>
                  </div>
                )}
              </div>
            )}

            {!selectedMarkerLocked && (
              <div className="flex flex-col gap-2">
                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-[10rem] flex-1">
                    <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                      Point
                    </label>
                    <select
                      value={checklistItemDraft}
                      onChange={(e) => handleChecklistItemChange(e.target.value)}
                      disabled={isCompleted}
                      className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-sm disabled:opacity-60"
                    >
                      <option value="">— Choisir —</option>
                      {filteredChecklistItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {checklistItemDraft && (
                    <div className="shrink-0">
                      <p className="mb-0.5 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                        Résultat
                      </p>
                      <div className="flex flex-wrap gap-1">
                        {CONTROL_STATUS_OPTIONS.map((result) => {
                          const colors = CONTROL_RESULT_COLORS[result];
                          const isActive = controlResultDraft === result;
                          return (
                            <button
                              key={result}
                              type="button"
                              disabled={isCompleted}
                              onClick={() => setControlResultDraft(result)}
                              className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
                                isActive
                                  ? `${colors.bg} ${colors.text}`
                                  : "bg-zinc-100 text-zinc-700"
                              }`}
                            >
                              {CONTROL_RESULT_LABELS[result]}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {(controlResultDraft === "ok" || controlResultDraft === "ko") && (
                    <div className="min-w-[9rem] flex-1">
                      <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                        Entreprise *
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
                        className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-sm disabled:opacity-60"
                      >
                        <option value="">— Non assignée —</option>
                        {enterprises.map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.name}
                            {e.trade ? ` (${e.trade})` : ""}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {planLevels.length > 1 && (
                    <div className="min-w-[7rem]">
                      <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                        Niveau
                      </label>
                      <select
                        value={planLevelDraft}
                        onChange={(e) => setPlanLevelDraft(e.target.value)}
                        disabled={isCompleted}
                        className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-sm disabled:opacity-60"
                      >
                        {planLevels.map((level) => (
                          <option key={level.id} value={level.id}>
                            {level.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                {selectedChecklistItem?.help_comment && (
                  <p className="rounded-lg bg-sky-50 px-2 py-1 text-xs text-sky-900">
                    {selectedChecklistItem.help_comment}
                  </p>
                )}

                {controlResultDraft === "ko" &&
                  selectedChecklistItem &&
                  Array.isArray(selectedChecklistItem.preset_comments) &&
                  (selectedChecklistItem.preset_comments as string[]).length > 0 && (
                    <div className="flex flex-wrap items-center gap-1">
                      <span className="text-[10px] font-semibold uppercase text-zinc-400">
                        Remarques NC
                      </span>
                      {(selectedChecklistItem.preset_comments as string[]).map(
                        (preset) => (
                          <button
                            key={preset}
                            type="button"
                            disabled={isCompleted}
                            onClick={() => {
                              setPresetCommentDraft(preset);
                              setRemarkDraft(preset);
                            }}
                            className={`rounded-lg px-2 py-0.5 text-xs font-medium ${
                              presetCommentDraft === preset
                                ? "bg-red-600 text-white"
                                : "bg-zinc-100 text-zinc-700"
                            }`}
                          >
                            {preset}
                          </button>
                        )
                      )}
                    </div>
                  )}

                <div className="flex flex-wrap items-end gap-2">
                  <div className="min-w-[7rem] flex-1">
                    <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                      Localisation
                    </label>
                    <div className="flex gap-1.5">
                      <select
                        value={locationPresetDraft}
                        onChange={(e) => setLocationPresetDraft(e.target.value)}
                        disabled={isCompleted}
                        className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-sm disabled:opacity-60"
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
                        placeholder="Précision…"
                        disabled={isCompleted}
                        className="min-w-0 flex-1 rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-sm disabled:opacity-60"
                      />
                    </div>
                  </div>

                  <div className="min-w-[12rem] flex-[2]">
                    <label className="mb-0.5 block text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
                      Remarque
                    </label>
                    <textarea
                      value={remarkDraft}
                      onChange={(e) => setRemarkDraft(e.target.value)}
                      placeholder="Remarque…"
                      rows={1}
                      disabled={isCompleted}
                      className="w-full resize-y rounded-lg border border-zinc-200 bg-zinc-50 px-2 py-1.5 text-sm focus:border-zinc-400 focus:outline-none disabled:opacity-60"
                    />
                  </div>

                  {selectedMarker.photo_public_url && (
                    <img
                      src={selectedMarker.photo_public_url}
                      alt="Photo réserve"
                      className="h-10 w-14 shrink-0 rounded-lg object-cover"
                    />
                  )}

                  {!isCompleted && (
                    <div className="flex shrink-0 items-center gap-1.5">
                      <label className="inline-flex cursor-pointer items-center">
                        <span className="sr-only">Ajouter une photo</span>
                        <span className="inline-flex min-h-9 items-center justify-center rounded-lg border border-zinc-200 bg-zinc-50 px-2.5 py-1.5 text-sm font-semibold text-zinc-800 hover:bg-zinc-100">
                          📷+
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          onChange={handlePhotoUpload}
                          disabled={isPending}
                          className="hidden"
                        />
                      </label>
                      <button
                        type="button"
                        onClick={handleDeleteMarker}
                        disabled={isPending}
                        className="min-h-9 rounded-lg border border-red-200 px-2.5 py-1.5 text-sm font-medium text-red-600"
                      >
                        Supprimer
                      </button>
                    </div>
                  )}
                </div>

                {(controlResultDraft === "ok" || controlResultDraft === "ko") &&
                  !enterpriseDraft && (
                    <p className="text-[11px] text-amber-700">
                      Conforme ou À lever : l&apos;entreprise est obligatoire.
                    </p>
                  )}
              </div>
            )}
          </div>
        )}

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

        <div className="relative min-h-0 flex-1">
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
                control_result: m.control_result,
                status: m.status,
              }))}
              strokes={currentStrokes}
              onStrokesChange={handleStrokesChange}
              selectedMarkerId={selectedMarkerId}
              onPlanClick={handlePlanClick}
              onMarkerClick={(id) => {
                const marker = markers.find((m) => m.id === id);
                if (marker) {
                  setSelectedPlanId(marker.plan_id);
                  selectMarker(marker);
                }
              }}
              onMarkerMove={(id, x, y) => {
                setMarkers((prev) =>
                  prev.map((m) =>
                    m.id === id ? { ...m, x_percent: x, y_percent: y } : m
                  )
                );
                const m = markers.find((x) => x.id === id);
                const isPrior = m != null && isPriorVisitMarker(m.visit_id, visit.id);
                startTransition(() =>
                  updateMarker(visit.id, projectId, id, {
                    x_percent: x,
                    y_percent: y,
                    unlock_edit: isPrior && unlockedMarkerIds.has(id),
                  })
                );
              }}
              canMoveMarker={(id) => {
                const m = markers.find((x) => x.id === id);
                if (!m || isCompleted) return false;
                const isPrior = isPriorVisitMarker(m.visit_id, visit.id);
                return !isPrior || unlockedMarkerIds.has(id);
              }}
            />
          )}
        </div>
        </div>
      </div>

      {pendingPhoto && (
        <MarkerPhotoAnnotator
          file={pendingPhoto.file}
          onConfirm={handleAnnotatedPhotoConfirm}
          onCancel={() => setPendingPhoto(null)}
        />
      )}

      {showReport && (
        <VisitReportPreview
          visit={visit}
          phaseName={phaseName ?? null}
          zoneName={null}
          controlLabel={controlLabel ?? null}
          reportUrl={reportUrl ?? null}
          checklistItems={checklistItems}
          markers={markers}
          enterprises={enterprises}
          onClose={() => setShowReport(false)}
        />
      )}
    </div>
  );
}
