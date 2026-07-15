"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import {
  updateProjectFinancialInfo,
  uploadOperationPhoto,
} from "@/lib/actions/finance";
import { AppFormField } from "@/components/ui/AppFormField";
import { useTrackedForm } from "@/hooks/useTrackedForm";
import type { Project } from "@/lib/types/database";

type FinancialProjectInfoProps = {
  project: Project;
  photoUrl?: string | null;
};

export function FinancialProjectInfo({
  project,
  photoUrl,
}: FinancialProjectInfoProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const { values, saved, set, markSaved, isDirty } = useTrackedForm({
    client_name: project.client_name ?? "",
    typology: project.typology ?? "",
    client_address: project.client_address ?? "",
    default_payment_terms: project.default_payment_terms ?? "30 JOURS",
  });

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!e.currentTarget.checkValidity()) {
      e.currentTarget.reportValidity();
      return;
    }

    startTransition(async () => {
      try {
        await updateProjectFinancialInfo(project.id, {
          typology: values.typology.trim() || undefined,
          client_name: values.client_name.trim() || undefined,
          client_address: values.client_address.trim() || undefined,
          default_payment_terms: values.default_payment_terms.trim() || undefined,
        });
        markSaved();
        setSuccess("Informations enregistrées.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Une erreur est survenue.");
      }
    });
  }

  function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);

    startTransition(async () => {
      try {
        await uploadOperationPhoto(project.id, formData);
        setSuccess("Photo de l'opération mise à jour.");
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
      {isDirty && (
        <p className="mb-4 text-sm font-medium text-violet-700">
          Modifications non enregistrées — texte en violet.
        </p>
      )}

      <div className="mb-6 grid gap-6 lg:grid-cols-[200px_1fr]">
        <div>
          <p className="mb-2 text-sm font-semibold text-slate-700">
            Photo de l&apos;opération
          </p>
          <div className="flex h-40 w-full items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-slate-50">
            {photoUrl ? (
              <Image
                src={photoUrl}
                alt="Photo opération"
                width={200}
                height={160}
                className="h-full w-full object-cover"
              />
            ) : (
              <span className="text-xs text-slate-400">Aucune photo</span>
            )}
          </div>
          <label className="mt-2 inline-block cursor-pointer text-sm font-medium text-violet-700 hover:text-violet-800">
            Changer la photo
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoUpload}
            />
          </label>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <AppFormField
              label="Maître d'ouvrage"
              value={values.client_name}
              savedValue={saved.client_name}
              onChange={(v) => set("client_name", v)}
            />
            <AppFormField
              label="Typologie"
              value={values.typology}
              savedValue={saved.typology}
              onChange={(v) => set("typology", v)}
            />
            <AppFormField
              label="Adresse maître d'ouvrage"
              className="sm:col-span-2"
              value={values.client_address}
              savedValue={saved.client_address}
              onChange={(v) => set("client_address", v)}
            />
            <AppFormField
              label="Conditions de règlement par défaut"
              value={values.default_payment_terms}
              savedValue={saved.default_payment_terms}
              onChange={(v) => set("default_payment_terms", v)}
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
      </div>
    </section>
  );
}
