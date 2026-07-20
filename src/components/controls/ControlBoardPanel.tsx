"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { ControlBoardRow } from "@/lib/actions/control-board";
import {
  syncControlBoardFromMarkers,
  updateControlPointTracking,
} from "@/lib/actions/control-board";
import { importControlLibraryToProject } from "@/lib/actions/control-library";
import { addPhaseChecklistItem } from "@/lib/actions/checklist";
import { addVisitPhase } from "@/lib/actions/phases";
import { addPhaseZone } from "@/lib/actions/zones";
import type { VisitPhase } from "@/lib/types/database";
import { CONTROL_RESULT_LABELS } from "@/lib/types/database";

function rowBackground(row: ControlBoardRow): string {
  const hasOpenNc = row.controlResult === "ko" && !row.nonConformityResolved;

  if (hasOpenNc) return "bg-red-50";
  if (row.controlResult === "ok" && row.attestationDate) return "bg-emerald-50";
  if (row.controlResult === "ok") return "bg-green-50";
  if (row.controlResult === "ko" && row.nonConformityResolved) {
    return "bg-emerald-50";
  }
  if (row.controlResult === "deferred") return "bg-blue-50";
  if (row.controlResult === "pending") return "bg-amber-50";
  return "bg-white";
}

type ControlBoardPanelProps = {
  projectId: string;
  phases: VisitPhase[];
  rows: ControlBoardRow[];
  canEdit: boolean;
};

export function ControlBoardPanel({
  projectId,
  phases,
  rows,
  canEdit,
}: ControlBoardPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activePhaseId, setActivePhaseId] = useState(phases[0]?.id ?? "");
  const [newPhaseName, setNewPhaseName] = useState("");
  const [newZoneName, setNewZoneName] = useState("");
  const [newControlLabel, setNewControlLabel] = useState("");
  const [addZoneFor, setAddZoneFor] = useState<string | null>(null);
  const topScrollRef = useRef<HTMLDivElement>(null);
  const tableScrollRef = useRef<HTMLDivElement>(null);

  const sortedPhases = useMemo(
    () => [...phases].sort((a, b) => a.sort_order - b.sort_order),
    [phases]
  );

  const phaseRows = useMemo(
    () => rows.filter((r) => r.phaseId === activePhaseId),
    [rows, activePhaseId]
  );

  const zones = useMemo(
    () => [...new Set(phaseRows.map((r) => r.zoneName))],
    [phaseRows]
  );

  function syncScroll(source: "top" | "table") {
    if (!topScrollRef.current || !tableScrollRef.current) return;
    if (source === "top") {
      tableScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
    } else {
      topScrollRef.current.scrollLeft = tableScrollRef.current.scrollLeft;
    }
  }

  function handleAddPhase(e: React.FormEvent) {
    e.preventDefault();
    if (!newPhaseName.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        const phase = await addVisitPhase(projectId, newPhaseName);
        setNewPhaseName("");
        setActivePhaseId(phase.id);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur.");
      }
    });
  }

  function handleAddZone(zoneName: string) {
    if (!activePhaseId || !zoneName.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await addPhaseZone(projectId, activePhaseId, zoneName);
        setNewZoneName("");
        setAddZoneFor(null);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur.");
      }
    });
  }

  function handleAddControl(zoneName: string, label: string) {
    if (!activePhaseId || !label.trim()) return;
    const zoneRow = phaseRows.find((r) => r.zoneName === zoneName);
    setError(null);
    startTransition(async () => {
      try {
        await addPhaseChecklistItem(
          projectId,
          activePhaseId,
          label,
          zoneRow?.zoneId ?? undefined,
          zoneName
        );
        setNewControlLabel("");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur.");
      }
    });
  }

  function handleImportLibrary() {
    setError(null);
    startTransition(async () => {
      try {
        const result = await importControlLibraryToProject(projectId);
        setSuccess(`${result.imported} point(s) importé(s).`);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur.");
      }
    });
  }

  function handleSync() {
    setError(null);
    startTransition(async () => {
      try {
        await syncControlBoardFromMarkers(projectId);
        setSuccess("Tableau synchronisé avec les visites terrain.");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur.");
      }
    });
  }

  function handleAttestationChange(itemId: string, value: string) {
    if (!canEdit) return;
    startTransition(async () => {
      try {
        await updateControlPointTracking(projectId, itemId, {
          attestation_date: value || null,
        });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur.");
      }
    });
  }

  function handleResolvedChange(itemId: string, checked: boolean) {
    if (!canEdit) return;
    startTransition(async () => {
      try {
        await updateControlPointTracking(projectId, itemId, {
          non_conformity_resolved: checked,
        });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur.");
      }
    });
  }

  return (
    <div className="space-y-4">
      {/* Onglets phases */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        {sortedPhases.map((phase) => (
          <button
            key={phase.id}
            type="button"
            onClick={() => setActivePhaseId(phase.id)}
            className={`rounded-t-lg px-4 py-2.5 text-sm font-semibold transition-colors ${
              activePhaseId === phase.id
                ? "bg-emerald-600 text-white shadow-sm"
                : "bg-slate-100 text-slate-700 hover:bg-slate-200"
            }`}
          >
            {phase.name}
            <span className="ml-2 text-xs opacity-80">
              ({rows.filter((r) => r.phaseId === phase.id).length})
            </span>
          </button>
        ))}
        {canEdit && (
          <form onSubmit={handleAddPhase} className="ml-2 flex items-center gap-2">
            <input
              value={newPhaseName}
              onChange={(e) => setNewPhaseName(e.target.value)}
              placeholder="+ Nouvelle phase"
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-slate-800 px-3 py-2 text-sm font-semibold text-white"
            >
              Ajouter
            </button>
          </form>
        )}
      </div>

      {/* Barre d'outils */}
      {canEdit && (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={handleImportLibrary}
            disabled={isPending}
            className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800"
          >
            Importer bibliothèque
          </button>
          <button
            type="button"
            onClick={handleSync}
            disabled={isPending}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
          >
            Synchroniser depuis le terrain
          </button>
          <button
            type="button"
            onClick={() => setAddZoneFor(activePhaseId)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700"
          >
            + Zone
          </button>
        </div>
      )}

      {addZoneFor && canEdit && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAddZone(newZoneName);
          }}
          className="flex gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3"
        >
          <input
            value={newZoneName}
            onChange={(e) => setNewZoneName(e.target.value)}
            placeholder="Nom de la zone (ex. FOND DE FOUILLE)"
            className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
            autoFocus
          />
          <button type="submit" className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white">
            Créer
          </button>
          <button
            type="button"
            onClick={() => setAddZoneFor(null)}
            className="rounded-lg px-3 py-2 text-sm text-slate-500"
          >
            Annuler
          </button>
        </form>
      )}

      {phaseRows.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
          Aucun point de contrôle pour cette phase.
          {canEdit && " Ajoutez une zone et des points, ou importez la bibliothèque."}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {/* Scrollbar du haut */}
          <div
            ref={topScrollRef}
            onScroll={() => syncScroll("top")}
            className="overflow-x-auto border-b border-slate-100"
            aria-hidden
          >
            <div className="h-3 min-w-[1100px]" />
          </div>

          <div
            ref={tableScrollRef}
            onScroll={() => syncScroll("table")}
            className="overflow-x-auto"
          >
            <table className="min-w-[1100px] w-full text-left text-sm">
              <thead>
                <tr>
                  <th
                    colSpan={6}
                    className="bg-emerald-700 px-4 py-2 text-center text-xs font-bold uppercase tracking-wide text-white"
                  >
                    Zone sous contrôle
                  </th>
                  <th
                    colSpan={2}
                    className="bg-emerald-400 px-4 py-2 text-center text-xs font-bold uppercase tracking-wide text-white"
                  >
                    Après contrôle
                  </th>
                </tr>
                <tr className="text-xs uppercase tracking-wide text-slate-600">
                  <th className="sticky top-0 bg-emerald-50 px-4 py-3 font-semibold">Zone</th>
                  <th className="sticky top-0 bg-emerald-50 px-4 py-3 font-semibold">
                    Point de contrôle
                  </th>
                  <th className="sticky top-0 bg-emerald-50 px-4 py-3 font-semibold">
                    Date du contrôle
                  </th>
                  <th className="sticky top-0 bg-emerald-50 px-4 py-3 font-semibold">Résultat</th>
                  <th className="sticky top-0 bg-emerald-50 px-4 py-3 font-semibold">Entreprise</th>
                  <th className="sticky top-0 bg-emerald-50 px-4 py-3 font-semibold">Rapport</th>
                  <th className="sticky top-0 bg-emerald-100 px-4 py-3 font-semibold">
                    Date attestation
                  </th>
                  <th className="sticky top-0 bg-emerald-100 px-4 py-3 font-semibold">
                    Levée NC
                  </th>
                </tr>
              </thead>
              <tbody>
                {zones.map((zoneName) => {
                  const zoneRows = phaseRows.filter((r) => r.zoneName === zoneName);
                  return zoneRows.map((row, idx) => (
                    <tr
                      key={row.itemId}
                      className={`border-t border-slate-100 ${rowBackground(row)}`}
                    >
                      {idx === 0 && (
                        <td
                          rowSpan={zoneRows.length}
                          className="border-r border-slate-100 px-4 py-3 align-top font-semibold text-slate-800"
                        >
                          {zoneName}
                        </td>
                      )}
                      <td className="px-4 py-3 font-medium text-slate-900">{row.itemLabel}</td>
                      <td className="px-4 py-3 text-slate-700">
                        {row.controlDate
                          ? new Date(row.controlDate).toLocaleDateString("fr-FR")
                          : "—"}
                      </td>
                      <td className="px-4 py-3">
                        {row.controlResult ? (
                          <span
                            className={`rounded-full px-2.5 py-1 text-xs font-bold ${
                              row.controlResult === "ok"
                                ? "bg-green-200 text-green-900"
                                : row.controlResult === "ko"
                                  ? "bg-red-200 text-red-900"
                                  : "bg-amber-200 text-amber-900"
                            }`}
                          >
                            {CONTROL_RESULT_LABELS[row.controlResult]}
                          </span>
                        ) : (
                          <span className="text-slate-400">À faire</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-700">{row.enterpriseName ?? "—"}</td>
                      <td className="px-4 py-3">
                        {row.reportUrl ? (
                          <a
                            href={row.reportUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="font-semibold text-emerald-700 hover:underline"
                          >
                            PDF
                          </a>
                        ) : row.visitId ? (
                          <span className="text-xs text-slate-400">Pas encore généré</span>
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {canEdit ? (
                          <input
                            type="date"
                            defaultValue={row.attestationDate ?? ""}
                            onChange={(e) =>
                              handleAttestationChange(row.itemId, e.target.value)
                            }
                            className="rounded border border-slate-200 px-2 py-1 text-xs"
                          />
                        ) : row.attestationDate ? (
                          new Date(row.attestationDate).toLocaleDateString("fr-FR")
                        ) : (
                          "—"
                        )}
                      </td>
                      <td className="px-4 py-3 text-center">
                        {canEdit ? (
                          <input
                            type="checkbox"
                            defaultChecked={row.nonConformityResolved}
                            onChange={(e) =>
                              handleResolvedChange(row.itemId, e.target.checked)
                            }
                            className="h-4 w-4 rounded border-slate-300"
                          />
                        ) : row.nonConformityResolved ? (
                          "Oui"
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  ));
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Légende couleurs */}
      <div className="flex flex-wrap gap-4 text-xs text-slate-600">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-6 rounded bg-green-50 ring-1 ring-green-200" /> Conforme (sous contrôle)
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-6 rounded bg-emerald-50 ring-1 ring-emerald-200" /> Attestation reçue
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-6 rounded bg-red-50 ring-1 ring-red-200" /> Non-conformité ouverte
        </span>
      </div>

      {canEdit && phaseRows.length > 0 && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const zone = zones[zones.length - 1] ?? "Général";
            handleAddControl(zone, newControlLabel);
          }}
          className="flex gap-2"
        >
          <input
            value={newControlLabel}
            onChange={(e) => setNewControlLabel(e.target.value)}
            placeholder="Ajouter un point de contrôle dans la dernière zone…"
            className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <button
            type="submit"
            disabled={isPending || !newControlLabel.trim()}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white"
          >
            Ajouter point
          </button>
        </form>
      )}

      {success && (
        <p className="rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-800">{success}</p>
      )}
      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>
      )}
    </div>
  );
}
