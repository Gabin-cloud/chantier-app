"use client";

import { useState, useTransition } from "react";
import type { ProjectFormData } from "@/lib/types/database";

type ProjectFormProps = {
  action: (formData: ProjectFormData) => Promise<void>;
  submitLabel: string;
  initialData?: ProjectFormData;
};

const inputClass =
  "w-full rounded-xl border-2 border-zinc-200 bg-zinc-50 px-4 py-3 text-base text-zinc-800 placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white focus:outline-none";

export function ProjectForm({ action, submitLabel, initialData }: ProjectFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = new FormData(e.currentTarget);
    const data: ProjectFormData = {
      name: (form.get("name") as string).trim(),
      address: (form.get("address") as string).trim() || undefined,
      city: (form.get("city") as string).trim() || undefined,
      postal_code: (form.get("postal_code") as string).trim() || undefined,
      description: (form.get("description") as string).trim() || undefined,
    };

    if (!data.name) {
      setError("Le nom du projet est obligatoire.");
      return;
    }

    startTransition(async () => {
      try {
        await action(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Une erreur est survenue.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="name" className="mb-2 block font-semibold text-zinc-800">
          Nom du projet *
        </label>
        <input
          id="name"
          name="name"
          required
          defaultValue={initialData?.name}
          placeholder="Ex : Rénovation immeuble rue des Lilas"
          className={inputClass}
        />
      </div>

      <div>
        <label htmlFor="address" className="mb-2 block font-semibold text-zinc-800">
          Adresse du chantier
        </label>
        <input
          id="address"
          name="address"
          defaultValue={initialData?.address}
          placeholder="12 rue des Lilas"
          className={inputClass}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="postal_code" className="mb-2 block font-semibold text-zinc-800">
            Code postal
          </label>
          <input
            id="postal_code"
            name="postal_code"
            defaultValue={initialData?.postal_code}
            placeholder="75011"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="city" className="mb-2 block font-semibold text-zinc-800">
            Ville
          </label>
          <input
            id="city"
            name="city"
            defaultValue={initialData?.city}
            placeholder="Paris"
            className={inputClass}
          />
        </div>
      </div>

      <div>
        <label htmlFor="description" className="mb-2 block font-semibold text-zinc-800">
          Description
        </label>
        <textarea
          id="description"
          name="description"
          rows={3}
          defaultValue={initialData?.description}
          placeholder="Informations complémentaires sur le chantier…"
          className={`${inputClass} resize-none`}
        />
      </div>

      {error && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="w-full min-h-14 rounded-2xl bg-zinc-900 px-6 py-4 text-lg font-bold text-white transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:bg-zinc-400"
      >
        {isPending ? "Enregistrement…" : submitLabel}
      </button>
    </form>
  );
}
