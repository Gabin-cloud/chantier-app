"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  addCustomProjectAdminPiece,
  addProjectAdminPieceFromTemplate,
  removeProjectAdminPiece,
  updateProjectAdminPiece,
} from "@/lib/actions/admin-pieces";
import { AppFormField } from "@/components/ui/AppFormField";
import { useTrackedForm } from "@/hooks/useTrackedForm";
import type { AdminPieceTemplate, ProjectAdminPiece } from "@/lib/types/admin-pieces";

type ProjectAdminPiecesConfigProps = {
  projectId: string;
  pieces: ProjectAdminPiece[];
  templates: AdminPieceTemplate[];
  canEdit: boolean;
};

export function ProjectAdminPiecesConfig({
  projectId,
  pieces,
  templates,
  canEdit,
}: ProjectAdminPiecesConfigProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");

  const availableTemplates = templates.filter(
    (t) =>
      !t.is_system &&
      !pieces.some((p) => p.template_id === t.id)
  );

  const { values, saved, set, markSaved } = useTrackedForm({
    custom_name: "",
    custom_notes: "",
  });

  function refresh() {
    router.refresh();
  }

  function addFromTemplate() {
    if (!selectedTemplateId) return;
    setError(null);
    startTransition(async () => {
      try {
        await addProjectAdminPieceFromTemplate(projectId, selectedTemplateId);
        setSelectedTemplateId("");
        refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur.");
      }
    });
  }

  function addCustom(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await addCustomProjectAdminPiece(projectId, {
          name: values.custom_name,
          control_notes: values.custom_notes,
        });
        markSaved({ custom_name: "", custom_notes: "" });
        refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur.");
      }
    });
  }

  function savePiece(piece: ProjectAdminPiece, name: string, notes: string) {
    setError(null);
    startTransition(async () => {
      try {
        await updateProjectAdminPiece(projectId, piece.id, {
          name,
          control_notes: notes,
        });
        refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur.");
      }
    });
  }

  function removePiece(pieceId: string) {
    if (!confirm("Retirer cette pièce de l'opération ?")) return;
    setError(null);
    startTransition(async () => {
      try {
        await removeProjectAdminPiece(projectId, pieceId);
        refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur.");
      }
    });
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <header className="mb-4">
        <h2 className="text-sm font-semibold text-slate-900">
          Pièces administratives requises
        </h2>
        <p className="mt-1 text-xs text-slate-500">
          OS et acte d&apos;engagement sont toujours présents. Ajoutez les autres
          pièces depuis le référentiel ou créez-en une spécifique à cette
          opération.
        </p>
      </header>

      {error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="space-y-3">
        {pieces.map((piece) => (
          <PieceRow
            key={piece.id}
            piece={piece}
            canEdit={canEdit}
            isPending={isPending}
            onSave={savePiece}
            onRemove={removePiece}
          />
        ))}
      </div>

      {canEdit && (
        <div className="mt-4 space-y-4 border-t border-slate-100 pt-4">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[240px] flex-1">
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Ajouter depuis le référentiel
              </label>
              <select
                value={selectedTemplateId}
                onChange={(e) => setSelectedTemplateId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">Choisir une pièce…</option>
                {availableTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              disabled={isPending || !selectedTemplateId}
              onClick={addFromTemplate}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-40"
            >
              Ajouter
            </button>
          </div>

          <form onSubmit={addCustom} className="grid gap-3 sm:grid-cols-2">
            <AppFormField
              label="Pièce spécifique — nom"
              name="custom_name"
              value={values.custom_name}
              savedValue={saved.custom_name}
              onChange={(v) => set("custom_name", v)}
              required
            />
            <AppFormField
              label="Aide au contrôle"
              name="custom_notes"
              value={values.custom_notes}
              savedValue={saved.custom_notes}
              onChange={(v) => set("custom_notes", v)}
            />
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={isPending || !values.custom_name.trim()}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
              >
                Ajouter une pièce personnalisée
              </button>
            </div>
          </form>
        </div>
      )}
    </section>
  );
}

function PieceRow({
  piece,
  canEdit,
  isPending,
  onSave,
  onRemove,
}: {
  piece: ProjectAdminPiece;
  canEdit: boolean;
  isPending: boolean;
  onSave: (piece: ProjectAdminPiece, name: string, notes: string) => void;
  onRemove: (pieceId: string) => void;
}) {
  const [name, setName] = useState(piece.name);
  const [notes, setNotes] = useState(piece.control_notes);
  const isSystem = piece.is_os || piece.is_ae;

  return (
    <div className="rounded-lg border border-slate-100 bg-slate-50/80 p-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase text-slate-500">
            Nom {isSystem && "(système)"}
          </label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={!canEdit || isSystem}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-100"
          />
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-semibold uppercase text-slate-500">
            Aide au contrôle
          </label>
          <input
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={!canEdit}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm disabled:bg-slate-100"
          />
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <button
              type="button"
              disabled={
                isPending ||
                (name === piece.name && notes === piece.control_notes)
              }
              onClick={() => onSave(piece, name, notes)}
              className="rounded-lg bg-slate-800 px-3 py-2 text-xs font-semibold text-white disabled:opacity-40"
            >
              Enregistrer
            </button>
            {!isSystem && (
              <button
                type="button"
                disabled={isPending}
                onClick={() => onRemove(piece.id)}
                className="rounded-lg border border-red-200 px-3 py-2 text-xs font-semibold text-red-700 hover:bg-red-50"
              >
                Retirer
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
