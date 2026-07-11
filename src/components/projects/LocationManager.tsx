"use client";

import { useState, useTransition } from "react";
import {
  addPresetLocation,
  deletePresetLocation,
} from "@/lib/actions/locations";
import type { ProjectLocation } from "@/lib/types/database";

type LocationManagerProps = {
  projectId: string;
  locations: ProjectLocation[];
  canEdit: boolean;
};

const inputClass =
  "w-full rounded-xl border-2 border-zinc-200 bg-zinc-50 px-4 py-3 text-base text-zinc-800 placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white focus:outline-none";

export function LocationManager({
  projectId,
  locations,
  canEdit,
}: LocationManagerProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const presets = locations.filter((l) => l.is_preset);

  function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const name = (new FormData(e.currentTarget).get("location_name") as string).trim();
    if (!name) {
      setError("Le nom est obligatoire.");
      return;
    }

    startTransition(async () => {
      try {
        await addPresetLocation(projectId, name);
        setSuccess("Localisation ajoutée.");
        e.currentTarget.reset();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur.");
      }
    });
  }

  function handleDelete(locationId: string) {
    if (!confirm("Supprimer cette localisation ?")) return;

    startTransition(async () => {
      try {
        await deletePresetLocation(projectId, locationId);
        setSuccess("Localisation supprimée.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur.");
      }
    });
  }

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="text-lg font-bold text-zinc-900">Localisations</h2>
      <p className="mt-1 text-sm text-zinc-500">
        Liste proposée lors des visites (pièces, zones, niveaux…).
      </p>

      {presets.length === 0 ? (
        <p className="mt-4 text-sm text-zinc-500">Aucune localisation définie.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {presets.map((location) => (
            <li
              key={location.id}
              className="flex items-center justify-between rounded-xl bg-zinc-50 px-4 py-3"
            >
              <span className="font-medium text-zinc-900">{location.name}</span>
              {canEdit && (
                <button
                  type="button"
                  onClick={() => handleDelete(location.id)}
                  disabled={isPending}
                  className="text-sm font-medium text-red-600"
                >
                  Supprimer
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canEdit && (
        <form onSubmit={handleAdd} className="mt-4 space-y-3 border-t border-zinc-100 pt-4">
          <input
            name="location_name"
            placeholder="Ex. Salon, Cuisine, RDC…"
            className={inputClass}
          />
          <button
            type="submit"
            disabled={isPending}
            className="min-h-11 w-full rounded-xl bg-zinc-900 py-2.5 text-sm font-bold text-white disabled:opacity-50"
          >
            {isPending ? "Ajout…" : "Ajouter une localisation"}
          </button>
        </form>
      )}

      {error && (
        <p className="mt-3 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}
      {success && (
        <p className="mt-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {success}
        </p>
      )}
    </section>
  );
}
