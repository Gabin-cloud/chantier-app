"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  deleteAdminPieceTemplate,
  saveAdminPieceTemplate,
} from "@/lib/actions/admin-pieces";
import { AppFormField } from "@/components/ui/AppFormField";
import { useTrackedForm } from "@/hooks/useTrackedForm";
import type { AdminPieceTemplate } from "@/lib/types/admin-pieces";

type AdminPieceTemplatesPanelProps = {
  templates: AdminPieceTemplate[];
  canEdit: boolean;
};

export function AdminPieceTemplatesPanel({
  templates,
  canEdit,
}: AdminPieceTemplatesPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

  const { values, saved, set, markSaved } = useTrackedForm({
    name: "",
    control_notes: "",
  });

  function refresh() {
    router.refresh();
  }

  function startEdit(template: AdminPieceTemplate) {
    setEditingId(template.id);
    markSaved({
      name: template.name,
      control_notes: template.control_notes,
    });
    set("name", template.name);
    set("control_notes", template.control_notes);
  }

  function cancelEdit() {
    setEditingId(null);
    markSaved({ name: "", control_notes: "" });
  }

  function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        const template = editingId
          ? templates.find((t) => t.id === editingId)
          : null;
        await saveAdminPieceTemplate({
          id: editingId ?? undefined,
          name: values.name,
          control_notes: values.control_notes,
          sort_order: template?.sort_order ?? templates.length + 10,
        });
        cancelEdit();
        refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur.");
      }
    });
  }

  function remove(templateId: string) {
    if (!confirm("Supprimer cette pièce du référentiel ?")) return;
    setError(null);
    startTransition(async () => {
      try {
        await deleteAdminPieceTemplate(templateId);
        refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur.");
      }
    });
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Pièces administratives ({templates.length})
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Catalogue réutilisable — sélectionnable dans chaque opération.
          </p>
        </div>
        {canEdit && !editingId && (
          <button
            type="button"
            onClick={() => {
              setEditingId("new");
              markSaved({ name: "", control_notes: "" });
            }}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500"
          >
            Nouvelle pièce
          </button>
        )}
      </header>

      {error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {(editingId === "new" || editingId) && canEdit && (
        <form
          onSubmit={save}
          className="mb-4 grid gap-3 rounded-xl border border-violet-100 bg-violet-50/40 p-4 sm:grid-cols-2"
        >
          <AppFormField
            label="Nom de la pièce"
            name="name"
            value={values.name}
            savedValue={saved.name}
            onChange={(v) => set("name", v)}
            required
          />
          <AppFormField
            label="Commentaire d'aide au contrôle"
            name="control_notes"
            value={values.control_notes}
            savedValue={saved.control_notes}
            onChange={(v) => set("control_notes", v)}
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
              <th className="px-2 py-2">Nom</th>
              <th className="px-2 py-2">Aide au contrôle</th>
              <th className="px-2 py-2">Type</th>
              {canEdit && <th className="px-2 py-2 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {templates.map((t) => (
              <tr key={t.id} className="border-b border-slate-100">
                <td className="px-2 py-2 font-medium text-slate-900">{t.name}</td>
                <td className="px-2 py-2 text-slate-600">{t.control_notes || "—"}</td>
                <td className="px-2 py-2 text-xs text-slate-500">
                  {t.is_system ? "Système (OS/AE)" : "Référentiel"}
                </td>
                {canEdit && (
                  <td className="px-2 py-2 text-right">
                    {!t.is_system && (
                      <div className="inline-flex gap-2">
                        <button
                          type="button"
                          onClick={() => startEdit(t)}
                          className="text-xs font-semibold text-violet-700 hover:underline"
                        >
                          Modifier
                        </button>
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => remove(t.id)}
                          className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-40"
                        >
                          Supprimer
                        </button>
                      </div>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
