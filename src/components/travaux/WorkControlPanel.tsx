"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { updateWorkControlExecutionAdmin } from "@/lib/actions/work-control";
import { WorkControlAttestationCell } from "@/components/travaux/WorkControlAttestationCell";
import {
  isWorkControlItemGreen,
  WORK_CONTROL_STATUS_LABELS,
  type WorkControlItemView,
  type WorkControlPanelData,
} from "@/lib/types/work-control";
import { CONTROL_RESULT_LABELS } from "@/lib/types/database";

type WorkControlPanelProps = {
  projectId: string;
  data: WorkControlPanelData;
  canAdmin: boolean;
  settingsHref: string;
};

function publicAttestationUrl(reportPath: string | null): string | null {
  if (!reportPath) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base}/storage/v1/object/public/visit-photos/${reportPath}`;
}

function statusBg(status: WorkControlItemView["status"]): string {
  if (isWorkControlItemGreen(status)) return "bg-emerald-50";
  if (status === "non_conform_open") return "bg-red-50";
  if (status === "partial") return "bg-sky-50";
  return "bg-white";
}

function StatusBadge({ status }: { status: WorkControlItemView["status"] }) {
  const green = isWorkControlItemGreen(status);
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
        green
          ? "bg-emerald-100 text-emerald-800"
          : status === "non_conform_open"
            ? "bg-red-100 text-red-800"
            : status === "partial"
              ? "bg-sky-100 text-sky-800"
              : "bg-amber-100 text-amber-800"
      }`}
    >
      {WORK_CONTROL_STATUS_LABELS[status]}
    </span>
  );
}

export function WorkControlPanel({
  projectId,
  data,
  canAdmin,
  settingsHref,
}: WorkControlPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [activePhaseId, setActivePhaseId] = useState(
    data.phases[0]?.phase.id ?? ""
  );
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  const activePhase = useMemo(
    () => data.phases.find((p) => p.phase.id === activePhaseId),
    [data.phases, activePhaseId]
  );

  function toggleExpand(itemId: string) {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) next.delete(itemId);
      else next.add(itemId);
      return next;
    });
  }

  function handleAdminUpdate(
    checklistItemId: string,
    planLevelId: string,
    patch: { adminWaived?: boolean }
  ) {
    setError(null);
    startTransition(async () => {
      try {
        await updateWorkControlExecutionAdmin(projectId, {
          checklistItemId,
          planLevelId,
          ...patch,
        });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-sky-100 bg-sky-50 px-3 py-2 text-sm text-sky-900">
        Les résultats de contrôle sont saisis sur la{" "}
        <strong>tablette</strong> (visites terrain). Ce tableau est en lecture
        seule, mis à jour automatiquement. Configuration :{" "}
        <Link href={settingsHref} className="font-semibold underline">
          Paramètres → Panneau de contrôle
        </Link>
        .
      </div>

      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex flex-wrap gap-1 border-b border-slate-200 pb-1">
        {data.phases.map(({ phase, summary }) => (
          <button
            key={phase.id}
            type="button"
            onClick={() => setActivePhaseId(phase.id)}
            className={`rounded-t px-3 py-1.5 text-xs font-semibold ${
              activePhaseId === phase.id
                ? "bg-white text-emerald-800 ring-1 ring-slate-200"
                : "text-slate-600 hover:bg-slate-50"
            }`}
          >
            {phase.name}
            <span className="ml-1 text-[10px] text-slate-400">
              ({summary.conform}/{summary.total})
            </span>
          </button>
        ))}
      </div>

      {activePhase && (
        <section className="rounded-lg border border-slate-200 bg-white">
          <header className="border-b border-slate-200 px-3 py-2">
            <h3 className="text-sm font-semibold text-slate-900">
              {activePhase.phase.name}
            </h3>
            <p className="text-[11px] text-slate-500">
              {activePhase.summary.conform} conforme(s) ·{" "}
              {activePhase.summary.nonConform} non conforme(s) ·{" "}
              {activePhase.summary.pending} en attente
            </p>
          </header>

          {activePhase.items.length === 0 ? (
            <p className="px-3 py-6 text-sm text-slate-500">
              Aucun point de contrôle. Configurez-les dans les Référentiels.
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {activePhase.items.map((item) => {
                const expanded = expandedItems.has(item.id);
                const titleGreen = isWorkControlItemGreen(item.status);
                return (
                  <div key={item.id} className={statusBg(item.status)}>
                    <button
                      type="button"
                      onClick={() => toggleExpand(item.id)}
                      className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left hover:bg-black/[0.02]"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={`text-sm font-semibold ${
                              titleGreen ? "text-emerald-800" : "text-slate-900"
                            }`}
                          >
                            {expanded ? "▼" : "▶"} {item.label}
                          </span>
                          <StatusBadge status={item.status} />
                          {item.planTypeName && (
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600">
                              {item.planTypeName}
                            </span>
                          )}
                        </div>
                        {item.helpComment && (
                          <p className="mt-0.5 text-[11px] text-slate-500">
                            {item.helpComment}
                          </p>
                        )}
                        {!expanded && (
                          <p className="mt-1 text-[11px] text-slate-500">
                            {item.summary.conform} OK · {item.summary.nonConform}{" "}
                            NC · {item.summary.pending} en attente /{" "}
                            {item.summary.total} niveaux
                          </p>
                        )}
                      </div>
                    </button>

                    {expanded && (
                      <div className="overflow-x-auto border-t border-slate-100 bg-white/80 px-3 py-2">
                        {item.levels.length === 0 ? (
                          <p className="text-xs text-amber-700">
                            Aucun plan de type « {item.planTypeName ?? "?"} ».
                            Importez des plans dans Plan.
                          </p>
                        ) : (
                          <table className="w-full min-w-[640px] border-collapse text-xs">
                            <thead>
                              <tr className="text-left text-[11px] text-slate-500">
                                <th className="border border-slate-200 px-2 py-1">
                                  Plan / niveau
                                </th>
                                <th className="border border-slate-200 px-2 py-1">
                                  Date contrôle
                                </th>
                                <th className="border border-slate-200 px-2 py-1">
                                  Résultat
                                </th>
                                <th className="border border-slate-200 px-2 py-1">
                                  Entreprise
                                </th>
                                <th className="border border-slate-200 px-2 py-1">
                                  Attestation (PDF / rapport)
                                </th>
                                {canAdmin && (
                                  <th className="border border-slate-200 px-2 py-1">
                                    Dispensé
                                  </th>
                                )}
                              </tr>
                            </thead>
                            <tbody>
                              {item.levels.map((lv) => {
                                const ex = lv.execution;
                                const enterpriseName = ex?.enterprise_id
                                  ? data.enterprises.find(
                                      (e) => e.id === ex.enterprise_id
                                    )?.name ?? "—"
                                  : "—";
                                return (
                                  <tr
                                    key={lv.level.id}
                                    className={
                                      ex?.admin_waived || ex?.control_result === "ok"
                                        ? "bg-emerald-50/50"
                                        : ex?.control_result === "ko"
                                          ? "bg-red-50/50"
                                          : ex?.control_result === "deferred"
                                            ? "bg-blue-50/50"
                                            : ex?.control_result === "pending"
                                              ? "bg-amber-50/50"
                                              : ""
                                    }
                                  >
                                    <td className="border border-slate-200 px-2 py-1">
                                      <div className="font-medium">{lv.planName}</div>
                                      <div className="text-[11px] text-slate-500">
                                        {lv.level.name}
                                      </div>
                                    </td>
                                    <td className="border border-slate-200 px-2 py-1">
                                      {ex?.control_date ?? "—"}
                                    </td>
                                    <td className="border border-slate-200 px-2 py-1">
                                      {ex?.admin_waived
                                        ? "Dispensé"
                                        : ex?.control_result &&
                                            ex.control_result !== "pending"
                                          ? CONTROL_RESULT_LABELS[
                                              ex.control_result as keyof typeof CONTROL_RESULT_LABELS
                                            ]
                                          : "À contrôler"}
                                    </td>
                                    <td className="border border-slate-200 px-2 py-1">
                                      {enterpriseName}
                                    </td>
                                    <td className="border border-slate-200 px-2 py-1">
                                      <WorkControlAttestationCell
                                        projectId={projectId}
                                        checklistItemId={item.id}
                                        planLevelId={lv.level.id}
                                        execution={ex}
                                        visitId={ex?.visit_id ?? null}
                                        canAdmin={canAdmin}
                                        attestationUrl={publicAttestationUrl(
                                          ex?.report_path ?? null
                                        )}
                                      />
                                    </td>
                                    {canAdmin && (
                                      <td className="border border-slate-200 px-2 py-1 text-center">
                                        <input
                                          type="checkbox"
                                          checked={ex?.admin_waived ?? false}
                                          disabled={isPending}
                                          title="Pas besoin de contrôler ce niveau"
                                          onChange={(e) =>
                                            handleAdminUpdate(
                                              item.id,
                                              lv.level.id,
                                              { adminWaived: e.target.checked }
                                            )
                                          }
                                        />
                                      </td>
                                    )}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
        <strong>Légende :</strong> titre vert uniquement si <em>tous</em> les plans/niveaux
        sont conformes, dispensés ou NC levée en attestation (aucun « à contrôler »
        restant). Déposez un PDF (nom + date affichés) ou liez un rapport de visite.
        Depuis Outlook : onglet Attestations NC.
      </div>
    </div>
  );
}
