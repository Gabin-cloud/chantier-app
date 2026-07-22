"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { NewTmaModal } from "@/components/travaux/NewTmaModal";
import { TmaAnalysisModal } from "@/components/travaux/TmaAnalysisModal";
import { TmaMouEmailStep } from "@/components/travaux/TmaMouEmailStep";
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

const BORDER = "border border-slate-300";

type TmaColumnFilters = {
  status: Set<WorkTmaEntryStatus>;
  logement: Set<string>;
  localisation: Set<string>;
  modifDemandee: Set<string>;
  natureTravaux: Set<string>;
  enterprise: Set<string>;
  devisNumber: Set<string>;
  devisRecu: Set<string>;
  mouEnvoi: Set<string>;
  mouAcceptation: Set<string>;
  mouAccepte: Set<string>;
  montantHt: Set<string>;
};

function emptyTmaFilters(): TmaColumnFilters {
  return {
    status: new Set(),
    logement: new Set(),
    localisation: new Set(),
    modifDemandee: new Set(),
    natureTravaux: new Set(),
    enterprise: new Set(),
    devisNumber: new Set(),
    devisRecu: new Set(),
    mouEnvoi: new Set(),
    mouAcceptation: new Set(),
    mouAccepte: new Set(),
    montantHt: new Set(),
  };
}

type ColumnFilterDropdownProps = {
  label: string;
  options: { value: string; label: string }[];
  selected: Set<string>;
  onChange: (next: Set<string>) => void;
};

function ColumnFilterDropdown({
  label,
  options,
  selected,
  onChange,
}: ColumnFilterDropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const active = selected.size > 0;

  useEffect(() => {
    if (!open) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  function toggle(value: string) {
    const allValues = options.map((o) => o.value);
    if (selected.size === 0) {
      onChange(new Set(allValues.filter((v) => v !== value)));
      return;
    }
    const next = new Set(selected);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    if (next.size === allValues.length) onChange(new Set());
    else onChange(next);
  }

  return (
    <div ref={ref} className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`ml-1 rounded px-1 text-xs ${active ? "bg-blue-200 text-blue-900" : "text-slate-500 hover:bg-slate-200"}`}
        title={`Filtrer ${label}`}
      >
        ▾
      </button>
      {open && (
        <div className="absolute left-0 top-full z-30 mt-1 min-w-[10rem] rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
          <div className="mb-2 flex gap-1">
            <button
              type="button"
              className="rounded px-1.5 py-0.5 text-[10px] text-blue-600 hover:bg-blue-50"
              onClick={() => onChange(new Set(options.map((o) => o.value)))}
            >
              Tout
            </button>
            <button
              type="button"
              className="rounded px-1.5 py-0.5 text-[10px] text-slate-600 hover:bg-slate-50"
              onClick={() => onChange(new Set())}
            >
              Effacer
            </button>
          </div>
          <ul className="max-h-48 space-y-1 overflow-y-auto">
            {options.map((opt) => (
              <li key={opt.value}>
                <label className="flex cursor-pointer items-center gap-2 rounded px-1 py-0.5 text-xs hover:bg-slate-50">
                  <input
                    type="checkbox"
                    checked={selected.size === 0 || selected.has(opt.value)}
                    onChange={() => toggle(opt.value)}
                  />
                  {opt.label}
                </label>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function FilterableHeader({
  children,
  label,
  filterKey,
  options,
  filters,
  setFilters,
  align = "left",
}: {
  children: React.ReactNode;
  label: string;
  filterKey: keyof TmaColumnFilters;
  options: { value: string; label: string }[];
  filters: TmaColumnFilters;
  setFilters: React.Dispatch<React.SetStateAction<TmaColumnFilters>>;
  align?: "left" | "center" | "right";
}) {
  const alignClass =
    align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left";
  return (
    <th className={`${BORDER} px-2 py-2 font-bold ${alignClass}`}>
      <div
        className={`flex items-center gap-0.5 ${
          align === "right"
            ? "justify-end"
            : align === "center"
              ? "justify-center"
              : "justify-start"
        }`}
      >
        <span>{children}</span>
        <ColumnFilterDropdown
          label={label}
          options={options}
          selected={filters[filterKey] as Set<string>}
          onChange={(next) =>
            setFilters((prev) => ({ ...prev, [filterKey]: next }))
          }
        />
      </div>
    </th>
  );
}

function formatMoneyFilter(value: number): string {
  return value ? formatCurrency(value) : "—";
}

function isTmaRowStruck(entry: WorkTmaEntry): boolean {
  return !["analyzed", "sent_to_accounting", "completed"].includes(entry.status);
}

function mouAccepteLabel(value: string | null): string {
  return value ? "Oui" : "Non";
}

function buildTmaFilterOptions(entries: WorkTmaEntry[]) {
  const status = new Set<WorkTmaEntryStatus>();
  const logement = new Set<string>();
  const localisation = new Set<string>();
  const modifDemandee = new Set<string>();
  const natureTravaux = new Set<string>();
  const enterprise = new Set<string>();
  const devisNumber = new Set<string>();
  const devisRecu = new Set<string>();
  const mouEnvoi = new Set<string>();
  const mouAcceptation = new Set<string>();
  const mouAccepte = new Set<string>();
  const montantHt = new Set<string>();

  for (const entry of entries) {
    status.add(entry.status);
    logement.add(entry.logement_number || "—");
    localisation.add(entry.localisation || "—");
    modifDemandee.add(formatDate(entry.modif_demandee_le) || "—");
    natureTravaux.add(entry.nature_travaux || "—");
    enterprise.add(entry.enterprise_name || "—");
    devisNumber.add(entry.devis_number || "—");
    devisRecu.add(formatDate(entry.devis_recu_le) || "—");
    mouEnvoi.add(formatDate(entry.mou_envoi) || "—");
    mouAcceptation.add(formatDate(entry.mou_acceptation) || "—");
    mouAccepte.add(mouAccepteLabel(entry.mou_acceptation));
    montantHt.add(formatMoneyFilter(entry.montant_ht));
  }

  const toOptions = (values: Set<string>) =>
    Array.from(values)
      .sort((a, b) => a.localeCompare(b, "fr", { numeric: true }))
      .map((v) => ({ value: v, label: v }));

  return {
    status: Array.from(status).map((v) => ({
      value: v,
      label: STATUS_LABELS[v],
    })),
    logement: toOptions(logement),
    localisation: toOptions(localisation),
    modifDemandee: toOptions(modifDemandee),
    natureTravaux: toOptions(natureTravaux),
    enterprise: toOptions(enterprise),
    devisNumber: toOptions(devisNumber),
    devisRecu: toOptions(devisRecu),
    mouEnvoi: toOptions(mouEnvoi),
    mouAcceptation: toOptions(mouAcceptation),
    mouAccepte: toOptions(mouAccepte),
    montantHt: toOptions(montantHt),
  };
}

function applyTmaFilters(entries: WorkTmaEntry[], filters: TmaColumnFilters): WorkTmaEntry[] {
  return entries.filter((entry) => {
    if (filters.status.size > 0 && !filters.status.has(entry.status)) return false;
    if (filters.logement.size > 0 && !filters.logement.has(entry.logement_number || "—"))
      return false;
    if (filters.localisation.size > 0 && !filters.localisation.has(entry.localisation || "—"))
      return false;
    if (
      filters.modifDemandee.size > 0 &&
      !filters.modifDemandee.has(formatDate(entry.modif_demandee_le) || "—")
    )
      return false;
    if (
      filters.natureTravaux.size > 0 &&
      !filters.natureTravaux.has(entry.nature_travaux || "—")
    )
      return false;
    if (filters.enterprise.size > 0 && !filters.enterprise.has(entry.enterprise_name || "—"))
      return false;
    if (filters.devisNumber.size > 0 && !filters.devisNumber.has(entry.devis_number || "—"))
      return false;
    if (
      filters.devisRecu.size > 0 &&
      !filters.devisRecu.has(formatDate(entry.devis_recu_le) || "—")
    )
      return false;
    if (filters.mouEnvoi.size > 0 && !filters.mouEnvoi.has(formatDate(entry.mou_envoi) || "—"))
      return false;
    if (
      filters.mouAcceptation.size > 0 &&
      !filters.mouAcceptation.has(formatDate(entry.mou_acceptation) || "—")
    )
      return false;
    if (
      filters.mouAccepte.size > 0 &&
      !filters.mouAccepte.has(mouAccepteLabel(entry.mou_acceptation))
    )
      return false;
    if (
      filters.montantHt.size > 0 &&
      !filters.montantHt.has(formatMoneyFilter(entry.montant_ht))
    )
      return false;
    return true;
  });
}

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

function EditableAcceptationOuiNon({
  projectId,
  entryId,
  value,
}: {
  projectId: string;
  entryId: string;
  value: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <select
      value={value ? "oui" : "non"}
      disabled={isPending}
      onChange={(e) => {
        const accepted = e.target.value === "oui";
        startTransition(async () => {
          await updateTmaField(
            projectId,
            entryId,
            "mou_acceptation",
            accepted ? new Date().toISOString().slice(0, 10) : null
          );
          router.refresh();
        });
      }}
      className="w-full border-0 bg-transparent px-1 py-0.5 text-xs focus:bg-yellow-50 focus:outline-none"
    >
      <option value="non">Non</option>
      <option value="oui">Oui</option>
    </select>
  );
}

function TmaTable({
  projectId,
  entries,
  filterOptions,
  filters,
  setFilters,
  selectedIds,
  onToggleSelect,
  onToggleSelectAll,
  allVisibleSelected,
  onDelete,
  isPending,
  showStatus = true,
}: {
  projectId: string;
  entries: WorkTmaEntry[];
  filterOptions: ReturnType<typeof buildTmaFilterOptions>;
  filters: TmaColumnFilters;
  setFilters: React.Dispatch<React.SetStateAction<TmaColumnFilters>>;
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onToggleSelectAll: () => void;
  allVisibleSelected: boolean;
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
          <th className={`${BORDER} w-8 px-1 py-2 text-center`}>
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={onToggleSelectAll}
              aria-label="Tout sélectionner"
            />
          </th>
          {showStatus && (
            <FilterableHeader
              label="Statut"
              filterKey="status"
              options={filterOptions.status}
              filters={filters}
              setFilters={setFilters}
            >
              Statut
            </FilterableHeader>
          )}
          <FilterableHeader
            label="Logt n°"
            filterKey="logement"
            options={filterOptions.logement}
            filters={filters}
            setFilters={setFilters}
          >
            Logt n°
          </FilterableHeader>
          <FilterableHeader
            label="Localisation"
            filterKey="localisation"
            options={filterOptions.localisation}
            filters={filters}
            setFilters={setFilters}
          >
            Localisation
          </FilterableHeader>
          <FilterableHeader
            label="Modif demandée le"
            filterKey="modifDemandee"
            options={filterOptions.modifDemandee}
            filters={filters}
            setFilters={setFilters}
          >
            Modif demandée le
          </FilterableHeader>
          <FilterableHeader
            label="Nature des travaux"
            filterKey="natureTravaux"
            options={filterOptions.natureTravaux}
            filters={filters}
            setFilters={setFilters}
          >
            Nature des travaux modificatifs
          </FilterableHeader>
          <FilterableHeader
            label="Entreprise"
            filterKey="enterprise"
            options={filterOptions.enterprise}
            filters={filters}
            setFilters={setFilters}
          >
            Entreprise concernée
          </FilterableHeader>
          <th className={`${BORDER} px-2 py-2 text-center font-bold`} colSpan={2}>
            Entreprise
          </th>
          <th className={`${BORDER} px-2 py-2 text-center font-bold`} colSpan={3}>
            MOU devis
          </th>
          <FilterableHeader
            label="Montant H.T."
            filterKey="montantHt"
            options={filterOptions.montantHt}
            filters={filters}
            setFilters={setFilters}
            align="right"
          >
            Montant H.T.
          </FilterableHeader>
          <th className={`${BORDER} w-8 px-1 py-2`} />
        </tr>
        <tr className="bg-slate-50 text-[10px] text-slate-600">
          <th className={BORDER} />
          <th className={BORDER} colSpan={showStatus ? 6 : 5} />
          <FilterableHeader
            label="N° devis"
            filterKey="devisNumber"
            options={filterOptions.devisNumber}
            filters={filters}
            setFilters={setFilters}
          >
            N° devis
          </FilterableHeader>
          <FilterableHeader
            label="reçu le"
            filterKey="devisRecu"
            options={filterOptions.devisRecu}
            filters={filters}
            setFilters={setFilters}
          >
            reçu le
          </FilterableHeader>
          <FilterableHeader
            label="Envoi MOU"
            filterKey="mouEnvoi"
            options={filterOptions.mouEnvoi}
            filters={filters}
            setFilters={setFilters}
          >
            Envoi
          </FilterableHeader>
          <FilterableHeader
            label="Acceptation MOU"
            filterKey="mouAcceptation"
            options={filterOptions.mouAcceptation}
            filters={filters}
            setFilters={setFilters}
          >
            Acceptat.
          </FilterableHeader>
          <FilterableHeader
            label="Accepté"
            filterKey="mouAccepte"
            options={filterOptions.mouAccepte}
            filters={filters}
            setFilters={setFilters}
          >
            Accepté
          </FilterableHeader>
          <th className={BORDER} colSpan={2} />
        </tr>
      </thead>
      <tbody>
        {entries.map((entry) => (
          <tr
            key={entry.id}
            className={`hover:bg-slate-50/50 ${isTmaRowStruck(entry) ? "line-through opacity-60" : ""}`}
          >
            <td className={`${BORDER} px-1 py-1 text-center`}>
              {["analyzed", "sent_to_accounting", "completed"].includes(entry.status) && (
                <input
                  type="checkbox"
                  checked={selectedIds.has(entry.id)}
                  onChange={() => onToggleSelect(entry.id)}
                  aria-label={`Sélectionner TMA ${entry.logement_number}`}
                />
              )}
            </td>
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
            <td className={`${BORDER} px-1 py-1`}>
              <EditableAcceptationOuiNon
                projectId={projectId}
                entryId={entry.id}
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
  const [mouOpen, setMouOpen] = useState(false);
  const [filters, setFilters] = useState<TmaColumnFilters>(emptyTmaFilters);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isPending, startTransition] = useTransition();

  const depositGroups = useMemo(() => buildDepositGroups(entries), [entries]);
  const fullTableEntries = useMemo(
    () => entries.filter((e) => e.status !== "to_analyze"),
    [entries]
  );
  const filterOptions = useMemo(
    () => buildTmaFilterOptions(fullTableEntries),
    [fullTableEntries]
  );
  const filteredFullTableEntries = useMemo(
    () => applyTmaFilters(fullTableEntries, filters),
    [fullTableEntries, filters]
  );
  const analyzedEntryIds = useMemo(
    () => entries.filter((e) => e.status === "analyzed").map((e) => e.id),
    [entries]
  );
  const mouTargetEntryIds = useMemo(() => {
    const selectedAnalyzed = Array.from(selectedIds).filter((id) =>
      analyzedEntryIds.includes(id)
    );
    return selectedAnalyzed.length > 0 ? selectedAnalyzed : analyzedEntryIds;
  }, [selectedIds, analyzedEntryIds]);
  const allVisibleSelected =
    filteredFullTableEntries.length > 0 &&
    filteredFullTableEntries
      .filter((e) => ["analyzed", "sent_to_accounting", "completed"].includes(e.status))
      .every((e) => selectedIds.has(e.id));

  function toggleSelect(entryId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(entryId)) next.delete(entryId);
      else next.add(entryId);
      return next;
    });
  }

  function toggleSelectAll() {
    const selectable = filteredFullTableEntries.filter((e) =>
      ["analyzed", "sent_to_accounting", "completed"].includes(e.status)
    );
    if (allVisibleSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(selectable.map((e) => e.id)));
  }

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
              Demande → envoi entreprises → dépôts à analyser → envoi MOU
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {mouTargetEntryIds.length > 0 && (
              <button
                type="button"
                onClick={() => setMouOpen(true)}
                className="rounded-lg border border-blue-300 bg-blue-50 px-4 py-2 text-sm font-semibold text-blue-800 hover:bg-blue-100"
              >
                Envoyer au MOU ({mouTargetEntryIds.length})
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
        ) : fullTableEntries.length === 0 ? (
          <p className="px-4 py-8 text-sm text-slate-500">
            Aucune TMA enregistrée. Cliquez sur « Nouvelle TMA » pour commencer.
          </p>
        ) : (
          <TmaTable
            projectId={projectId}
            entries={filteredFullTableEntries}
            filterOptions={filterOptions}
            filters={filters}
            setFilters={setFilters}
            selectedIds={selectedIds}
            onToggleSelect={toggleSelect}
            onToggleSelectAll={toggleSelectAll}
            allVisibleSelected={allVisibleSelected}
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

      <TmaMouEmailStep
        projectId={projectId}
        entryIds={mouTargetEntryIds}
        m365Ready={m365Ready}
        open={mouOpen}
        onClose={() => setMouOpen(false)}
        onComplete={() => {
          setMouOpen(false);
          setSelectedIds(new Set());
          router.refresh();
        }}
      />
    </>
  );
}
