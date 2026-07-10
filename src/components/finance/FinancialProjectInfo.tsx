"use client";

import Image from "next/image";
import { useState, useTransition } from "react";
import {
  updateProjectFinancialInfo,
  uploadOperationPhoto,
} from "@/lib/actions/finance";
import { FormField, financeInputClass } from "@/components/finance/FormField";
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
          <label className="mt-2 inline-block cursor-pointer text-sm font-medium text-blue-600 hover:text-blue-700">
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
            <FormField label="Maître d'ouvrage">
              <input
                name="client_name"
                defaultValue={project.client_name ?? ""}
                className={financeInputClass}
              />
            </FormField>
            <FormField label="Typologie">
              <input
                name="typology"
                defaultValue={project.typology ?? ""}
                className={financeInputClass}
              />
            </FormField>
            <FormField label="Adresse maître d'ouvrage" className="sm:col-span-2">
              <input
                name="client_address"
                defaultValue={project.client_address ?? ""}
                className={financeInputClass}
              />
            </FormField>
            <FormField label="Conditions de règlement par défaut">
              <input
                name="default_payment_terms"
                defaultValue={project.default_payment_terms ?? "30 JOURS"}
                className={financeInputClass}
              />
            </FormField>
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
