"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { ModalPanel } from "@/components/ui/ModalPanel";
import { AppFormField } from "@/components/ui/AppFormField";
import {
  deleteControlLibraryItem,
  deleteControlLibraryPhase,
  importControlLibraryToAllProjects,
  renameControlLibraryPhase,
  saveControlLibraryItem,
} from "@/lib/actions/control-library";
import type { ControlLibraryItem } from "@/lib/types/database";
import { PLAN_SUPPORT_OPTIONS } from "@/lib/types/database";

const DEFAULT_PHASES = [
  "Gros œuvre",
  "Second œuvre",
  "Corps d'état techniques",
  "Livraison",
];

type RowDraft = {
  id?: string;
  label: string;
  help_comment: string;
  plan_support_name: string;
  preset_comments: string;
  sort_order: number;
};

type ControlLibraryPanelProps = {
  items: ControlLibraryItem[];
  canEdit: boolean;
};

function emptyRow(sortOrder: number): RowDraft {
  return {
    label: "",
    help_comment: "",
    plan_support_name: "",
    preset_comments: "",
    sort_order: sortOrder,
  };
}

export function ControlLibraryPanel({ items, canEdit }: ControlLibraryPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [activePhase, setActivePhase] = useState(DEFAULT_PHASES[0] ?? "Gros œuvre");
  const [newPhaseName, setNewPhaseName] = useState("");
  const [showRenameModal, setShowRenameModal] = useState(false);
  const [renameTargetPhase, setRenameTargetPhase] = useState<string>("");
  const [renameDraft, setRenameDraft] = useState<string>("");

  const phases = useMemo(() => {
    const names = new Set(DEFAULT_PHASES);
    for (const item of items) names.add(item.phase_name);
    return [...names];
  }, [items]);

  const phaseItems = useMemo(
    () =>
      items
        .filter((i) => i.phase_name === activePhase)
        .sort((a, b) => a.sort_order - b.sort_order || a.label.localeCompare(b.label, "fr")),
    [items, activePhase]
  );

  const [rows, setRows] = useState<RowDraft[]>([emptyRow(10)]);

  useEffect(() => {
    setRows([
      ...phaseItems.map((item) => ({
        id: item.id,
        label: item.label,
        help_comment: item.help_comment,
        plan_support_name: item.plan_support_name,
        preset_comments: (item.preset_comments ?? []).join("\n"),
        sort_order: item.sort_order,
      })),
      emptyRow((phaseItems.at(-1)?.sort_order ?? 0) + 10),
    ]);
  }, [phaseItems, activePhase]);

  function refresh() {
    router.refresh();
  }

  function updateRow(index: number, patch: Partial<RowDraft>) {
    setRows((prev) => prev.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function saveRow(index: number) {
    const row = rows[index];
    if (!row) return;

    if (!row.label.trim()) {
      if (row.id) {
        startTransition(async () => {
          try {
            await deleteControlLibraryItem(row.id!);
            refresh();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Erreur.");
          }
        });
      }
      return;
    }

    startTransition(async () => {
      try {
        setError(null);
        await saveControlLibraryItem({
          id: row.id,
          phase_name: activePhase,
          label: row.label,
          help_comment: row.help_comment,
          plan_support_name: row.plan_support_name,
          preset_comments: row.preset_comments
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
          sort_order: row.sort_order,
        });
        refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur.");
      }
    });
  }

  function addPhase() {
    const name = newPhaseName.trim();
    if (!name || phases.includes(name)) return;
    setActivePhase(name);
    setNewPhaseName("");
    setRows([emptyRow(10)]);
  }

  function renamePhase() {
    setRenameTargetPhase(activePhase);
    setRenameDraft(activePhase);
    setShowRenameModal(true);
  }

  function confirmRenamePhase() {
    const from = renameTargetPhase.trim();
    const next = renameDraft.trim();
    if (!from || !next || next === from) return;

    startTransition(async () => {
      try {
        setError(null);
        await renameControlLibraryPhase(from, next);
        setActivePhase(next);
        setShowRenameModal(false);
        refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur renommage.");
      }
    });
  }

  function removePhase() {
    const count = items.filter((i) => i.phase_name === activePhase).length;
    if (
      !confirm(
        count > 0
          ? `Supprimer la phase « ${activePhase} » et ses ${count} point(s) ?`
          : `Supprimer la phase « ${activePhase} » ?`
      )
    ) {
      return;
    }
    startTransition(async () => {
      try {
        setError(null);
        await deleteControlLibraryPhase(activePhase);
        const remaining = phases.filter((p) => p !== activePhase);
        setActivePhase(remaining[0] ?? DEFAULT_PHASES[0] ?? "Gros œuvre");
        refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur suppression.");
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
    <>
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <header className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">
            Points de contrôle ({items.length})
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Saisie rapide par phase — point de contrôle, commentaire d&apos;aide, support
            plan. Base commune à toutes les opérations.
          </p>
        </div>
        {canEdit && (
          <button
            type="button"
            onClick={propagateAll}
            disabled={isPending || items.length === 0}
            className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-40"
          >
            Propager à toutes les opérations
          </button>
        )}
      </header>

      {error && (
        <p className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      {success && (
        <p className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {success}
        </p>
      )}

      <div className="mb-4 flex flex-wrap items-center gap-2 border-b border-slate-100 pb-3">
        <div className="flex max-w-full gap-1 overflow-x-auto pb-1">
          {phases.map((phase) => (
            <button
              key={phase}
              type="button"
              onClick={() => setActivePhase(phase)}
              className={`shrink-0 rounded-lg px-3 py-2 text-sm font-semibold ${
                activePhase === phase
                  ? "bg-violet-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {phase}
              <span className="ml-1.5 text-xs opacity-75">
                ({items.filter((i) => i.phase_name === phase).length})
              </span>
            </button>
          ))}
        </div>
        {canEdit && (
          <div className="flex shrink-0 flex-wrap items-center gap-1">
            <input
              value={newPhaseName}
              onChange={(e) => setNewPhaseName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  addPhase();
                }
              }}
              placeholder="Nouvelle phase"
              className="w-36 rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
            />
            <button
              type="button"
              onClick={addPhase}
              disabled={!newPhaseName.trim()}
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm font-semibold text-slate-700 disabled:opacity-40"
            >
              +
            </button>
            <button
              type="button"
              onClick={renamePhase}
              disabled={isPending}
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-semibold text-slate-700 disabled:opacity-40"
            >
              Renommer
            </button>
            <button
              type="button"
              onClick={removePhase}
              disabled={isPending}
              className="rounded-lg border border-red-200 px-2 py-1.5 text-xs font-semibold text-red-700 disabled:opacity-40"
            >
              Supprimer
            </button>
          </div>
        )}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[40rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-semibold uppercase text-slate-500">
              <th className="px-2 py-2 w-[24%]">Point de contrôle</th>
              <th className="px-2 py-2 w-[22%]">Commentaire d&apos;aide</th>
              <th className="px-2 py-2 w-[26%]">Remarques NC préférées</th>
              <th className="px-2 py-2 w-[18%]">Support plan</th>
              {canEdit && <th className="px-2 py-2 w-[6%]" />}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={row.id ?? `new-${index}`} className="border-b border-slate-100">
                <td className="px-1 py-1">
                  <input
                    value={row.label}
                    disabled={!canEdit || isPending}
                    onChange={(e) => updateRow(index, { label: e.target.value })}
                    onBlur={() => saveRow(index)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        (e.target as HTMLInputElement).blur();
                      }
                    }}
                    placeholder="Nom du point"
                    className="w-full rounded border border-transparent bg-transparent px-2 py-1.5 hover:border-slate-200 focus:border-violet-300 focus:bg-white focus:outline-none disabled:opacity-60"
                  />
                </td>
                <td className="px-1 py-1">
                  <input
                    value={row.help_comment}
                    disabled={!canEdit || isPending}
                    onChange={(e) => updateRow(index, { help_comment: e.target.value })}
                    onBlur={() => row.label.trim() && saveRow(index)}
                    placeholder="Consigne pour le contrôle terrain"
                    className="w-full rounded border border-transparent bg-transparent px-2 py-1.5 hover:border-slate-200 focus:border-violet-300 focus:bg-white focus:outline-none disabled:opacity-60"
                  />
                </td>
                <td className="px-1 py-1">
                  <textarea
                    value={row.preset_comments}
                    disabled={!canEdit || isPending}
                    rows={2}
                    onChange={(e) =>
                      updateRow(index, { preset_comments: e.target.value })
                    }
                    onBlur={() => row.label.trim() && saveRow(index)}
                    placeholder={"Une remarque NC par ligne\nEx. : Manque joint\nEx. : Fixation insuffisante"}
                    title="Remarques types si non conforme (une par ligne)"
                    className="w-full resize-y rounded border border-transparent bg-transparent px-2 py-1.5 text-sm hover:border-slate-200 focus:border-violet-300 focus:bg-white focus:outline-none disabled:opacity-60"
                  />
                </td>
                <td className="px-1 py-1">
                  <select
                    value={row.plan_support_name}
                    disabled={!canEdit || isPending}
                    onChange={(e) => {
                      updateRow(index, { plan_support_name: e.target.value });
                      if (row.label.trim()) {
                        startTransition(async () => {
                          try {
                            await saveControlLibraryItem({
                              id: row.id,
                              phase_name: activePhase,
                              label: row.label,
                              help_comment: row.help_comment,
                              plan_support_name: e.target.value,
                              preset_comments: row.preset_comments
                                .split("\n")
                                .map((s) => s.trim())
                                .filter(Boolean),
                              sort_order: row.sort_order,
                            });
                            refresh();
                          } catch (err) {
                            setError(err instanceof Error ? err.message : "Erreur.");
                          }
                        });
                      }
                    }}
                    className="w-full rounded border border-transparent bg-transparent px-2 py-1.5 hover:border-slate-200 focus:border-violet-300 focus:bg-white focus:outline-none disabled:opacity-60"
                  >
                    <option value="">—</option>
                    {PLAN_SUPPORT_OPTIONS.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </td>
                {canEdit && (
                  <td className="px-1 py-1 text-center">
                    {row.id && (
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => {
                          if (!confirm("Supprimer ce point ?")) return;
                          startTransition(async () => {
                            try {
                              await deleteControlLibraryItem(row.id!);
                              refresh();
                            } catch (err) {
                              setError(err instanceof Error ? err.message : "Erreur.");
                            }
                          });
                        }}
                        className="text-xs font-semibold text-red-600 hover:underline disabled:opacity-40"
                      >
                        ×
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {canEdit && (
        <p className="mt-3 text-xs text-slate-500">
          Tabulation ou Entrée pour enregistrer une ligne. La dernière ligne vide ajoute
          automatiquement un nouveau point.{" "}
          <Link href="/pc/referentiels" className="text-violet-700 hover:underline">
            Référentiel
          </Link>
        </p>
      )}
      </section>

      {showRenameModal && (
        <ModalPanel
          title="Renommer la phase"
          subtitle="Le changement est propagé à tous les points de la bibliothèque."
          onClose={() => setShowRenameModal(false)}
          maxWidth="md"
        >
          <div className="space-y-4">
            <AppFormField
              label="Nouveau nom"
              value={renameDraft}
              onChange={setRenameDraft}
              placeholder="Ex. Gros œuvre"
              disabled={isPending}
            />
            {renameDraft.trim().length > 0 &&
              renameDraft.trim() === renameTargetPhase.trim() && (
                <p className="text-[11px] text-amber-700">
                  Le nouveau nom est identique : aucune modification.
                </p>
              )}
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowRenameModal(false)}
                disabled={isPending}
                className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-zinc-700 hover:bg-zinc-50 disabled:opacity-40"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={() => confirmRenamePhase()}
                disabled={isPending}
                className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-500 disabled:opacity-40"
              >
                Confirmer
              </button>
            </div>
          </div>
        </ModalPanel>
      )}
    </>
  );
}
