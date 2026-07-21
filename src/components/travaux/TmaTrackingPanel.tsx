"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { NewTmaModal } from "@/components/travaux/NewTmaModal";
import { updateTmaField, deleteTmaEntry } from "@/lib/actions/tma";
import { formatCurrency } from "@/lib/finance/calculations";
import type { Enterprise, WorkTmaEntry } from "@/lib/types/database";

type TmaTrackingPanelProps = {
  projectId: string;
  entries: WorkTmaEntry[];
  enterprises: Enterprise[];
};

const BORDER = "border border-slate-300";

function formatDate(value: string | null): string {
  if (!value) return "";
  return new Date(value).toLocaleDateString("fr-FR");
}

function EditableDate({
  projectId,
  entryId,
  field,
  value,
}: {
  projectId: string;
  entryId: string;
  field: "modif_demandee_le" | "devis_recu_le" | "mou_envoi" | "mou_acceptation";
  value: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <input
      type="date"
      defaultValue={value ?? ""}
      disabled={isPending}
      onBlur={(e) => {
        startTransition(async () => {
          await updateTmaField(projectId, entryId, field, e.target.value || null);
          router.refresh();
        });
      }}
      className="w-full min-w-[7rem] border-0 bg-transparent px-1 py-0.5 text-xs focus:bg-yellow-50 focus:outline-none"
      title={formatDate(value) || "Saisir une date"}
    />
  );
}

function EditableText({
  projectId,
  entryId,
  field,
  value,
  className,
}: {
  projectId: string;
  entryId: string;
  field:
    | "logement_number"
    | "localisation"
    | "nature_travaux"
    | "enterprise_name"
    | "devis_number";
  value: string;
  className?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <input
      type="text"
      defaultValue={value}
      disabled={isPending}
      onBlur={(e) => {
        const next = e.target.value.trim();
        if (next === value) return;
        startTransition(async () => {
          await updateTmaField(projectId, entryId, field, next);
          router.refresh();
        });
      }}
      className={className ?? "w-full border-0 bg-transparent px-1 py-0.5 text-xs focus:bg-yellow-50 focus:outline-none"}
    />
  );
}

function EditableMoney({
  projectId,
  entryId,
  value,
}: {
  projectId: string;
  entryId: string;
  value: number;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <input
      type="text"
      defaultValue={value ? String(value) : ""}
      disabled={isPending}
      onBlur={(e) => {
        const parsed =
          parseFloat(e.target.value.replace(/\s/g, "").replace(",", ".")) || 0;
        if (parsed === value) return;
        startTransition(async () => {
          await updateTmaField(projectId, entryId, "montant_ht", parsed);
          router.refresh();
        });
      }}
      className="w-full border-0 bg-transparent px-1 py-0.5 text-right text-xs tabular-nums focus:bg-yellow-50 focus:outline-none"
      title={formatCurrency(value)}
    />
  );
}

export function TmaTrackingPanel({
  projectId,
  entries,
  enterprises,
}: TmaTrackingPanelProps) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleDelete(entryId: string) {
    if (!confirm("Supprimer cette ligne TMA ?")) return;
    startTransition(async () => {
      await deleteTmaEntry(projectId, entryId);
      router.refresh();
    });
  }

  return (
    <>
      <section className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-slate-900">
              Travaux modificatifs acquéreurs (TMA)
            </h2>
            <p className="mt-0.5 text-xs text-slate-500">
              Suivi des modifications demandées par les acquéreurs.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setModalOpen(true)}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
          >
            Nouvelle TMA
          </button>
        </header>

        {entries.length === 0 ? (
          <p className="px-4 py-8 text-sm text-slate-500">
            Aucune TMA enregistrée. Cliquez sur « Nouvelle TMA » pour commencer.
          </p>
        ) : (
          <table className={`w-full min-w-[1200px] border-collapse text-xs ${BORDER}`}>
            <thead>
              <tr className="bg-slate-50">
                <th className={`${BORDER} px-2 py-2 text-left font-bold`}>Logt n°</th>
                <th className={`${BORDER} px-2 py-2 text-left font-bold`}>Localisation</th>
                <th className={`${BORDER} px-2 py-2 text-left font-bold`}>Modif demandée le</th>
                <th className={`${BORDER} min-w-[12rem] px-2 py-2 text-left font-bold`}>
                  Nature des travaux modificatifs
                </th>
                <th className={`${BORDER} px-2 py-2 text-left font-bold`}>
                  Entreprise concernée
                </th>
                <th className={`${BORDER} px-2 py-2 text-center font-bold`} colSpan={2}>
                  Entreprise
                </th>
                <th className={`${BORDER} px-2 py-2 text-center font-bold`} colSpan={2}>
                  MOU devis
                </th>
                <th className={`${BORDER} px-2 py-2 text-right font-bold`}>Montant H.T.</th>
                <th className={`${BORDER} w-8 px-1 py-2`} />
              </tr>
              <tr className="bg-slate-50 text-[10px] text-slate-600">
                <th className={BORDER} colSpan={5} />
                <th className={`${BORDER} px-2 py-1 font-semibold`}>N° devis</th>
                <th className={`${BORDER} px-2 py-1 font-semibold`}>reçu le</th>
                <th className={`${BORDER} px-2 py-1 font-semibold`}>Envoi</th>
                <th className={`${BORDER} px-2 py-1 font-semibold`}>Acceptat.</th>
                <th className={BORDER} colSpan={2} />
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-slate-50/50">
                  <td className={`${BORDER} px-1 py-1`}>
                    <EditableText
                      projectId={projectId}
                      entryId={entry.id}
                      field="logement_number"
                      value={entry.logement_number}
                    />
                  </td>
                  <td className={`${BORDER} px-1 py-1`}>
                    <EditableText
                      projectId={projectId}
                      entryId={entry.id}
                      field="localisation"
                      value={entry.localisation}
                    />
                  </td>
                  <td className={`${BORDER} px-1 py-1`}>
                    <EditableDate
                      projectId={projectId}
                      entryId={entry.id}
                      field="modif_demandee_le"
                      value={entry.modif_demandee_le}
                    />
                  </td>
                  <td className={`${BORDER} px-1 py-1`}>
                    <EditableText
                      projectId={projectId}
                      entryId={entry.id}
                      field="nature_travaux"
                      value={entry.nature_travaux}
                    />
                  </td>
                  <td className={`${BORDER} px-1 py-1`}>
                    <EditableText
                      projectId={projectId}
                      entryId={entry.id}
                      field="enterprise_name"
                      value={entry.enterprise_name}
                    />
                  </td>
                  <td className={`${BORDER} px-1 py-1`}>
                    <EditableText
                      projectId={projectId}
                      entryId={entry.id}
                      field="devis_number"
                      value={entry.devis_number}
                    />
                  </td>
                  <td className={`${BORDER} px-1 py-1`}>
                    <EditableDate
                      projectId={projectId}
                      entryId={entry.id}
                      field="devis_recu_le"
                      value={entry.devis_recu_le}
                    />
                  </td>
                  <td className={`${BORDER} px-1 py-1`}>
                    <EditableDate
                      projectId={projectId}
                      entryId={entry.id}
                      field="mou_envoi"
                      value={entry.mou_envoi}
                    />
                  </td>
                  <td className={`${BORDER} px-1 py-1`}>
                    <EditableDate
                      projectId={projectId}
                      entryId={entry.id}
                      field="mou_acceptation"
                      value={entry.mou_acceptation}
                    />
                  </td>
                  <td className={`${BORDER} px-1 py-1 text-right`}>
                    <EditableMoney
                      projectId={projectId}
                      entryId={entry.id}
                      value={entry.montant_ht}
                    />
                  </td>
                  <td className={`${BORDER} px-1 py-1 text-center`}>
                    <button
                      type="button"
                      onClick={() => handleDelete(entry.id)}
                      disabled={isPending}
                      title="Supprimer"
                      className="text-slate-400 hover:text-red-600"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <NewTmaModal
        projectId={projectId}
        enterprises={enterprises}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={() => router.refresh()}
      />
    </>
  );
}
