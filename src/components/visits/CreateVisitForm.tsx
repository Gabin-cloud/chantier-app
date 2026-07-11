"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { createVisit } from "@/lib/actions/visits";
import type { PhaseChecklistItem, PhaseZone, VisitPhase } from "@/lib/types/database";

export function CreateVisitForm({
  projectId,
  phases,
  zones,
  checklistItems,
}: {
  projectId: string;
  phases: VisitPhase[];
  zones: PhaseZone[];
  checklistItems: PhaseChecklistItem[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [phaseId, setPhaseId] = useState(phases[0]?.id ?? "");
  const [zoneId, setZoneId] = useState("");
  const [checklistItemId, setChecklistItemId] = useState("");

  const today = new Date().toISOString().slice(0, 10);

  const phaseZones = useMemo(
    () => zones.filter((z) => z.phase_id === phaseId),
    [zones, phaseId]
  );

  const zoneControls = useMemo(() => {
    if (!zoneId) return [];
    return checklistItems.filter(
      (i) => i.phase_id === phaseId && i.zone_id === zoneId
    );
  }, [checklistItems, phaseId, zoneId]);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = new FormData(e.currentTarget);

    if (phaseZones.length > 0 && !zoneId) {
      setError("Choisissez la zone de chantier pour cette visite.");
      return;
    }

    startTransition(async () => {
      try {
        const visitId = await createVisit(projectId, {
          title: (form.get("title") as string).trim() || undefined,
          visit_date: (form.get("visit_date") as string) || today,
          notes: (form.get("notes") as string).trim() || undefined,
          phase_id: phaseId || undefined,
          zone_id: zoneId || undefined,
          checklist_item_id: checklistItemId || undefined,
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
        <label htmlFor="phase_id" className="mb-2 block font-semibold text-zinc-800">
          Phase de chantier *
        </label>
        <select
          id="phase_id"
          name="phase_id"
          required
          value={phaseId}
          onChange={(e) => {
            setPhaseId(e.target.value);
            setZoneId("");
            setChecklistItemId("");
          }}
          className="w-full rounded-xl border-2 border-zinc-200 bg-zinc-50 px-4 py-3 text-base focus:border-zinc-400 focus:bg-white focus:outline-none"
        >
          {phases.map((phase) => (
            <option key={phase.id} value={phase.id}>
              {phase.name}
            </option>
          ))}
        </select>
      </div>

      {phaseZones.length > 0 && (
        <div>
          <label htmlFor="zone_id" className="mb-2 block font-semibold text-zinc-800">
            Zone de chantier *
          </label>
          <select
            id="zone_id"
            name="zone_id"
            required
            value={zoneId}
            onChange={(e) => {
              setZoneId(e.target.value);
              setChecklistItemId("");
            }}
            className="w-full rounded-xl border-2 border-zinc-200 bg-zinc-50 px-4 py-3 text-base focus:border-zinc-400 focus:bg-white focus:outline-none"
          >
            <option value="">— Choisir une zone —</option>
            {phaseZones.map((zone) => (
              <option key={zone.id} value={zone.id}>
                {zone.name}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-zinc-500">
            Indiquez où vous allez travailler sur le plan.
          </p>
        </div>
      )}

      {zoneId && zoneControls.length > 0 && (
        <div>
          <label htmlFor="checklist_item_id" className="mb-2 block font-semibold text-zinc-800">
            Point de contrôle
          </label>
          <select
            id="checklist_item_id"
            name="checklist_item_id"
            value={checklistItemId}
            onChange={(e) => setChecklistItemId(e.target.value)}
            className="w-full rounded-xl border-2 border-zinc-200 bg-zinc-50 px-4 py-3 text-base focus:border-zinc-400 focus:bg-white focus:outline-none"
          >
            <option value="">— Tous les contrôles de la zone —</option>
            {zoneControls.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          <p className="mt-1 text-xs text-zinc-500">
            Optionnel : cible un contrôle précis. Les pastilles seront pré-remplies.
          </p>
        </div>
      )}

      {phaseZones.length === 0 && phaseId && (
        <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-800">
          Aucune zone définie pour cette phase. Configurez-les dans les paramètres du projet,
          ou importez la bibliothèque de contrôles.
        </p>
      )}

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
        disabled={isPending || phases.length === 0}
        className="min-h-14 w-full rounded-2xl bg-emerald-600 py-4 text-lg font-bold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-300"
      >
        {isPending ? "Création…" : "Démarrer la visite"}
      </button>
    </form>
  );
}
