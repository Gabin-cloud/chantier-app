"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { deletePlan, uploadPlan } from "@/lib/actions/plans";
import type { Plan } from "@/lib/types/database";

type PlanWithUrl = Plan & { public_url: string };

type PlanManagerProps = {
  projectId: string;
  initialPlans: PlanWithUrl[];
};

export function PlanManager({ projectId, initialPlans }: PlanManagerProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [planName, setPlanName] = useState("");

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setError(null);
    setSuccess(null);

    const formData = new FormData();
    formData.append("file", file);
    if (planName.trim()) formData.append("name", planName.trim());

    startTransition(async () => {
      try {
        await uploadPlan(projectId, formData);
        setPlanName("");
        if (fileInputRef.current) fileInputRef.current.value = "";
        setSuccess("Plan importé avec succès.");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur lors de l'import.");
      }
    });
  }

  function handleDelete(planId: string) {
    if (!confirm("Supprimer ce plan PDF ?")) return;

    setError(null);
    setSuccess(null);

    startTransition(async () => {
      try {
        await deletePlan(projectId, planId);
        setSuccess("Plan supprimé.");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur lors de la suppression.");
      }
    });
  }

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="mb-1 text-lg font-semibold text-zinc-900">Plans PDF</h2>
      <p className="mb-4 text-sm text-zinc-500">
        Importez les plans du chantier. Ils seront utilisés lors des visites pour
        placer des pastilles et des remarques.
      </p>

      {initialPlans.length === 0 ? (
        <p className="mb-4 rounded-xl bg-zinc-50 px-4 py-3 text-sm text-zinc-500">
          Aucun plan importé. Ajoutez un PDF pour commencer.
        </p>
      ) : (
        <ul className="mb-4 space-y-3">
          {initialPlans.map((plan) => (
            <li
              key={plan.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-semibold text-zinc-900">{plan.name}</p>
                {plan.file_size && (
                  <p className="text-sm text-zinc-500">
                    {(plan.file_size / 1024 / 1024).toFixed(1)} Mo
                  </p>
                )}
              </div>
              <div className="flex shrink-0 gap-2">
                <a
                  href={plan.public_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg px-3 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100"
                >
                  Voir
                </a>
                <button
                  type="button"
                  onClick={() => handleDelete(plan.id)}
                  disabled={isPending}
                  className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  Supprimer
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="space-y-3 border-t border-zinc-100 pt-4">
        <h3 className="font-semibold text-zinc-800">Importer un plan PDF</h3>
        <input
          type="text"
          value={planName}
          onChange={(e) => setPlanName(e.target.value)}
          placeholder="Nom du plan (optionnel, ex : RDC, Étage 1…)"
          className="w-full rounded-xl border-2 border-zinc-200 bg-zinc-50 px-4 py-3 text-base text-zinc-800 placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white focus:outline-none"
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,.pdf"
          onChange={handleUpload}
          disabled={isPending}
          className="w-full rounded-xl border-2 border-dashed border-zinc-300 bg-zinc-50 px-4 py-4 text-sm text-zinc-600 file:mr-4 file:rounded-lg file:border-0 file:bg-zinc-900 file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-zinc-800"
        />
        {isPending && (
          <p className="text-sm text-zinc-500">Import en cours…</p>
        )}
      </div>

      {error && (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
      {success && (
        <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          {success}
        </p>
      )}
    </section>
  );
}
