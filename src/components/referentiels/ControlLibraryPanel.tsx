"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  deleteControlLibraryItem,
  importControlLibraryToAllProjects,
  saveControlLibraryItem,
} from "@/lib/actions/control-library";
import { AppFormField } from "@/components/ui/AppFormField";
import { useTrackedForm } from "@/hooks/useTrackedForm";
import type { ControlLibraryItem } from "@/lib/types/database";

const DEFAULT_PHASES = [
  "Gros œuvre",
  "Second œuvre",
  "Corps d'état techniques",
  "Livraison",
];

const PLAN_SUPPORTS = [
  "",
  "Plans architecte",
  "Plans béton",
  "Plans électricité (ELEX)",
  "Plans plomberie",
  "Autres plans",
];

function parsePresetComments(raw: string): string[] {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

type ControlLibraryPanelProps = {
  items: ControlLibraryItem[];
  canEdit: boolean;
};

export function ControlLibraryPanel({ items, canEdit }: ControlLibraryPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { values, saved, set, markSaved } = useTrackedForm({
    phase_name: DEFAULT_PHASES[0] ?? "Gros œuvre",
    zone_name: "",
    label: "",
    plan_support_name: "",
    help_comment: "",
    preset_comments: "",
  });

  function refresh() {
    router.refresh();
  }

  function startEdit(item: ControlLibraryItem) {
    setEditingId(item.id);
    markSaved({
      phase_name: item.phase_name,
      zone_name: item.zone_name,
      label: item.label,
      plan_support_name: item.plan_support_name,
      help_comment: item.help_comment,
      preset_comments: item.preset_comments.join("\n"),
    });
    set("phase_name", item.phase_name);
    set("zone_name", item.zone_name);
    set("label", item.label);
    set("plan_support_name", item.plan_support_name);
    set("help_comment", item.help_comment);
    set("preset_comments", item.preset_comments.join("\n"));
  }

  function cancelEdit() {
    setEditingId(null);
    markSaved({
      phase_name: DEFAULT_PHASES[0] ?? "Gros œuvre",
      zone_name: "",
      label: "",
      plan_support_name: "",
      help_comment: "",
      preset_comments: "",
    });
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        const existing = editingId ? items.find((i) => i.id === editingId) : null;
        await saveControlLibraryItem({
          id: editingId && editingId !== "new" ? editingId : undefined,
          phase_name: values.phase_name,
          zone_name: values.zone_name,
          label: values.label,
          plan_support_name: values.plan_support_name,
          help_comment: values.help_comment,
          preset_comments: parsePresetComments(values.preset_comments),
          sort_order: existing?.sort_order ?? items.length + 10,
        });
        cancelEdit();
        refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur.");
      }
    });
  }

  function remove(itemId: string) {
    if (!confirm("Supprimer ce point de la bibliothèque globale ?")) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteControlLibraryItem(itemId);
        refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur.");
      }
    });
  }

  function propagateAll() {
    if (
      !confirm(
        "Propager la bibliothèque à toutes les opérations ? Les points déjà liés seront mis à jour."
      )
    ) {
      return;
    }
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        const result = await importControlLibraryToAllProjects();
        setSuccess(
          `${result.imported} point(s) ajouté(s), ${result.updated} mis à jour sur ${result.projectCount} opération(s).`
        );
        refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur de propagation.");
      }
    });
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Points de contrôle ({items.length})
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Base commune à toutes les opérations — phases, zones, support plan, aide
            terrain et réponses types tablette.
          </p>
        </div>
        {canEdit && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={propagateAll}
              disabled={isPending || items.length === 0}
              className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-40"
            >
              Propager à toutes les opérations
            </button>
            {!editingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingId("new");
                  markSaved({
                    phase_name: DEFAULT_PHASES[0] ?? "Gros œuvre",
                    zone_name: "",
                    label: "",
                    plan_support_name: "",
                    help_comment: "",
                    preset_comments: "",
                  });
                }}
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500"
              >
                Nouveau point
              </button>
            )}
          </div>
        )}
      </header>

      {error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {success && (
        <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {success}
        </p>
      )}

      {(editingId === "new" || editingId) && canEdit && (
        <form
          onSubmit={save}
          className="mb-4 grid gap-3 rounded-xl border border-violet-100 bg-violet-50/40 p-4 sm:grid-cols-2"
        >
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Phase</span>
            <select
              value={values.phase_name}
              onChange={(e) => set("phase_name", e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              {DEFAULT_PHASES.map((phase) => (
                <option key={phase} value={phase}>
                  {phase}
                </option>
              ))}
            </select>
          </label>
          <AppFormField
            label="Zone"
            name="zone_name"
            value={values.zone_name}
            savedValue={saved.zone_name}
            onChange={(v) => set("zone_name", v)}
            required
          />
          <AppFormField
            label="Point de contrôle"
            name="label"
            value={values.label}
            savedValue={saved.label}
            onChange={(v) => set("label", v)}
            required
          />
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-700">Support plan</span>
            <select
              value={values.plan_support_name}
              onChange={(e) => set("plan_support_name", e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            >
              <option value="">— Aucun —</option>
              {PLAN_SUPPORTS.filter(Boolean).map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
          <AppFormField
            label="Commentaire d'aide (tablette)"
            name="help_comment"
            value={values.help_comment}
            savedValue={saved.help_comment}
            onChange={(v) => set("help_comment", v)}
          />
          <AppFormField
            label="Réponses types (une par ligne)"
            name="preset_comments"
            value={values.preset_comments}
            savedValue={saved.preset_comments}
            onChange={(v) => set("preset_comments", v)}
            multiline
            className="sm:col-span-2"
          />
          <div className="flex gap-2 sm:col-span-2">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white disabled:opacity-40"
            >
              Enregistrer
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
            >
              Annuler
            </button>
          </div>
        </form>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-xs font-semibold uppercase text-slate-500">
              <th className="px-2 py-2">Phase</th>
              <th className="px-2 py-2">Zone</th>
              <th className="px-2 py-2">Point</th>
              <th className="px-2 py-2">Support</th>
              {canEdit && <th className="px-2 py-2 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={canEdit ? 5 : 4} className="px-2 py-4 text-slate-500">
                  Aucun point — ajoutez la base commune ou importez depuis une opération
                  pilote.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="border-b border-slate-100">
                  <td className="px-2 py-2 text-slate-600">{item.phase_name}</td>
                  <td className="px-2 py-2 text-slate-600">{item.zone_name}</td>
                  <td className="px-2 py-2">
                    <div className="font-medium text-slate-900">{item.label}</div>
                    {item.help_comment && (
                      <div className="text-xs text-slate-500">{item.help_comment}</div>
                    )}
                  </td>
                  <td className="px-2 py-2 text-xs text-slate-500">
                    {item.plan_support_name || "—"}
                  </td>
                  {canEdit && (
                    <td className="px-2 py-2 text-right">
                      <div className="inline-flex gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(item)}
                          className="text-xs font-semibold text-violet-700 hover:underline"
                        >
                          Modifier
                        </button>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => remove(item.id)}
                          className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-40"
                        >
                          Supprimer
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
