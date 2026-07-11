"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PcVisitRow } from "@/lib/actions/control-board";
import {
  generateVisitReportFromPc,
  sendVisitEmailsFromPc,
} from "@/lib/actions/control-board";
import { VISIT_CONTROL_SUMMARY_LABELS } from "@/lib/types/database";

export function PcVisitReportsPanel({
  projectId,
  visits,
  canEdit,
}: {
  projectId: string;
  visits: PcVisitRow[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function handleGenerate(visitId: string) {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        await generateVisitReportFromPc(projectId, visitId);
        setSuccess("Rapport PDF généré.");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur génération PDF.");
      }
    });
  }

  function handleSendEmails(visitId: string) {
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        const result = await sendVisitEmailsFromPc(projectId, visitId);
        setSuccess(`${result.sentCount} email(s) envoyé(s).`);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur envoi email.");
      }
    });
  }

  if (visits.length === 0) {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
        Aucune visite enregistrée pour ce projet.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Générez les rapports PDF et envoyez les emails aux entreprises depuis le PC.
        Les emails ne partent plus automatiquement depuis la tablette.
      </p>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Visite</th>
              <th className="px-4 py-3 font-semibold">Date</th>
              <th className="px-4 py-3 font-semibold">Phase / Zone</th>
              <th className="px-4 py-3 font-semibold">Synthèse</th>
              <th className="px-4 py-3 font-semibold">Rapport</th>
              <th className="px-4 py-3 font-semibold">Email</th>
              {canEdit && <th className="px-4 py-3 font-semibold">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {visits.map((visit) => (
              <tr key={visit.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium text-slate-900">
                  {visit.title ?? "Visite"}
                  {visit.status === "in_progress" && (
                    <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800">
                      En cours
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {new Date(visit.visit_date).toLocaleDateString("fr-FR")}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {[visit.phaseName, visit.zoneName].filter(Boolean).join(" · ") || "—"}
                </td>
                <td className="px-4 py-3">
                  {visit.control_summary
                    ? VISIT_CONTROL_SUMMARY_LABELS[visit.control_summary]
                    : "—"}
                </td>
                <td className="px-4 py-3">
                  {visit.reportUrl ? (
                    <a
                      href={visit.reportUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-semibold text-emerald-700 hover:underline"
                    >
                      PDF
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
                <td className="px-4 py-3">
                  {visit.emailSent ? (
                    <span className="text-emerald-700">Envoyé</span>
                  ) : (
                    <span className="text-slate-400">Non envoyé</span>
                  )}
                </td>
                {canEdit && (
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => handleGenerate(visit.id)}
                        className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-200"
                      >
                        Générer PDF
                      </button>
                      <button
                        type="button"
                        disabled={isPending || visit.status !== "completed"}
                        onClick={() => handleSendEmails(visit.id)}
                        className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-40"
                      >
                        Envoyer emails
                      </button>
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {success && (
        <p className="rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-800">{success}</p>
      )}
      {error && (
        <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>
      )}
    </div>
  );
}
