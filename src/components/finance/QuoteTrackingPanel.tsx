"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AddQuoteModal } from "@/components/finance/AddQuoteModal";
import { AmendmentDocumentModal } from "@/components/finance/AmendmentDocumentModal";
import { DevisMouEmailStep } from "@/components/finance/DevisMouEmailStep";
import { PrintReportBanner } from "@/components/print/PrintReportBanner";
import { TableExportToolbar } from "@/components/print/TableExportToolbar";
import { getQuoteFileUrl, updateQuoteField } from "@/lib/actions/quotes";
import { formatCurrency, parseMoneyInput } from "@/lib/finance/calculations";
import type { ExcelColumn } from "@/lib/print/table-export";
import type {
  FinancialQuoteWithLot,
  Project,
  QuoteValidationStatus,
} from "@/lib/types/database";

type QuoteTrackingPanelProps = {
  projectId: string;
  quotes: FinancialQuoteWithLot[];
  project: Project;
  m365Ready: boolean;
};

type ValidatedFilter = QuoteValidationStatus;
type YesNoFilter = "yes" | "no";

type ColumnFilters = {
  lot: Set<string>;
  enterprise: Set<string>;
  quoteNumber: Set<string>;
  cie: Set<YesNoFilter>;
  ts: Set<YesNoFilter>;
  tma: Set<YesNoFilter>;
  validated: Set<ValidatedFilter>;
  amendment: Set<YesNoFilter>;
};

type EditingCell = {
  quoteId: string;
  field: string;
};

type SignedUploadPrompt = {
  quoteId: string;
  validatedAt: string;
};

const BORDER = "border border-black";

const EXCEL_COLUMNS: ExcelColumn[] = [
  { header: "Lot", value: "" },
  { header: "Entreprise", value: "" },
  { header: "N° devis", value: "" },
  { header: "Date", value: "" },
  { header: "CIE", value: "" },
  { header: "TS", value: "" },
  { header: "TMA", value: "" },
  { header: "Désignation", value: "" },
  { header: "Montant H.T.", value: "" },
  { header: "Date envoi MOU", value: "" },
  { header: "Date retour MOU", value: "" },
  { header: "Validé", value: "" },
  { header: "Avenant", value: "" },
  { header: "Commentaire DANOBAT", value: "" },
];

function isRowStruck(quote: FinancialQuoteWithLot): boolean {
  return quote.validation_status === "no" || quote.is_rejected;
}

function formatDateFr(value: string | null | undefined): string {
  if (!value) return "";
  return new Date(value).toLocaleDateString("fr-FR");
}

function formatValidatedDisplay(quote: FinancialQuoteWithLot): string {
  if (quote.validation_status === "yes") return "Oui";
  if (quote.validation_status === "no" || quote.is_rejected) return "Non";
  return "—";
}

function yesNo(value: boolean): YesNoFilter {
  return value ? "yes" : "no";
}

function emptyFilters(): ColumnFilters {
  return {
    lot: new Set(),
    enterprise: new Set(),
    quoteNumber: new Set(),
    cie: new Set(),
    ts: new Set(),
    tma: new Set(),
    validated: new Set(),
    amendment: new Set(),
  };
}

type ColumnFilterDropdownProps<T extends string> = {
  label: string;
  options: { value: T; label: string }[];
  selected: Set<T>;
  onChange: (next: Set<T>) => void;
};

function ColumnFilterDropdown<T extends string>({
  label,
  options,
  selected,
  onChange,
}: ColumnFilterDropdownProps<T>) {
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

  function toggle(value: T) {
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

function FilterableHeader<T extends string>({
  children,
  filterKey,
  options,
  filters,
  setFilters,
}: {
  children: React.ReactNode;
  filterKey: keyof ColumnFilters;
  options: { value: T; label: string }[];
  filters: ColumnFilters;
  setFilters: React.Dispatch<React.SetStateAction<ColumnFilters>>;
}) {
  return (
    <th className={`${BORDER} px-2 py-2`}>
      <div className="flex items-center justify-center gap-0.5">
        <span>{children}</span>
        <ColumnFilterDropdown
          label={String(filterKey)}
          options={options}
          selected={filters[filterKey] as Set<T>}
          onChange={(next) =>
            setFilters((prev) => ({ ...prev, [filterKey]: next }))
          }
        />
      </div>
    </th>
  );
}

function SignedDevisUploadModal({
  open,
  onClose,
  onUpload,
  uploading,
}: {
  open: boolean;
  onClose: () => void;
  onUpload: (file: File) => void;
  uploading: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
        <h3 className="text-lg font-semibold text-slate-900">Devis signé</h3>
        <p className="mt-2 text-sm text-slate-600">
          Ce devis a été validé. Souhaitez-vous joindre le devis signé ?
        </p>
        <div
          onClick={() => inputRef.current?.click()}
          className="mt-4 cursor-pointer rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center hover:border-blue-300"
        >
          <input
            ref={inputRef}
            type="file"
            className="hidden"
            accept=".pdf,.png,.jpg,.jpeg,.webp"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onUpload(file);
            }}
          />
          <p className="text-sm font-medium text-slate-700">
            {uploading ? "Envoi…" : "Choisir ou glisser le devis signé"}
          </p>
        </div>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100"
          >
            Plus tard
          </button>
        </div>
      </div>
    </div>
  );
}

export function QuoteTrackingPanel({
  projectId,
  quotes: initialQuotes,
  project,
  m365Ready,
}: QuoteTrackingPanelProps) {
  const router = useRouter();
  const [quotes, setQuotes] = useState(initialQuotes);
  const [filters, setFilters] = useState<ColumnFilters>(emptyFilters);
  const [editing, setEditing] = useState<EditingCell | null>(null);
  const [editDraft, setEditDraft] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [mouEmailOpen, setMouEmailOpen] = useState(false);
  const [amendmentModal, setAmendmentModal] = useState<{
    html: string;
    title: string;
  } | null>(null);
  const [signedPrompt, setSignedPrompt] = useState<SignedUploadPrompt | null>(null);
  const [uploadingSigned, setUploadingSigned] = useState(false);

  useEffect(() => {
    setQuotes(initialQuotes);
  }, [initialQuotes]);

  const filterOptions = useMemo(() => {
    const lots = new Set<string>();
    const enterprises = new Set<string>();
    const numbers = new Set<string>();
    for (const q of quotes) {
      lots.add(q.lot_number ?? "—");
      enterprises.add(q.enterprise_name);
      numbers.add(q.quote_number || "—");
    }
    return {
      lot: Array.from(lots)
        .sort((a, b) => a.localeCompare(b, "fr", { numeric: true }))
        .map((v) => ({ value: v, label: v })),
      enterprise: Array.from(enterprises)
        .sort((a, b) => a.localeCompare(b, "fr"))
        .map((v) => ({ value: v, label: v })),
      quoteNumber: Array.from(numbers)
        .sort((a, b) => a.localeCompare(b, "fr", { numeric: true }))
        .map((v) => ({ value: v, label: v })),
      cie: [
        { value: "yes" as YesNoFilter, label: "Oui" },
        { value: "no" as YesNoFilter, label: "Non" },
      ],
      ts: [
        { value: "yes" as YesNoFilter, label: "Oui" },
        { value: "no" as YesNoFilter, label: "Non" },
      ],
      tma: [
        { value: "yes" as YesNoFilter, label: "Oui" },
        { value: "no" as YesNoFilter, label: "Non" },
      ],
      validated: [
        { value: "yes" as ValidatedFilter, label: "Oui" },
        { value: "no" as ValidatedFilter, label: "Non" },
        { value: "pending" as ValidatedFilter, label: "En attente" },
      ],
      amendment: [
        { value: "yes" as YesNoFilter, label: "Oui" },
        { value: "no" as YesNoFilter, label: "Non" },
      ],
    };
  }, [quotes]);

  const filteredQuotes = useMemo(() => {
    return quotes.filter((q) => {
      if (filters.lot.size > 0 && !filters.lot.has(q.lot_number ?? "—")) return false;
      if (filters.enterprise.size > 0 && !filters.enterprise.has(q.enterprise_name))
        return false;
      if (filters.quoteNumber.size > 0 && !filters.quoteNumber.has(q.quote_number || "—"))
        return false;
      if (filters.cie.size > 0 && !filters.cie.has(yesNo(q.is_cie))) return false;
      if (filters.ts.size > 0 && !filters.ts.has(yesNo(q.is_ts))) return false;
      if (filters.tma.size > 0 && !filters.tma.has(yesNo(q.is_tma))) return false;
      if (filters.validated.size > 0 && !filters.validated.has(q.validation_status)) return false;
      const hasAmendment = q.amendment_id ? "yes" : "no";
      if (filters.amendment.size > 0 && !filters.amendment.has(hasAmendment as YesNoFilter))
        return false;
      return true;
    });
  }, [quotes, filters]);

  const sortedQuotes = useMemo(() => {
    return [...filteredQuotes].sort((a, b) => {
      const lotCmp = (a.lot_number ?? "").localeCompare(b.lot_number ?? "", "fr", {
        numeric: true,
      });
      if (lotCmp !== 0) return lotCmp;
      return a.enterprise_name.localeCompare(b.enterprise_name, "fr");
    });
  }, [filteredQuotes]);

  const allVisibleSelected =
    sortedQuotes.length > 0 && sortedQuotes.every((q) => selectedIds.has(q.id));

  const excelRows = useMemo(
    () =>
      sortedQuotes.map((quote) =>
        EXCEL_COLUMNS.map((col) => {
          switch (col.header) {
            case "Lot":
              return { ...col, value: quote.lot_number ?? "—" };
            case "Entreprise":
              return { ...col, value: quote.enterprise_name };
            case "N° devis":
              return { ...col, value: quote.quote_number || "—" };
            case "Date":
              return { ...col, value: formatDateFr(quote.quote_date) };
            case "CIE":
              return { ...col, value: quote.is_cie ? "Oui" : "Non" };
            case "TS":
              return { ...col, value: quote.is_ts ? "Oui" : "Non" };
            case "TMA":
              return { ...col, value: quote.is_tma ? "Oui" : "Non" };
            case "Désignation":
              return { ...col, value: quote.designation ?? "—" };
            case "Montant H.T.":
              return { ...col, value: formatCurrency(Number(quote.amount_ht)) };
            case "Date envoi MOU":
              return { ...col, value: formatDateFr(quote.mou_sent_at) || "—" };
            case "Date retour MOU":
              return { ...col, value: formatDateFr(quote.mou_return_at) || "—" };
            case "Validé":
              return { ...col, value: formatValidatedDisplay(quote) };
            case "Avenant":
              return {
                ...col,
                value: quote.amendment_number != null ? String(quote.amendment_number) : "",
              };
            case "Commentaire DANOBAT":
              return { ...col, value: quote.comment ?? "" };
            default:
              return col;
          }
        })
      ),
    [sortedQuotes]
  );

  const openQuote = useCallback(
    async (quote: FinancialQuoteWithLot) => {
      const filePath = quote.signed_file_path ?? quote.file_path;
      if (!filePath) return;
      const url = await getQuoteFileUrl(projectId, filePath);
      window.open(url, "_blank", "noopener,noreferrer");
    },
    [projectId]
  );

  const saveField = useCallback(
    async (quoteId: string, field: string, value: string | boolean | null) => {
      const result = await updateQuoteField(projectId, quoteId, field, value);
      if (!result.ok) {
        alert(result.error);
        return false;
      }
      router.refresh();
      return true;
    },
    [projectId, router]
  );

  function toggleSelectAll() {
    if (allVisibleSelected) {
      setSelectedIds(new Set());
      return;
    }
    setSelectedIds(new Set(sortedQuotes.map((q) => q.id)));
  }

  function toggleSelect(quoteId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(quoteId)) next.delete(quoteId);
      else next.add(quoteId);
      return next;
    });
  }

  async function changeValidationStatus(
    quote: FinancialQuoteWithLot,
    value: QuoteValidationStatus
  ) {
    const ok = await saveField(quote.id, "validation_status", value);
    if (ok && value === "yes" && !quote.signed_file_path) {
      setSignedPrompt({
        quoteId: quote.id,
        validatedAt: new Date().toISOString().slice(0, 10),
      });
    }
  }

  function startEdit(quote: FinancialQuoteWithLot, field: string) {
    setEditing({ quoteId: quote.id, field });
    if (field === "amount_ht") {
      setEditDraft(String(quote.amount_ht));
    } else if (field === "quote_date") {
      setEditDraft(quote.quote_date.slice(0, 10));
    } else if (field === "quote_number") {
      setEditDraft(quote.quote_number);
    } else if (field === "designation") {
      setEditDraft(quote.designation ?? "");
    } else if (field === "comment") {
      setEditDraft(quote.comment ?? "");
    } else if (field === "mou_sent_at") {
      setEditDraft(quote.mou_sent_at?.slice(0, 10) ?? "");
    } else if (field === "mou_return_at") {
      setEditDraft(quote.mou_return_at?.slice(0, 10) ?? "");
    }
  }

  async function commitEdit(quote: FinancialQuoteWithLot) {
    if (!editing || editing.quoteId !== quote.id) return;
    const { field } = editing;
    setEditing(null);

    const trimmed = editDraft.trim();
    let value: string | boolean | null = trimmed;

    if (field === "amount_ht") {
      value = String(parseMoneyInput(trimmed));
    }

    await saveField(quote.id, field, value || null);
  }

  async function toggleCategory(
    quote: FinancialQuoteWithLot,
    field: "is_cie" | "is_ts" | "is_tma"
  ) {
    const current =
      field === "is_cie" ? quote.is_cie : field === "is_ts" ? quote.is_ts : quote.is_tma;
    await saveField(quote.id, field, !current);
  }

  async function handleSignedUpload(file: File) {
    if (!signedPrompt) return;
    setUploadingSigned(true);
    try {
      const formData = new FormData();
      formData.set("mode", "signed");
      formData.set("quoteId", signedPrompt.quoteId);
      formData.set(
        "enterpriseId",
        quotes.find((q) => q.id === signedPrompt.quoteId)?.enterprise_id ?? ""
      );
      formData.set("validatedAt", signedPrompt.validatedAt);
      formData.set("file", file);
      const { saveQuote } = await import("@/lib/actions/quotes");
      const result = await saveQuote(projectId, formData);
      if (!result.ok) {
        alert(result.error);
        return;
      }
      setSignedPrompt(null);
      router.refresh();
    } finally {
      setUploadingSigned(false);
    }
  }

  function renderEditableText(
    quote: FinancialQuoteWithLot,
    field: string,
    display: string,
    inputType: "text" | "date" = "text",
    className = ""
  ) {
    const isEditing = editing?.quoteId === quote.id && editing.field === field;
    if (isEditing) {
      return (
        <input
          type={inputType}
          value={editDraft}
          onChange={(e) => setEditDraft(e.target.value)}
          onBlur={() => commitEdit(quote)}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") setEditing(null);
          }}
          autoFocus
          className="w-full min-w-[4rem] rounded border border-blue-300 px-1 py-0.5 text-xs"
        />
      );
    }
    return (
      <button
        type="button"
        onClick={() => startEdit(quote, field)}
        className={`min-w-[3rem] text-left hover:text-blue-600 ${className}`}
        title="Cliquer pour modifier"
      >
        {display || "—"}
      </button>
    );
  }

  function renderValidationSelect(quote: FinancialQuoteWithLot, forPrint: boolean) {
    if (forPrint) {
      return formatValidatedDisplay(quote);
    }
    return (
      <select
        value={quote.validation_status}
        onChange={(e) =>
          changeValidationStatus(quote, e.target.value as QuoteValidationStatus)
        }
        className="w-full min-w-[5rem] rounded border border-slate-200 bg-white px-1 py-0.5 text-xs"
      >
        <option value="pending">—</option>
        <option value="yes">Oui</option>
        <option value="no">Non</option>
      </select>
    );
  }

  function tableHeader(forPrint: boolean) {
    if (forPrint) {
      return (
        <>
          <th className={`${BORDER} px-2 py-2 text-center`}>Lot</th>
          <th className={`${BORDER} px-2 py-2`}>Entreprise</th>
          <th className={`${BORDER} px-2 py-2`}>N° devis</th>
          <th className={`${BORDER} px-2 py-2`}>Date</th>
          <th className={`${BORDER} px-2 py-2 text-center`}>CIE</th>
          <th className={`${BORDER} px-2 py-2 text-center`}>TS</th>
          <th className={`${BORDER} px-2 py-2 text-center`}>TMA</th>
          <th className={`${BORDER} px-2 py-2`}>Désignation</th>
          <th className={`${BORDER} px-2 py-2 text-right`}>Montant H.T.</th>
          <th className={`${BORDER} px-2 py-2`}>Date envoi MOU</th>
          <th className={`${BORDER} px-2 py-2`}>Date retour MOU</th>
          <th className={`${BORDER} px-2 py-2`}>Validé</th>
          <th className={`${BORDER} px-2 py-2`}>Avenant</th>
          <th className={`${BORDER} px-2 py-2`}>Commentaire DANOBAT</th>
        </>
      );
    }

    return (
      <>
        {!forPrint && (
          <th className={`${BORDER} px-2 py-2 text-center no-print`}>
            <input
              type="checkbox"
              checked={allVisibleSelected}
              onChange={toggleSelectAll}
              aria-label="Tout sélectionner"
            />
          </th>
        )}
        <FilterableHeader
          filterKey="lot"
          options={filterOptions.lot}
          filters={filters}
          setFilters={setFilters}
        >
          Lot
        </FilterableHeader>
        <FilterableHeader
          filterKey="enterprise"
          options={filterOptions.enterprise}
          filters={filters}
          setFilters={setFilters}
        >
          Entreprise
        </FilterableHeader>
        <FilterableHeader
          filterKey="quoteNumber"
          options={filterOptions.quoteNumber}
          filters={filters}
          setFilters={setFilters}
        >
          N° devis
        </FilterableHeader>
        <th className={`${BORDER} px-2 py-2`}>Date</th>
        <FilterableHeader
          filterKey="cie"
          options={filterOptions.cie}
          filters={filters}
          setFilters={setFilters}
        >
          CIE
        </FilterableHeader>
        <FilterableHeader
          filterKey="ts"
          options={filterOptions.ts}
          filters={filters}
          setFilters={setFilters}
        >
          TS
        </FilterableHeader>
        <FilterableHeader
          filterKey="tma"
          options={filterOptions.tma}
          filters={filters}
          setFilters={setFilters}
        >
          TMA
        </FilterableHeader>
        <th className={`${BORDER} px-2 py-2`}>Désignation</th>
        <th className={`${BORDER} px-2 py-2 text-right`}>Montant H.T.</th>
        <th className={`${BORDER} px-2 py-2`}>Date envoi MOU</th>
        <th className={`${BORDER} px-2 py-2`}>Date retour MOU</th>
        <FilterableHeader
          filterKey="validated"
          options={filterOptions.validated}
          filters={filters}
          setFilters={setFilters}
        >
          Validé
        </FilterableHeader>
        <FilterableHeader
          filterKey="amendment"
          options={filterOptions.amendment}
          filters={filters}
          setFilters={setFilters}
        >
          Avenant
        </FilterableHeader>
        <th className={`${BORDER} px-2 py-2`}>Commentaire DANOBAT</th>
      </>
    );
  }
    return (
      <tbody>
        {sortedQuotes.map((quote) => (
          <tr
            key={quote.id}
            className={`hover:bg-slate-50 ${isRowStruck(quote) ? "line-through opacity-60" : ""}`}
          >
            {!forPrint && (
              <td className={`${BORDER} px-2 py-2 text-center no-print`}>
                <input
                  type="checkbox"
                  checked={selectedIds.has(quote.id)}
                  onChange={() => toggleSelect(quote.id)}
                  aria-label={`Sélectionner devis ${quote.quote_number || quote.id}`}
                />
              </td>
            )}
            <td className={`${BORDER} px-2 py-2 text-center font-medium`}>
              {quote.lot_number ?? "—"}
            </td>
            <td className={`${BORDER} px-2 py-2 font-medium`}>{quote.enterprise_name}</td>
            <td className={`${BORDER} px-2 py-2`}>
              {!forPrint && (quote.file_path || quote.signed_file_path) ? (
                <button
                  type="button"
                  onClick={() => openQuote(quote)}
                  className="font-medium text-blue-600 underline hover:text-blue-800"
                >
                  {quote.quote_number || "Devis"}
                </button>
              ) : (
                quote.quote_number || "—"
              )}
            </td>
            <td className={`${BORDER} px-2 py-2 whitespace-nowrap`}>
              {forPrint
                ? formatDateFr(quote.quote_date)
                : renderEditableText(
                    quote,
                    "quote_date",
                    formatDateFr(quote.quote_date),
                    "date"
                  )}
            </td>
            <td className={`${BORDER} px-2 py-2 text-center`}>
              {forPrint ? (
                quote.is_cie ? "✓" : ""
              ) : (
                <button
                  type="button"
                  onClick={() => toggleCategory(quote, "is_cie")}
                  className="min-w-[1.5rem] hover:text-blue-600"
                >
                  {quote.is_cie ? "✓" : ""}
                </button>
              )}
            </td>
            <td className={`${BORDER} px-2 py-2 text-center`}>
              {forPrint ? (
                quote.is_ts ? "✓" : ""
              ) : (
                <button
                  type="button"
                  onClick={() => toggleCategory(quote, "is_ts")}
                  className="min-w-[1.5rem] hover:text-blue-600"
                >
                  {quote.is_ts ? "✓" : ""}
                </button>
              )}
            </td>
            <td className={`${BORDER} px-2 py-2 text-center`}>
              {forPrint ? (
                quote.is_tma ? "✓" : ""
              ) : (
                <button
                  type="button"
                  onClick={() => toggleCategory(quote, "is_tma")}
                  className="min-w-[1.5rem] hover:text-blue-600"
                >
                  {quote.is_tma ? "✓" : ""}
                </button>
              )}
            </td>
            <td className={`${BORDER} px-2 py-2`}>
              {forPrint
                ? quote.designation ?? "—"
                : renderEditableText(quote, "designation", quote.designation ?? "—")}
            </td>
            <td className={`${BORDER} px-2 py-2 text-right tabular-nums`}>
              {forPrint
                ? formatCurrency(Number(quote.amount_ht))
                : renderEditableText(
                    quote,
                    "amount_ht",
                    formatCurrency(Number(quote.amount_ht)),
                    "text",
                    "w-full text-right"
                  )}
            </td>
            <td className={`${BORDER} px-2 py-2 whitespace-nowrap`}>
              {forPrint
                ? formatDateFr(quote.mou_sent_at) || "—"
                : renderEditableText(
                    quote,
                    "mou_sent_at",
                    formatDateFr(quote.mou_sent_at),
                    "date"
                  )}
            </td>
            <td className={`${BORDER} px-2 py-2 whitespace-nowrap`}>
              {forPrint
                ? formatDateFr(quote.mou_return_at) || "—"
                : renderEditableText(
                    quote,
                    "mou_return_at",
                    formatDateFr(quote.mou_return_at),
                    "date"
                  )}
            </td>
            <td className={`${BORDER} px-2 py-2`}>
              {renderValidationSelect(quote, forPrint)}
            </td>
            <td className={`${BORDER} px-2 py-2 text-center`}>
              {quote.amendment_number != null ? (
                !forPrint && quote.amendment_document_html ? (
                  <button
                    type="button"
                    onClick={() =>
                      setAmendmentModal({
                        html: quote.amendment_document_html ?? "",
                        title: `Avenant n°${quote.amendment_number}`,
                      })
                    }
                    className="font-medium text-violet-700 underline hover:text-violet-900"
                  >
                    {quote.amendment_number}
                  </button>
                ) : (
                  quote.amendment_number
                )
              ) : (
                ""
              )}
            </td>
            <td className={`${BORDER} px-2 py-2`}>
              {forPrint
                ? quote.comment ?? ""
                : renderEditableText(quote, "comment", quote.comment ?? "")}
            </td>
          </tr>
        ))}
      </tbody>
    );
  }

  const safeExportName =
    project.name.replace(/[^\w\s-]/g, "").trim() || "suivi-devis";

  return (
    <section className="overflow-x-auto rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Suivi des devis</h2>
          <p className="text-sm text-slate-500">
            Filtres par colonne · édition inline · impression / export Excel
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {selectedIds.size > 0 && (
            <button
              type="button"
              onClick={() => setMouEmailOpen(true)}
              className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
            >
              Envoyer au MOU ({selectedIds.size})
            </button>
          )}
          <button
            type="button"
            onClick={() => setAddOpen(true)}
            className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-700"
          >
            Ajouter un devis
          </button>
          <TableExportToolbar
            printRootId="quote-tracking-print"
            excelFilename={`Suivi-devis-${safeExportName}`}
            excelColumns={EXCEL_COLUMNS}
            excelRows={excelRows}
            disabled={sortedQuotes.length === 0}
          />
        </div>
      </div>

      {quotes.length === 0 ? (
        <p className="text-sm text-slate-500">
          Aucun devis enregistré. Utilisez « Ajouter un devis » ou classez un devis depuis
          Outlook (Classer PJ).
        </p>
      ) : sortedQuotes.length === 0 ? (
        <p className="text-sm text-slate-500">Aucun devis ne correspond aux filtres.</p>
      ) : (
        <table className={`w-full min-w-[1400px] border-collapse text-sm ${BORDER}`}>
          <thead>
            <tr className="bg-slate-100 text-left font-bold">{tableHeader(false)}</tr>
          </thead>
          {tableBody(false)}
        </table>
      )}

      {addOpen && (
        <AddQuoteModal
          projectId={projectId}
          open={addOpen}
          onClose={() => setAddOpen(false)}
          onSaved={() => {
            setAddOpen(false);
            router.refresh();
          }}
        />
      )}

      {mouEmailOpen && (
        <DevisMouEmailStep
          projectId={projectId}
          quoteIds={Array.from(selectedIds)}
          m365Ready={m365Ready}
          onClose={() => setMouEmailOpen(false)}
          onSent={() => {
            setSelectedIds(new Set());
            router.refresh();
          }}
        />
      )}

      <AmendmentDocumentModal
        html={amendmentModal?.html ?? null}
        title={amendmentModal?.title ?? ""}
        open={Boolean(amendmentModal)}
        onClose={() => setAmendmentModal(null)}
      />

      <SignedDevisUploadModal
        open={Boolean(signedPrompt)}
        onClose={() => setSignedPrompt(null)}
        onUpload={handleSignedUpload}
        uploading={uploadingSigned}
      />

      <div id="quote-tracking-print" className="pointer-events-none fixed -left-[9999px] top-0">
        <div className="bg-white p-8" style={{ width: "297mm" }}>
          <PrintReportBanner title="SUIVI des DEVIS" project={project} />
          {sortedQuotes.length > 0 && (
            <table className={`w-full border-collapse text-xs ${BORDER}`}>
              <thead>
                <tr className="bg-slate-100 text-left font-bold">{tableHeader(true)}</tr>
              </thead>
              {tableBody(true)}
            </table>
          )}
        </div>
      </div>
    </section>
  );
}
