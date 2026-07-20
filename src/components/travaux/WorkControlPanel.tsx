"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AppFormField } from "@/components/ui/AppFormField";
import {
  addPlanLevel,
  deleteWorkControlItem,
  updateWorkControlExecution,
  upsertWorkControlItem,
} from "@/lib/actions/work-control";
import { addVisitPhase } from "@/lib/actions/phases";
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
  canEdit: boolean;
  canAdmin: boolean;
  initialEnterpriseId?: string;
};

function statusBg(status: WorkControlItemView["status"]): string {
  if (isWorkControlItemGreen(status)) return "bg-emerald-50";
  if (status === "non_conform_open") return "bg-red-50";
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
  canEdit,
  canAdmin,
  initialEnterpriseId,
}: WorkControlPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [activePhaseId, setActivePhaseId] = useState(
    data.phases[0]?.phase.id ?? ""
  );
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [selectedEnterpriseId, setSelectedEnterpriseId] = useState(
    initialEnterpriseId ?? data.enterprises[0]?.id ?? ""
  );
  const [showAdminForm, setShowAdminForm] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [formLabel, setFormLabel] = useState("");
  const [formPlanTypeId, setFormPlanTypeId] = useState("");
  const [formHelp, setFormHelp] = useState("");
  const [formPresets, setFormPresets] = useState("");
  const [newPhaseName, setNewPhaseName] = useState("");
  const [newLevelName, setNewLevelName] = useState("");
  const [addLevelForPlan, setAddLevelForPlan] = useState<string | null>(null);

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

  function resetForm() {
    setEditingItemId(null);
    setFormLabel("");
    setFormPlanTypeId("");
    setFormHelp("");
    setFormPresets("");
    setShowAdminForm(false);
  }

  function openEditItem(item: WorkControlItemView) {
    setEditingItemId(item.id);
    setFormLabel(item.label);
    setFormPlanTypeId(item.planTypeId ?? "");
    setFormHelp(item.helpComment);
    setFormPresets(item.presetComments.join("\n"));
    setShowAdminForm(true);
  }

  function handleSaveItem(e: React.FormEvent) {
    e.preventDefault();
    if (!activePhaseId || !formLabel.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await upsertWorkControlItem(projectId, {
          phaseId: activePhaseId,
          itemId: editingItemId ?? undefined,
          label: formLabel,
          planTypeId: formPlanTypeId || null,
          helpComment: formHelp,
          presetComments: formPresets
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
        });
        resetForm();
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur.");
      }
    });
  }

  function handleDeleteItem(itemId: string) {
    if (!confirm("Supprimer ce point de contrôle ?")) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteWorkControlItem(projectId, itemId);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur.");
      }
    });
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

  function handleExecutionUpdate(
    checklistItemId: string,
    planLevelId: string,
    patch: Parameters<typeof updateWorkControlExecution>[1] extends infer _T
      ? Omit<Parameters<typeof updateWorkControlExecution>[1], "checklistItemId" | "planLevelId">
      : never
  ) {
    setError(null);
    startTransition(async () => {
      try {
        await updateWorkControlExecution(projectId, {
          checklistItemId,
          planLevelId,
          enterpriseId: selectedEnterpriseId || null,
          ...patch,
        });
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur.");
      }
    });
  }

  function handleAddLevel(planId: string) {
    if (!newLevelName.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        await addPlanLevel(projectId, planId, newLevelName);
        setNewLevelName("");
        setAddLevelForPlan(null);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur.");
      }
    });
  }

  return (
    <div className="space-y-4">
      {error && (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-end gap-3 rounded-lg border border-slate-200 bg-white px-3 py-3">
        <label className="text-xs font-medium text-slate-600">
          Entreprise (lot) pour les saisies
          <select
            value={selectedEnterpriseId}
            onChange={(e) => setSelectedEnterpriseId(e.target.value)}
            className="mt-1 block w-56 rounded border border-slate-200 px-2 py-1.5 text-sm"
          >
            {data.enterprises.map((e) => (
              <option key={e.id} value={e.id}>
                {e.lot_number ? `Lot ${e.lot_number} — ` : ""}
                {e.name}
              </option>
            ))}
          </select>
        </label>

        {canAdmin && (
          <form onSubmit={handleAddPhase} className="flex items-end gap-2">
            <AppFormField
              label="Nouvelle phase"
              name="phase_name"
              value={newPhaseName}
              onChange={setNewPhaseName}
              placeholder="Ex. Gros œuvre"
            />
            <button
              type="submit"
              disabled={isPending}
              className="rounded bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white"
            >
              Ajouter phase
            </button>
          </form>
        )}
      </div>

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
          <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
            <div>
              <h3 className="text-sm font-semibold text-slate-900">
                {activePhase.phase.name}
              </h3>
              <p className="text-[11px] text-slate-500">
                {activePhase.summary.conform} conforme(s) ·{" "}
                {activePhase.summary.nonConform} non conforme(s) ·{" "}
                {activePhase.summary.pending} en attente
              </p>
            </div>
            {canAdmin && (
              <button
                type="button"
                onClick={() => {
                  resetForm();
                  setShowAdminForm(true);
                }}
                className="rounded bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white"
              >
                + Point de contrôle
              </button>
            )}
          </header>

          {showAdminForm && canAdmin && (
            <form
              onSubmit={handleSaveItem}
              className="grid gap-3 border-b border-slate-100 bg-slate-50 px-3 py-3 md:grid-cols-2"
            >
              <AppFormField
                label="Nom du contrôle"
                name="control_label"
                value={formLabel}
                onChange={setFormLabel}
                required
              />
              <label className="text-xs font-medium text-slate-600">
                Support (type de plan)
                <select
                  value={formPlanTypeId}
                  onChange={(e) => setFormPlanTypeId(e.target.value)}
                  className="mt-1 block w-full rounded border border-slate-200 px-2 py-1.5 text-sm"
                >
                  <option value="">— Non défini —</option>
                  {data.planTypes.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
              </label>
              <AppFormField
                label="Commentaire d'aide"
                name="help_comment"
                value={formHelp}
                onChange={setFormHelp}
                rows={2}
                className="md:col-span-2"
              />
              <AppFormField
                label="Réponses types tablette (une par ligne)"
                name="preset_comments"
                value={formPresets}
                onChange={setFormPresets}
                rows={3}
                className="md:col-span-2"
              />
              <div className="flex gap-2 md:col-span-2">
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded bg-emerald-700 px-3 py-1.5 text-xs font-semibold text-white"
                >
                  {editingItemId ? "Enregistrer" : "Créer"}
                </button>
                <button
                  type="button"
                  onClick={resetForm}
                  className="rounded border border-slate-200 px-3 py-1.5 text-xs"
                >
                  Annuler
                </button>
              </div>
            </form>
          )}

          {activePhase.items.length === 0 ? (
            <p className="px-3 py-6 text-sm text-slate-500">
              Aucun point de contrôle pour cette phase.
              {canAdmin && " Ajoutez-en via le bouton ci-dessus."}
            </p>
          ) : (
            <div className="divide-y divide-slate-100">
              {activePhase.items.map((item) => {
                const expanded = expandedItems.has(item.id);
                return (
                  <div key={item.id} className={statusBg(item.status)}>
                    <button
                      type="button"
                      onClick={() => toggleExpand(item.id)}
                      className="flex w-full items-start justify-between gap-3 px-3 py-2 text-left hover:bg-black/[0.02]"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-slate-900">
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
                      {canAdmin && (
                        <span className="flex shrink-0 gap-1">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openEditItem(item);
                            }}
                            className="text-[11px] text-slate-500 hover:text-slate-800"
                          >
                            Modifier
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteItem(item.id);
                            }}
                            className="text-[11px] text-red-600"
                          >
                            Suppr.
                          </button>
                        </span>
                      )}
                    </button>

                    {expanded && (
                      <div className="overflow-x-auto border-t border-slate-100 bg-white/80 px-3 py-2">
                        {item.levels.length === 0 ? (
                          <p className="text-xs text-amber-700">
                            Aucun plan de type « {item.planTypeName ?? "?"} ».
                            Importez des plans dans Rapport &amp; plan.
                          </p>
                        ) : (
                          <table className="w-full min-w-[720px] border-collapse text-xs">
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
                                  Rapport
                                </th>
                                <th className="border border-slate-200 px-2 py-1">
                                  Date retour
                                </th>
                                <th className="border border-slate-200 px-2 py-1">
                                  En attestation
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
                                return (
                                  <tr
                                    key={lv.level.id}
                                    className={
                                      ex?.admin_waived || ex?.control_result === "ok"
                                        ? "bg-emerald-50/50"
                                        : ex?.control_result === "ko" ||
                                            ex?.control_result === "partial"
                                          ? "bg-red-50/50"
                                          : ""
                                    }
                                  >
                                    <td className="border border-slate-200 px-2 py-1">
                                      <div className="font-medium">{lv.planName}</div>
                                      <div className="text-[11px] text-slate-500">
                                        {lv.level.name}
                                      </div>
                                      {canEdit && addLevelForPlan === lv.planId && (
                                        <div className="mt-1 flex gap-1">
                                          <input
                                            value={newLevelName}
                                            onChange={(e) =>
                                              setNewLevelName(e.target.value)
                                            }
                                            placeholder="Ex. RDC A"
                                            className="w-24 rounded border px-1 py-0.5 text-[11px]"
                                          />
                                          <button
                                            type="button"
                                            onClick={() => handleAddLevel(lv.planId)}
                                            className="text-[10px] text-emerald-700"
                                          >
                                            OK
                                          </button>
                                        </div>
                                      )}
                                      {canEdit && addLevelForPlan !== lv.planId && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            setAddLevelForPlan(lv.planId);
                                            setNewLevelName("");
                                          }}
                                          className="mt-0.5 text-[10px] text-slate-400 hover:text-slate-600"
                                        >
                                          + Diviser le plan
                                        </button>
                                      )}
                                    </td>
                                    <td className="border border-slate-200 px-2 py-1">
                                      {canEdit ? (
                                        <input
                                          type="date"
                                          value={ex?.control_date ?? ""}
                                          onChange={(e) =>
                                            handleExecutionUpdate(
                                              item.id,
                                              lv.level.id,
                                              {
                                                controlDate: e.target.value || null,
                                                controlResult:
                                                  ex?.control_result ?? "pending",
                                              }
                                            )
                                          }
                                          className="w-full rounded border px-1 py-0.5"
                                        />
                                      ) : (
                                        (ex?.control_date ?? "—")
                                      )}
                                    </td>
                                    <td className="border border-slate-200 px-2 py-1">
                                      {canEdit && !ex?.admin_waived ? (
                                        <select
                                          value={ex?.control_result ?? "pending"}
                                          onChange={(e) =>
                                            handleExecutionUpdate(
                                              item.id,
                                              lv.level.id,
                                              {
                                                controlResult: e.target
                                                  .value as "pending" | "ok" | "ko" | "partial",
                                                controlDate:
                                                  ex?.control_date ??
                                                  new Date().toISOString().slice(0, 10),
                                              }
                                            )
                                          }
                                          className="w-full rounded border px-1 py-0.5"
                                        >
                                          <option value="pending">À contrôler</option>
                                          {(Object.keys(CONTROL_RESULT_LABELS) as Array<
                                            keyof typeof CONTROL_RESULT_LABELS
                                          >).map((k) => (
                                            <option key={k} value={k}>
                                              {CONTROL_RESULT_LABELS[k]}
                                            </option>
                                          ))}
                                        </select>
                                      ) : ex?.admin_waived ? (
                                        "Dispensé"
                                      ) : (
                                        (ex?.control_result &&
                                          CONTROL_RESULT_LABELS[
                                            ex.control_result as keyof typeof CONTROL_RESULT_LABELS
                                          ]) ??
                                        "—"
                                      )}
                                    </td>
                                    <td className="border border-slate-200 px-2 py-1">
                                      {ex?.report_path ? (
                                        <a
                                          href={ex.report_path}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="text-emerald-700 hover:underline"
                                        >
                                          PDF
                                        </a>
                                      ) : (
                                        "—"
                                      )}
                                    </td>
                                    <td className="border border-slate-200 px-2 py-1">
                                      {canEdit ? (
                                        <input
                                          type="date"
                                          value={ex?.attestation_date ?? ""}
                                          onChange={(e) =>
                                            handleExecutionUpdate(
                                              item.id,
                                              lv.level.id,
                                              {
                                                attestationDate:
                                                  e.target.value || null,
                                              }
                                            )
                                          }
                                          className="w-full rounded border px-1 py-0.5"
                                        />
                                      ) : (
                                        (ex?.attestation_date ?? "—")
                                      )}
                                    </td>
                                    <td className="border border-slate-200 px-2 py-1 text-center">
                                      {canEdit ? (
                                        <input
                                          type="checkbox"
                                          checked={ex?.in_attestation ?? false}
                                          onChange={(e) =>
                                            handleExecutionUpdate(
                                              item.id,
                                              lv.level.id,
                                              { inAttestation: e.target.checked }
                                            )
                                          }
                                        />
                                      ) : ex?.in_attestation ? (
                                        "Oui"
                                      ) : (
                                        "Non"
                                      )}
                                    </td>
                                    {canAdmin && (
                                      <td className="border border-slate-200 px-2 py-1 text-center">
                                        <input
                                          type="checkbox"
                                          checked={ex?.admin_waived ?? false}
                                          title="Pas besoin de contrôler ce niveau"
                                          onChange={(e) =>
                                            handleExecutionUpdate(
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
                        {item.presetComments.length > 0 && canEdit && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            <span className="text-[10px] text-slate-500">
                              Réponses types :
                            </span>
                            {item.presetComments.map((c) => (
                              <span
                                key={c}
                                className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px]"
                              >
                                {c}
                              </span>
                            ))}
                          </div>
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
        <strong>Légende :</strong> vert = conforme, dispensé par l&apos;admin, ou non-conformité
        levée en attestation entreprise. Rouge = non-conformité en attente de retour.
      </div>
    </div>
  );
}
