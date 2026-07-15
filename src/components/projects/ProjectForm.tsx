"use client";

import { useState, useTransition } from "react";
import { AppFormField } from "@/components/ui/AppFormField";
import { useTrackedForm } from "@/hooks/useTrackedForm";
import type { ProjectFormData } from "@/lib/types/database";

type ProjectFormProps = {
  action: (formData: ProjectFormData) => Promise<void>;
  submitLabel: string;
  initialData?: ProjectFormData;
};

export function ProjectForm({ action, submitLabel, initialData }: ProjectFormProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const formId = "project-form";

  const { values, saved, set, markSaved } = useTrackedForm({
    name: initialData?.name ?? "",
    address: initialData?.address ?? "",
    postal_code: initialData?.postal_code ?? "",
    city: initialData?.city ?? "",
    description: initialData?.description ?? "",
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!e.currentTarget.checkValidity()) {
      e.currentTarget.reportValidity();
      return;
    }

    const data: ProjectFormData = {
      name: values.name.trim(),
      address: values.address.trim() || undefined,
      city: values.city.trim() || undefined,
      postal_code: values.postal_code.trim() || undefined,
      description: values.description.trim() || undefined,
    };

    if (!data.name) {
      setError("Le nom du projet est obligatoire.");
      return;
    }

    startTransition(async () => {
      try {
        await action(data);
        markSaved(values);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Une erreur est survenue.");
      }
    });
  }

  return (
    <form id={formId} onSubmit={handleSubmit} className="space-y-5">
      <AppFormField
        label="Nom du projet"
        id={`${formId}-name`}
        value={values.name}
        savedValue={saved.name}
        onChange={(v) => set("name", v)}
        required
        placeholder="Ex : Rénovation immeuble rue des Lilas"
      />

      <AppFormField
        label="Adresse du chantier"
        id={`${formId}-address`}
        value={values.address}
        savedValue={saved.address}
        onChange={(v) => set("address", v)}
        placeholder="12 rue des Lilas"
      />

      <div className="grid grid-cols-2 gap-3">
        <AppFormField
          label="Code postal"
          id={`${formId}-postal`}
          format="postal"
          value={values.postal_code}
          savedValue={saved.postal_code}
          onChange={(v) => set("postal_code", v)}
          placeholder="75011"
        />
        <AppFormField
          label="Ville"
          id={`${formId}-city`}
          value={values.city}
          savedValue={saved.city}
          onChange={(v) => set("city", v)}
          placeholder="Paris"
        />
      </div>

      <AppFormField
        label="Description"
        id={`${formId}-description`}
        multiline
        rows={3}
        value={values.description}
        savedValue={saved.description}
        onChange={(v) => set("description", v)}
        placeholder="Informations complémentaires sur le chantier…"
      />

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
