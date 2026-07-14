"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createSousTraitanceRequest } from "@/lib/actions/sous-traitance";
import type { Enterprise } from "@/lib/types/database";

type WorkSelectionFormProps = {
  projectId: string;
  projectName: string;
  enterprise: Pick<Enterprise, "id" | "name" | "lot_number">;
};

const inputClass =
  "w-full rounded-xl border-2 border-zinc-200 bg-white px-4 py-3 text-zinc-900 outline-none transition-colors focus:border-orange-400";

const DEMO_OPTIONS = [
  {
    id: "opt-a",
    label: "Gamme standard",
    description: "Robinetterie chromée, radiateur sèche-serviette 500W",
    price: "Inclus marché",
  },
  {
    id: "opt-b",
    label: "Gamme confort",
    description: "Robinetterie noir mat, radiateur design 750W",
    price: "+ 120 € HT / logement",
  },
  {
    id: "opt-c",
    label: "Gamme premium",
    description: "Robinetterie or brossé, radiateur sèche-serviette connecté",
    price: "+ 280 € HT / logement",
  },
];

export function WorkSelectionForm({
  projectId,
  projectName,
  enterprise,
}: WorkSelectionFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedOption, setSelectedOption] = useState("");
  const [comments, setComments] = useState("");
  const [zone, setZone] = useState("Salles de bain — tous logements");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedOption) return;

    const option = DEMO_OPTIONS.find((o) => o.id === selectedOption);
    startTransition(async () => {
      try {
        await createSousTraitanceRequest(projectId, enterprise.id, {
          type: "choix_travaux",
          title: `Choix ${option?.label ?? ""} — ${zone}`,
          description: [
            option?.description,
            comments ? `Commentaires : ${comments}` : null,
          ]
            .filter(Boolean)
            .join("\n"),
          deadline: "",
          amount_ht: "",
          reference: `CHOIX-${Date.now().toString(36).toUpperCase()}`,
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
        <h2 className="text-xl font-bold text-zinc-900">Choix enregistré</h2>
        <p className="mt-2 text-zinc-500">
          Votre sélection de travaux a été transmise au maître d&apos;œuvre.
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
        <h1 className="mt-3 text-2xl font-bold text-zinc-900">Choix de travaux</h1>
        <p className="mt-2 text-zinc-500">
          Sélectionnez les options proposées par le maître d&apos;œuvre pour ce
          chantier.
        </p>
        <p className="mt-3 text-sm font-medium text-orange-800">
          {enterprise.name}
          {enterprise.lot_number && ` — Lot ${enterprise.lot_number}`}
        </p>
      </header>

      <form
        onSubmit={handleSubmit}
        className="space-y-5 rounded-2xl bg-white p-6 shadow-sm ring-1 ring-orange-50"
      >
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-zinc-700">
            Zone / lotissement concerné
          </label>
          <input
            className={inputClass}
            value={zone}
            onChange={(e) => setZone(e.target.value)}
          />
        </div>

        <div>
          <p className="mb-3 text-sm font-semibold text-zinc-700">
            Options disponibles *
          </p>
          <div className="space-y-3">
            {DEMO_OPTIONS.map((option) => (
              <label
                key={option.id}
                className={`block cursor-pointer rounded-xl border-2 p-4 transition-colors ${
                  selectedOption === option.id
                    ? "border-orange-500 bg-orange-50"
                    : "border-zinc-200 hover:border-orange-200"
                }`}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="radio"
                    name="option"
                    value={option.id}
                    checked={selectedOption === option.id}
                    onChange={() => setSelectedOption(option.id)}
                    className="mt-1"
                  />
                  <div>
                    <p className="font-semibold text-zinc-900">{option.label}</p>
                    <p className="mt-1 text-sm text-zinc-500">
                      {option.description}
                    </p>
                    <p className="mt-2 text-sm font-medium text-orange-700">
                      {option.price}
                    </p>
                  </div>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-semibold text-zinc-700">
            Commentaires complémentaires
          </label>
          <textarea
            rows={3}
            className={inputClass}
            value={comments}
            onChange={(e) => setComments(e.target.value)}
            placeholder="Précisions, réserves, demandes particulières…"
          />
        </div>

        {error && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </p>
        )}

        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="submit"
            disabled={isPending || !selectedOption}
            className="rounded-xl bg-orange-600 px-6 py-3 font-semibold text-white hover:bg-orange-500 disabled:opacity-50"
          >
            {isPending ? "Envoi…" : "Valider mon choix"}
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
