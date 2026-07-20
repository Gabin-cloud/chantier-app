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
  zoneName?: string | null;
  controlLabel?: string | null;
  reportUrl?: string | null;
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
  zoneName,
  controlLabel,
  reportUrl,
  checklistItems,
  markers,
  enterprises,
  onClose,
}: VisitReportPreviewProps) {
  const visitMarkers = markers.filter((m) => m.visit_id === visit.id);
  const summary =
    visit.control_summary ?? computeVisitControlSummary(visitMarkers);
  const visitDate = new Date(visit.visit_date).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const enterpriseMap = new Map(enterprises.map((e) => [e.id, e.name]));

  const controlMarkers = visitMarkers.filter((m) => m.checklist_item_id);

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
              {controlLabel ? ` · ${controlLabel}` : ""}
            </p>
          </div>
          <div className="flex gap-2">
            {reportUrl && (
              <a
                href={reportUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-lg bg-emerald-100 px-3 py-1.5 text-sm font-semibold text-emerald-800"
              >
                PDF
              </a>
            )}
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-500 hover:bg-zinc-100"
            >
              Fermer
            </button>
          </div>
        </div>

        <div className="overflow-y-auto px-5 py-4">
          <div
            className={`mb-4 inline-flex rounded-full px-3 py-1 text-sm font-semibold ${SUMMARY_COLORS[summary]}`}
          >
            Synthèse : {VISIT_CONTROL_SUMMARY_LABELS[summary]}
          </div>

          {checklistItems.length > 0 && (
            <section className="mb-5">
              <h3 className="mb-2 border-b border-zinc-200 pb-1 text-sm font-bold uppercase tracking-wide text-zinc-700">
                Points de contrôle
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
                  {checklistItems.map((item) => {
                    const marker = controlMarkers.find(
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
          )}

          <section className="mb-4">
            <h3 className="mb-2 border-b border-zinc-200 pb-1 text-sm font-bold uppercase tracking-wide text-zinc-700">
              Pastilles
            </h3>
            {visitMarkers.length === 0 ? (
              <p className="text-sm text-zinc-500">Aucune pastille sur cette visite.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {visitMarkers.map((marker) => (
                  <li key={marker.id} className="rounded-lg bg-zinc-50 px-3 py-2">
                    <p className="font-semibold text-zinc-900">
                      #{marker.marker_number}
                      {marker.control_result
                        ? ` — ${CONTROL_RESULT_LABELS[marker.control_result]}`
                        : ""}
                    </p>
                    {marker.remark && (
                      <p className="text-zinc-600">{marker.remark}</p>
                    )}
                    {marker.enterprise_id && (
                      <p className="text-xs text-zinc-500">
                        {enterpriseMap.get(marker.enterprise_id)}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          {controlMarkers.length === 0 && checklistItems.length === 0 && (
            <p className="text-sm text-zinc-500">
              Aucun point de contrôle renseigné pour cette visite.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
