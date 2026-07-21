"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { NewTmaModal } from "@/components/travaux/NewTmaModal";
import { TmaAnalysisModal } from "@/components/travaux/TmaAnalysisModal";
import { TmaComptabiliteEmailStep } from "@/components/travaux/TmaComptabiliteEmailStep";
import { updateTmaField, deleteTmaEntry } from "@/lib/actions/tma";
import { formatCurrency } from "@/lib/finance/calculations";
import type {
  Enterprise,
  TmaDepositGroup,
  WorkTmaEntry,
  WorkTmaEntryStatus,
} from "@/lib/types/database";

type TmaTrackingPanelProps = {
  projectId: string;
  projectName: string;
  entries: WorkTmaEntry[];
  enterprises: Enterprise[];
  m365Ready: boolean;
};

const BORDER = "border border-slate-300";

const STATUS_LABELS: Record<WorkTmaEntryStatus, string> = {
  draft: "Brouillon",
  sent: "Demande envoyée",
  to_analyze: "À analyser",
  analyzed: "Analysé",
  sent_to_accounting: "Envoyé compta",
  completed: "Terminé",
};

const STATUS_COLORS: Record<WorkTmaEntryStatus, string> = {
  draft: "bg-slate-100 text-slate-700",
  sent: "bg-blue-100 text-blue-800",
  to_analyze: "bg-amber-100 text-amber-900",
  analyzed: "bg-emerald-100 text-emerald-800",
  sent_to_accounting: "bg-violet-100 text-violet-800",
  completed: "bg-slate-200 text-slate-800",
};

function formatDate(value: string | null): string {
  if (!value) return "";
  return new Date(value).toLocaleDateString("fr-FR");
}

function buildDepositGroups(entries: WorkTmaEntry[]): TmaDepositGroup[] {
  const toAnalyze = entries.filter((e) => e.status === "to_analyze");
  const groups = new Map<string, TmaDepositGroup>();

  for (const entry of toAnalyze) {
    const key = `${entry.quote_id ?? "none"}::${entry.logement_number}::${entry.enterprise_id ?? entry.enterprise_name}`;
    const existing = groups.get(key);
    if (existing) {
      existing.entryIds.push(entry.id);
      existing.lineCount += 1;
      existing.totalHt += entry.montant_ht;
    } else {
      groups.set(key, {
        quoteId: entry.quote_id,
        logementNumber: entry.logement_number,
        enterpriseId: entry.enterprise_id,
        enterpriseName: entry.enterprise_name,
        devisNumber: entry.devis_number,
        devisRecuLe: entry.devis_recu_le,
        depositFilePath: entry.deposit_file_path,
        depositFileName: entry.deposit_file_name,
        entryIds: [entry.id],
        lineCount: 1,
        totalHt: entry.montant_ht,
      });
    }
  }

  return Array.from(groups.values());
}

function StatusBadge({ status }: { status: WorkTmaEntryStatus }) {
  return (
    <span
      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold ${STATUS_COLORS[status]}`}
    >
      {STATUS_LABELS[status]}
    </span>
  );
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
      className={
        className ??
        "w-full border-0 bg-transparent px-1 py-0.5 text-xs focus:bg-yellow-50 focus:outline-none"
      }
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

function TmaTable({
  projectId,
  entries,
  onDelete,
  isPending,
  showStatus = true,
}: {
  projectId: string;
  entries: WorkTmaEntry[];
  onDelete: (id: string) => void;
  isPending: boolean;
  showStatus?: boolean;
}) {
  if (entries.length === 0) {
    return (
      <p className="px-4 py-8 text-sm text-slate-500">Aucune ligne à afficher.</p>
    );
  }

  return (
    <table className={`w-full min-w-[1200px] border-collapse text-xs ${BORDER}`}>
      <thead>
        <tr className="bg-slate-50">
          {showStatus && (
            <th className={`${BORDER} px-2 py-2 text-left font-bold`}>Statut</th>
          )}
          <th className={`${BORDER} px-2 py-2 text-left font-bold`}>Logt n°</th>
          <th className={`${BORDER} px-2 py-2 text-left font-bold`}>Localisation</th>
          <th className={`${BORDER} px-2 py-2 text-left font-bold`}>Modif demandée le</th>
          <th className={`${BORDER} min-w-[12rem] px-2 py-2 text-left font-bold`}>
            Nature des travaux modificatifs
          </th>
          <th className={`${BORDER} px-2 py-2 text-left font-bold`}>Entreprise concernée</th>
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
          <th className={BORDER} colSpan={showStatus ? 6 : 5} />
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
            {showStatus && (
              <td className={`${BORDER} px-1 py-1`}>
                <StatusBadge status={entry.status} />
              </td>
            )}
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
                onClick={() => onDelete(entry.id)}
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
  );
}

export function TmaTrackingPanel({
  projectId,
  projectName,
  entries,
  enterprises,
  m365Ready,
}: TmaTrackingPanelProps) {
  const router = useRouter();
  const [modalOpen, setModalOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<"deposits" | "all">("deposits");
  const [analysisEntryIds, setAnalysisEntryIds] = useState<string[] | null>(null);
  const [comptaOpen, setComptaOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  const depositGroups = useMemo(() => buildDepositGroups(entries), [entries]);
  const analyzedEntryIds = useMemo(
    () => entries.filter((e) => e.status === "analyzed").map((e) => e.id),
    [entries]
  );

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
              Demande → envoi entreprises → dépôts à analyser → comptabilité
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {analyzedEntryIds.length > 0 && (
              <button
                type="button"
                onClick={() => setComptaOpen(true)}
                className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 hover:bg-emerald-100"
              >
                Envoyer à la comptabilité ({analyzedEntryIds.length})
              </button>
            )}
            <button
              type="button"
              onClick={() => setModalOpen(true)}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700"
            >
              Nouvelle TMA
            </button>
          </div>
        </header>

        <div className="flex gap-1 border-b border-slate-200 px-4 pt-2">
          <button
            type="button"
            onClick={() => setActiveTab("deposits")}
            className={`rounded-t-lg px-4 py-2 text-xs font-semibold ${
              activeTab === "deposits"
                ? "border border-b-0 border-slate-200 bg-white text-amber-900"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Dépôts à analyser
            {depositGroups.length > 0 && (
              <span className="ml-1.5 rounded-full bg-amber-200 px-1.5 py-0.5 text-[10px]">
                {depositGroups.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`rounded-t-lg px-4 py-2 text-xs font-semibold ${
              activeTab === "all"
                ? "border border-b-0 border-slate-200 bg-white text-slate-900"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            Tableau complet
          </button>
        </div>

        {activeTab === "deposits" ? (
          depositGroups.length === 0 ? (
            <p className="px-4 py-8 text-sm text-slate-500">
              Aucun dépôt en attente d&apos;analyse. Classez un devis TMA depuis Outlook pour
              l&apos;ajouter ici.
            </p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {depositGroups.map((group) => (
                <li
                  key={group.entryIds.join("-")}
                  className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      Logt {group.logementNumber || "—"} — {group.enterpriseName}
                    </p>
                    <p className="text-xs text-slate-500">
                      Devis {group.devisNumber || "—"}
                      {group.devisRecuLe
                        ? ` · reçu le ${formatDate(group.devisRecuLe)}`
                        : ""}
                      {" · "}
                      {group.lineCount} ligne(s) · {formatCurrency(group.totalHt)} H.T.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAnalysisEntryIds(group.entryIds)}
                    className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
                  >
                    Analyser
                  </button>
                </li>
              ))}
            </ul>
          )
        ) : entries.length === 0 ? (
          <p className="px-4 py-8 text-sm text-slate-500">
            Aucune TMA enregistrée. Cliquez sur « Nouvelle TMA » pour commencer.
          </p>
        ) : (
          <TmaTable
            projectId={projectId}
            entries={entries}
            onDelete={handleDelete}
            isPending={isPending}
          />
        )}
      </section>

      <NewTmaModal
        projectId={projectId}
        projectName={projectName}
        enterprises={enterprises}
        m365Ready={m365Ready}
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={() => router.refresh()}
      />

      {analysisEntryIds && (
        <TmaAnalysisModal
          projectId={projectId}
          entryIds={analysisEntryIds}
          open={Boolean(analysisEntryIds)}
          onClose={() => setAnalysisEntryIds(null)}
          onSaved={() => router.refresh()}
        />
      )}

      <TmaComptabiliteEmailStep
        projectId={projectId}
        entryIds={analyzedEntryIds}
        m365Ready={m365Ready}
        open={comptaOpen}
        onClose={() => setComptaOpen(false)}
        onComplete={() => {
          setComptaOpen(false);
          router.refresh();
        }}
      />
    </>
  );
}
