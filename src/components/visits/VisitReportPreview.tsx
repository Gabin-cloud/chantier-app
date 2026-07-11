"use client";

import type {
  ControlResult,
  Enterprise,
  MarkerWithLinks,
  PhaseChecklistItem,
  Visit,
  VisitControlSummary,
} from "@/lib/types/database";
import {
  CONTROL_RESULT_LABELS,
  VISIT_CONTROL_SUMMARY_LABELS,
} from "@/lib/types/database";
import { computeVisitControlSummary } from "@/lib/control-summary";

type VisitReportPreviewProps = {
  visit: Visit;
  phaseName: string | null;
  checklistItems: PhaseChecklistItem[];
  markers: MarkerWithLinks[];
  enterprises: Enterprise[];
  onClose: () => void;
};

const SUMMARY_COLORS: Record<VisitControlSummary, string> = {
  pending: "bg-zinc-100 text-zinc-700",
  ok: "bg-emerald-100 text-emerald-800",
  partial: "bg-amber-100 text-amber-800",
  ko: "bg-red-100 text-red-800",
};

export function VisitReportPreview({
  visit,
  phaseName,
  checklistItems,
  markers,
  enterprises,
  onClose,
}: VisitReportPreviewProps) {
  const summary = visit.control_summary ?? computeVisitControlSummary(markers);
  const visitDate = new Date(visit.visit_date).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const enterpriseMap = new Map(enterprises.map((e) => [e.id, e.name]));
  const itemMap = new Map(checklistItems.map((i) => [i.id, i]));

  const controlMarkers = markers.filter((m) => m.checklist_item_id);

  const zones = [...new Set(checklistItems.map((i) => i.zone_name || "Général"))];

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center">
      <div className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-xl">
        <div className="flex items-start justify-between border-b border-zinc-100 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
              Aperçu rapport
            </p>
            <h2 className="text-lg font-bold text-zinc-900">{visit.title}</h2>
            <p className="text-sm text-zinc-500">
              {visitDate}
              {phaseName ? ` · ${phaseName}` : ""}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-500 hover:bg-zinc-100"
          >
            Fermer
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          <div className={`mb-4 inline-flex rounded-full px-3 py-1 text-sm font-semibold ${SUMMARY_COLORS[summary]}`}>
            Synthèse : {VISIT_CONTROL_SUMMARY_LABELS[summary]}
          </div>

          {zones.map((zone) => {
            const zoneItems = checklistItems.filter(
              (i) => (i.zone_name || "Général") === zone
            );
            const zoneMarkers = controlMarkers.filter((m) => {
              const item = itemMap.get(m.checklist_item_id!);
              return item && (item.zone_name || "Général") === zone;
            });

            return (
              <section key={zone} className="mb-5">
                <h3 className="mb-2 border-b border-zinc-200 pb-1 text-sm font-bold uppercase tracking-wide text-zinc-700">
                  {zone}
                </h3>
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="text-xs text-zinc-500">
                      <th className="pb-2 pr-2 font-semibold">Point de contrôle</th>
                      <th className="pb-2 pr-2 font-semibold">Résultat</th>
                      <th className="pb-2 font-semibold">Entreprise</th>
                    </tr>
                  </thead>
                  <tbody>
                    {zoneItems.map((item) => {
                      const marker = zoneMarkers.find(
                        (m) => m.checklist_item_id === item.id
                      );
                      return (
                        <tr key={item.id} className="border-t border-zinc-100">
                          <td className="py-2 pr-2 align-top">{item.label}</td>
                          <td className="py-2 pr-2 align-top">
                            {marker?.control_result
                              ? CONTROL_RESULT_LABELS[marker.control_result]
                              : "—"}
                          </td>
                          <td className="py-2 align-top">
                            {marker?.enterprise_id
                              ? enterpriseMap.get(marker.enterprise_id) ?? "—"
                              : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </section>
            );
          })}

          {controlMarkers.length === 0 && (
            <p className="text-sm text-zinc-500">
              Aucun point de contrôle renseigné via les réserves pour cette visite.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
