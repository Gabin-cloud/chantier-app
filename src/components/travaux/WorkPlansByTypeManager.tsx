"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { AppFormField } from "@/components/ui/AppFormField";
import {
  addWorkControlPlanType,
  addPlanLevel,
  setPlanType,
} from "@/lib/actions/work-control";
import { uploadPlan, deletePlan } from "@/lib/actions/plans";
import type { WorkControlPlanType, WorkPlanWithLevels } from "@/lib/types/work-control";

type WorkPlansByTypeManagerProps = {
  projectId: string;
  planTypes: WorkControlPlanType[];
  plans: WorkPlanWithLevels[];
  canEdit: boolean;
  canAdmin: boolean;
};

export function WorkPlansByTypeManager({
  projectId,
  planTypes,
  plans,
  canEdit,
  canAdmin,
}: WorkPlansByTypeManagerProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activeTypeId, setActiveTypeId] = useState(
    planTypes[0]?.id ?? "all"
  );
  const [planName, setPlanName] = useState("");
  const [newTypeName, setNewTypeName] = useState("");
  const [newLevelName, setNewLevelName] = useState("");
  const [addLevelFor, setAddLevelFor] = useState<string | null>(null);

  const filteredPlans =
    activeTypeId === "all"
      ? plans
      : plans.filter((p) => p.plan_type_id === activeTypeId);

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || activeTypeId === "all") return;

    setError(null);
    setSuccess(null);
    const formData = new FormData();
    formData.append("file", file);
    if (planName.trim()) formData.append("name", planName.trim());

    startTransition(async () => {
      try {
        const plan = await uploadPlan(projectId, formData, null);
        await setPlanType(projectId, plan.id, activeTypeId);
        setPlanName("");
        if (fileInputRef.current) fileInputRef.current.value = "";
        setSuccess("Plan importé.");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur.");
      }
    });
  }

  function handleDelete(planId: string) {
    if (!confirm("Supprimer ce plan ?")) return;
    setError(null);
    startTransition(async () => {
      try {
        await deletePlan(projectId, planId);
        setSuccess("Plan supprimé.");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur.");
      }
    });
  }

  function handleAddType(e: React.FormEvent) {
    e.preventDefault();
    if (!newTypeName.trim()) return;
    setError(null);
    startTransition(async () => {
      try {
        const type = await addWorkControlPlanType(projectId, newTypeName);
        setNewTypeName("");
        setActiveTypeId(type.id);
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
        setAddLevelFor(null);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur.");
      }
    });
  }

  return (
    <section className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
      <header>
        <h2 className="text-sm font-semibold text-slate-900">
          Plans par type de support
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          Organisez les plans par discipline pour alimenter les points de contrôle.
        </p>
      </header>

      {error && (
        <p className="rounded border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-700">
          {error}
        </p>
      )}
      {success && (
        <p className="rounded border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-700">
          {success}
        </p>
      )}

      <div className="flex flex-wrap gap-1 border-b border-slate-100 pb-2">
        <button
          type="button"
          onClick={() => setActiveTypeId("all")}
          className={`rounded px-2.5 py-1 text-xs font-medium ${
            activeTypeId === "all"
              ? "bg-slate-800 text-white"
              : "bg-slate-100 text-slate-600"
          }`}
        >
          Tous
        </button>
        {planTypes.map((type) => (
          <button
            key={type.id}
            type="button"
            onClick={() => setActiveTypeId(type.id)}
            className={`rounded px-2.5 py-1 text-xs font-medium ${
              activeTypeId === type.id
                ? "bg-emerald-700 text-white"
                : "bg-slate-100 text-slate-600"
            }`}
          >
            {type.name}
          </button>
        ))}
      </div>

      {canAdmin && (
        <form onSubmit={handleAddType} className="flex flex-wrap items-end gap-2">
          <AppFormField
            label="Nouvel onglet / type de plan"
            name="plan_type_name"
            value={newTypeName}
            onChange={setNewTypeName}
            placeholder="Ex. Plans CVC"
          />
          <button
            type="submit"
            disabled={isPending}
            className="rounded bg-slate-700 px-3 py-1.5 text-xs font-semibold text-white"
          >
            Créer l&apos;onglet
          </button>
        </form>
      )}

      {canEdit && activeTypeId !== "all" && (
        <div className="flex flex-wrap items-end gap-3 rounded bg-slate-50 px-3 py-2">
          <AppFormField
            label="Nom du plan (optionnel)"
            name="plan_name"
            value={planName}
            onChange={setPlanName}
          />
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              onChange={handleUpload}
              className="text-xs"
            />
          </div>
        </div>
      )}

      {filteredPlans.length === 0 ? (
        <p className="text-sm text-slate-500">
          Aucun plan dans cette catégorie.
          {canEdit && activeTypeId !== "all" && " Importez un PDF ci-dessus."}
        </p>
      ) : (
        <ul className="divide-y divide-slate-100">
          {filteredPlans.map((plan) => {
            const typeName =
              planTypes.find((t) => t.id === plan.plan_type_id)?.name ??
              "Non classé";
            return (
              <li key={plan.id} className="py-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-slate-900">{plan.name}</p>
                    <p className="text-[11px] text-slate-500">{typeName}</p>
                  </div>
                  <div className="flex gap-2">
                    <a
                      href={plan.pdf_url}
                      target="_blank"
                      rel="noreferrer"
                      className="text-xs text-emerald-700 hover:underline"
                    >
                      Ouvrir PDF
                    </a>
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => handleDelete(plan.id)}
                        className="text-xs text-red-600"
                      >
                        Supprimer
                      </button>
                    )}
                  </div>
                </div>
                <div className="mt-2">
                  <p className="text-[10px] font-semibold uppercase text-slate-400">
                    Niveaux / zones
                  </p>
                  <ul className="mt-1 flex flex-wrap gap-1">
                    {plan.levels.map((level) => (
                      <li
                        key={level.id}
                        className="rounded bg-slate-100 px-2 py-0.5 text-[11px]"
                      >
                        {level.name}
                      </li>
                    ))}
                    {canEdit &&
                      (addLevelFor === plan.id ? (
                        <li className="flex items-center gap-1">
                          <input
                            value={newLevelName}
                            onChange={(e) => setNewLevelName(e.target.value)}
                            placeholder="Ex. RDC B"
                            className="w-24 rounded border px-1 py-0.5 text-[11px]"
                          />
                          <button
                            type="button"
                            onClick={() => handleAddLevel(plan.id)}
                            className="text-[10px] text-emerald-700"
                          >
                            OK
                          </button>
                        </li>
                      ) : (
                        <li>
                          <button
                            type="button"
                            onClick={() => {
                              setAddLevelFor(plan.id);
                              setNewLevelName("");
                            }}
                            className="text-[11px] text-slate-400 hover:text-slate-600"
                          >
                            + Diviser
                          </button>
                        </li>
                      ))}
                  </ul>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
