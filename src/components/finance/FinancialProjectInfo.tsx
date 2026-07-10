"use client";

import { useState, useTransition } from "react";
import { updateProjectFinancialInfo } from "@/lib/actions/finance";
import type { Project } from "@/lib/types/database";

const inputClass =
  "w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-800 placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none";

type FinancialProjectInfoProps = {
  project: Project;
};

export function FinancialProjectInfo({ project }: FinancialProjectInfoProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const form = new FormData(e.currentTarget);

    startTransition(async () => {
      try {
        await updateProjectFinancialInfo(project.id, {
          typology: (form.get("typology") as string).trim() || undefined,
          client_name: (form.get("client_name") as string).trim() || undefined,
          client_address: (form.get("client_address") as string).trim() || undefined,
          default_payment_terms:
            (form.get("default_payment_terms") as string).trim() || undefined,
        });
        setSuccess("Informations enregistrées.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Une erreur est survenue.");
      }
    });
  }

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="mb-1 text-lg font-semibold text-slate-900">
        Informations opération (BDD)
      </h2>
      <p className="mb-4 text-sm text-slate-500">
        Données générales du chantier pour le suivi financier.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Maître d&apos;ouvrage
          </label>
          <input
            name="client_name"
            defaultValue={project.client_name ?? ""}
            className={inputClass}
            placeholder="SCCV LA VIE DE CHÂTEAU"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Adresse maître d&apos;ouvrage
          </label>
          <input
            name="client_address"
            defaultValue={project.client_address ?? ""}
            className={inputClass}
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Typologie
          </label>
          <input
            name="typology"
            defaultValue={project.typology ?? ""}
            className={inputClass}
            placeholder="Construction de logements collectifs"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Conditions de règlement par défaut
          </label>
          <input
            name="default_payment_terms"
            defaultValue={project.default_payment_terms ?? "30 JOURS"}
            className={inputClass}
          />
        </div>

        {error && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}
        {success && (
          <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {success}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="rounded-xl bg-slate-800 px-5 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
        >
          {isPending ? "Enregistrement…" : "Enregistrer"}
        </button>
      </form>
    </section>
  );
}
