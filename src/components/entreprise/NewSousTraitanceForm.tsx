"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createSousTraitanceRequest } from "@/lib/actions/sous-traitance";
import type { Enterprise } from "@/lib/types/database";

type NewSousTraitanceFormProps = {
  projectId: string;
  projectName: string;
  enterprise: Pick<Enterprise, "id" | "name" | "lot_number">;
};

const inputClass =
  "w-full rounded-xl border-2 border-zinc-200 bg-white px-4 py-3 text-zinc-900 outline-none transition-colors focus:border-amber-400";

export function NewSousTraitanceForm({
  projectId,
  projectName,
  enterprise,
}: NewSousTraitanceFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [reference, setReference] = useState("");
  const [description, setDescription] = useState("");
  const [amountHt, setAmountHt] = useState("");
  const [deadline, setDeadline] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        await createSousTraitanceRequest(projectId, enterprise.id, {
          type: "demande_sous_traitance",
          title,
          description,
          deadline,
          amount_ht: amountHt,
          reference,
        });
        setSubmitted(true);
        setTimeout(() => {
          router.push(`/entreprise/projets/${projectId}/sous-traitance`);
        }, 1500);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur lors du dépôt.");
      }
    });
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-xl rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-emerald-100">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-100 text-2xl">
          ✓
        </div>
        <h2 className="text-xl font-bold text-zinc-900">Demande envoyée</h2>
        <p className="mt-2 text-zinc-500">
          Votre demande de sous-traitance a été enregistrée. Le maître
          d&apos;œuvre sera notifié.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-xl">
      <header className="mb-6">
        <Link
          href={`/entreprise/projets/${projectId}`}
          className="text-sm font-medium text-amber-600 hover:text-amber-700"
        >
          ← {projectName}
        </Link>
        <h1 className="mt-3 text-2xl font-bold text-zinc-900">
          Nouvelle demande de sous-traitance
        </h1>
        <p className="mt-2 text-zinc-500">
          Devis, variantes ou travaux supplémentaires à soumettre au
          maître d&apos;œuvre.
        </p>
        <p className="mt-3 text-sm font-medium text-amber-800">
          {enterprise.name}
          {enterprise.lot_number && ` — Lot ${enterprise.lot_number}`}
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-amber-50"
      >
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-zinc-700">
            Objet de la demande *
          </label>
          <input
            required
            className={inputClass}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Ex. Variante gaines techniques — R+2"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-zinc-700">
            Référence interne
          </label>
          <input
            className={inputClass}
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="Ex. ST-2026-015"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-zinc-700">
            Description *
          </label>
          <textarea
            required
            rows={4}
            className={inputClass}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Décrivez les travaux concernés, le contexte et les documents joints…"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-zinc-700">
              Montant proposé HT (€)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              className={inputClass}
              value={amountHt}
              onChange={(e) => setAmountHt(e.target.value)}
              placeholder="0"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-zinc-700">
              Date limite de réponse
            </label>
            <input
              type="date"
              className={inputClass}
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
            />
          </div>
        </div>

        <div className="rounded-xl border-2 border-dashed border-zinc-200 bg-zinc-50 px-4 py-6 text-center">
          <p className="text-sm font-medium text-zinc-600">
            Pièces jointes (devis, plans, photos)
          </p>
          <p className="mt-1 text-xs text-zinc-400">
            Upload de fichiers — à connecter au stockage SharePoint
          </p>
        </div>

        {error && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="submit"
            disabled={isPending}
            className="rounded-xl bg-amber-600 px-6 py-3 font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
          >
            {isPending ? "Envoi…" : "Déposer la demande"}
          </button>
          <Link
            href={`/entreprise/projets/${projectId}/sous-traitance`}
            className="rounded-xl px-6 py-3 font-semibold text-zinc-600 ring-1 ring-zinc-200 hover:bg-zinc-50"
          >
            Annuler
          </Link>
        </div>
      </form>
    </div>
  );
}
