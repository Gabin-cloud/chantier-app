"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { createVisit } from "@/lib/actions/visits";

export function CreateVisitForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const today = new Date().toISOString().slice(0, 10);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = new FormData(e.currentTarget);

    startTransition(async () => {
      try {
        const visitId = await createVisit(projectId, {
          title: (form.get("title") as string).trim() || undefined,
          visit_date: (form.get("visit_date") as string) || today,
          notes: (form.get("notes") as string).trim() || undefined,
        });
        router.push(`/tablette/projets/${projectId}/visites/${visitId}`);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Impossible de créer la visite.");
      }
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="title" className="mb-2 block font-semibold text-zinc-800">
          Titre de la visite
        </label>
        <input
          id="title"
          name="title"
          placeholder={`Visite du ${new Date().toLocaleDateString("fr-FR")}`}
          className="w-full rounded-xl border-2 border-zinc-200 bg-zinc-50 px-4 py-3 text-base focus:border-zinc-400 focus:bg-white focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="visit_date" className="mb-2 block font-semibold text-zinc-800">
          Date
        </label>
        <input
          id="visit_date"
          name="visit_date"
          type="date"
          defaultValue={today}
          required
          className="w-full rounded-xl border-2 border-zinc-200 bg-zinc-50 px-4 py-3 text-base focus:border-zinc-400 focus:bg-white focus:outline-none"
        />
      </div>

      <div>
        <label htmlFor="notes" className="mb-2 block font-semibold text-zinc-800">
          Notes (optionnel)
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          placeholder="Contexte de la visite…"
          className="w-full resize-none rounded-xl border-2 border-zinc-200 bg-zinc-50 px-4 py-3 text-base focus:border-zinc-400 focus:bg-white focus:outline-none"
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
        className="min-h-14 w-full rounded-2xl bg-emerald-600 py-4 text-lg font-bold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-300"
      >
        {isPending ? "Création…" : "Démarrer la visite"}
      </button>
    </form>
  );
}
