"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  DevisFormFields,
  devisValuesToFormData,
  type DevisFormValues,
} from "@/components/finance/DevisFormFields";
import {
  classifyIncomingFile,
  getQuickSortData,
  type QuickSortLot,
} from "@/lib/actions/incoming-files";
import {
  getOpenNcExecutionsForOutlook,
  uploadWorkControlAttestation,
} from "@/lib/actions/work-control";
import { getProjectQuotes, saveQuote } from "@/lib/actions/quotes";
import { getOpenTmaLogements, saveTmaDepositFromOutlook } from "@/lib/actions/tma";
import type { FinancialQuoteWithLot, IncomingFileCategory } from "@/lib/types/database";
import { INCOMING_FILE_CATEGORY_LABELS } from "@/lib/types/database";

function normalizeClassifyError(message: string): string {
  if (message.includes("Server Components render")) {
    return "Le fichier a probablement été classé. Actualisez la page pour vérifier.";
  }
  return message;
}

export const FILE_SORT_CATEGORIES: {
  id: IncomingFileCategory;
  label: string;
  description: string;
  color: string;
  requiresSituation: boolean;
}[] = [
  {
    id: "facture",
    label: "Facture",
    description: "Joindre à une situation",
    color: "border-blue-200 bg-blue-50 text-blue-800 hover:bg-blue-100",
    requiresSituation: true,
  },
  {
    id: "devis",
    label: "Devis",
    description: "Suivi devis",
    color: "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100",
    requiresSituation: false,
  },
  {
    id: "tma",
    label: "TMA",
    description: "Dépôt devis à analyser",
    color: "border-purple-200 bg-purple-50 text-purple-800 hover:bg-purple-100",
    requiresSituation: false,
  },
  {
    id: "administratif",
    label: "Administratif",
    description: "Courriers & docs admin",
    color: "border-slate-200 bg-slate-50 text-slate-800 hover:bg-slate-100",
    requiresSituation: false,
  },
  {
    id: "chantier",
    label: "Chantier",
    description: "Docs terrain",
    color: "border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100",
    requiresSituation: false,
  },
  {
    id: "plan_exe",
    label: "Plan d'exé",
    description: "Rangement SharePoint",
    color: "border-violet-200 bg-violet-50 text-violet-800 hover:bg-violet-100",
    requiresSituation: false,
  },
  {
    id: "levee_controle",
    label: "Levée point de contrôle",
    description: "Attestation NC",
    color: "border-teal-200 bg-teal-50 text-teal-800 hover:bg-teal-100",
    requiresSituation: false,
  },
  {
    id: "autre",
    label: "Autre",
    description: "Divers",
    color: "border-zinc-200 bg-zinc-50 text-zinc-800 hover:bg-zinc-100",
    requiresSituation: false,
  },
];

export function formatLotLabel(lot: QuickSortLot) {
  if (lot.lot_number && lot.designation) {
    return `Lot ${lot.lot_number} — ${lot.designation}`;
  }
  if (lot.lot_number) return `Lot ${lot.lot_number}`;
  return lot.name;
}

type OpenNcRow = Awaited<ReturnType<typeof getOpenNcExecutionsForOutlook>>[number];

function ncRowKey(r: OpenNcRow) {
  return `${r.checklistItemId}::${r.planLevelId}`;
}

type FileSortFormProps = {
  projectId: string;
  file: File | null;
  sourceEmail?: string;
  defaultNotes?: string;
  mailDate?: string;
  compact?: boolean;
  submitLabel?: string;
  onSuccess?: (message: string) => void;
  onClassified?: () => void;
};

function defaultDevisValues(mailDate?: string, designation = ""): DevisFormValues {
  return {
    quoteNumber: "",
    quoteDate: mailDate ?? new Date().toISOString().slice(0, 10),
    designation,
    amountHt: "",
    comment: designation,
    isCie: false,
    isTs: false,
    isTma: false,
    markRejected: false,
    validatedAt: "",
  };
}

export function FileSortForm({
  projectId,
  file,
  sourceEmail: initialSourceEmail = "",
  defaultNotes = "",
  mailDate,
  compact = false,
  submitLabel = "Classer le fichier",
  onSuccess,
  onClassified,
}: FileSortFormProps) {
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const [lots, setLots] = useState<QuickSortLot[]>([]);
  const [category, setCategory] = useState<IncomingFileCategory | null>(null);
  const [enterpriseId, setEnterpriseId] = useState<string | null>(null);
  const [situationId, setSituationId] = useState<string | null>(null);
  const [sourceEmail, setSourceEmail] = useState(initialSourceEmail);
  const [notes, setNotes] = useState(defaultNotes);
  const [devisMode, setDevisMode] = useState<"new" | "signed">("new");
  const [devisValues, setDevisValues] = useState<DevisFormValues>(() =>
    defaultDevisValues(mailDate, defaultNotes)
  );
  const [existingQuotes, setExistingQuotes] = useState<FinancialQuoteWithLot[]>([]);
  const [selectedQuoteId, setSelectedQuoteId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [ncRows, setNcRows] = useState<OpenNcRow[]>([]);
  const [loadingNc, setLoadingNc] = useState(false);
  const [selectedNcKeys, setSelectedNcKeys] = useState<string[]>([]);
  const [tmaLogements, setTmaLogements] = useState<
    { logementNumber: string; dossierId: string }[]
  >([]);
  const [tmaLogementNumber, setTmaLogementNumber] = useState("");
  const [tmaQuoteNumber, setTmaQuoteNumber] = useState("");
  const [tmaQuoteDate, setTmaQuoteDate] = useState(
    () => mailDate ?? new Date().toISOString().slice(0, 10)
  );

  useEffect(() => {
    setSourceEmail(initialSourceEmail);
  }, [initialSourceEmail]);

  useEffect(() => {
    if (defaultNotes) {
      setDevisValues((prev) => ({
        ...prev,
        designation: defaultNotes,
        comment: prev.comment || defaultNotes,
      }));
    }
  }, [defaultNotes]);

  useEffect(() => {
    if (mailDate) {
      setDevisValues((prev) => ({ ...prev, quoteDate: mailDate }));
    }
  }, [mailDate]);

  useEffect(() => {
    if (category !== "devis" || !projectId) {
      setExistingQuotes([]);
      setSelectedQuoteId("");
      return;
    }
    getProjectQuotes(projectId)
      .then(setExistingQuotes)
      .catch(() => setExistingQuotes([]));
  }, [category, projectId]);

  useEffect(() => {
    if (category !== "devis" && category !== "tma") {
      setTmaLogements([]);
      setTmaLogementNumber("");
      return;
    }
    if (!projectId) return;
    getOpenTmaLogements(projectId)
      .then(setTmaLogements)
      .catch(() => setTmaLogements([]));
  }, [category, projectId]);

  useEffect(() => {
    getQuickSortData(projectId)
      .then(setLots)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Erreur de chargement.")
      )
      .finally(() => setLoading(false));
  }, [projectId]);

  useEffect(() => {
    if (category !== "levee_controle" || !projectId) {
      setNcRows([]);
      setSelectedNcKeys([]);
      return;
    }
    setLoadingNc(true);
    getOpenNcExecutionsForOutlook(projectId)
      .then((rows) => {
        setNcRows(rows);
        setSelectedNcKeys([]);
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Erreur chargement NC.")
      )
      .finally(() => setLoadingNc(false));
  }, [category, projectId]);

  const selectedLot = lots.find((l) => l.id === enterpriseId);
  const selectedCategory = FILE_SORT_CATEGORIES.find((c) => c.id === category);

  const enterpriseNcRows = useMemo(() => {
    if (!enterpriseId) return [];
    return ncRows.filter((r) => r.enterpriseId === enterpriseId);
  }, [ncRows, enterpriseId]);

  function toggleNcKey(key: string) {
    setSelectedNcKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  const enterpriseQuotes = useMemo(() => {
    if (!enterpriseId) return [];
    return existingQuotes.filter(
      (q) => q.enterprise_id === enterpriseId && !q.is_rejected
    );
  }, [existingQuotes, enterpriseId]);

  function resetAfterSuccess(message: string) {
    setSuccess(message);
    setCategory(null);
    setEnterpriseId(null);
    setSituationId(null);
    setSelectedNcKeys([]);
    setDevisMode("new");
    setDevisValues(defaultDevisValues(mailDate, defaultNotes));
    setSelectedQuoteId("");
    onSuccess?.(message);
    onClassified?.();
  }

  function handleSubmit() {
    if (!file || !category || !enterpriseId) return;
    if (selectedCategory?.requiresSituation && !situationId) return;
    if (category === "levee_controle" && selectedNcKeys.length === 0) return;
    if (category === "devis" && devisMode === "signed" && !selectedQuoteId) return;

    setError(null);

    if (category === "tma") {
      startTransition(async () => {
        try {
          const fd = new FormData();
          fd.set("file", file);
          fd.set("enterpriseId", enterpriseId);
          fd.set("tmaLogementNumber", tmaLogementNumber);
          fd.set("quoteNumber", tmaQuoteNumber);
          fd.set("quoteDate", tmaQuoteDate);
          if (sourceEmail) fd.set("sourceEmail", sourceEmail);

          const result = await saveTmaDepositFromOutlook(projectId, fd);
          if (!result.ok) {
            setError(normalizeClassifyError(result.error));
            return;
          }
          resetAfterSuccess(
            `Dépôt TMA enregistré pour le logement ${tmaLogementNumber}. Ouvrez le suivi TMA sur PC pour analyser.`
          );
        } catch (err) {
          const raw = err instanceof Error ? err.message : "Erreur d'enregistrement.";
          setError(normalizeClassifyError(raw));
        }
      });
      return;
    }

    if (category === "devis") {
      startTransition(async () => {
        try {
          const formData = devisValuesToFormData(
            devisValues,
            enterpriseId,
            file,
            {
              mode: devisMode,
              ...(devisMode === "signed" ? { quoteId: selectedQuoteId } : {}),
              ...(devisValues.isTma && tmaLogementNumber
                ? { tmaLogementNumber }
                : {}),
            }
          );
          const result = await saveQuote(projectId, formData, {
            skipRevalidate: true,
          });
          if (!result.ok) {
            setError(normalizeClassifyError(result.error));
            return;
          }
          const message =
            devisMode === "signed"
              ? `Devis signé enregistré pour « ${file.name} ».`
              : `Devis enregistré dans le suivi pour « ${file.name} ».`;
          resetAfterSuccess(message);
        } catch (err) {
          const raw = err instanceof Error ? err.message : "Erreur d'enregistrement.";
          setError(normalizeClassifyError(raw));
        }
      });
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("category", category);
    formData.append("enterpriseId", enterpriseId);
    if (situationId) formData.append("situationId", situationId);
    if (sourceEmail) formData.append("sourceEmail", sourceEmail);
    if (notes) formData.append("notes", notes);

    startTransition(async () => {
      try {
        const result = await classifyIncomingFile(projectId, formData);
        if (!result.ok) {
          setError(normalizeClassifyError(result.error));
          return;
        }

        let lifted = 0;
        if (category === "levee_controle") {
          for (const key of selectedNcKeys) {
            const [checklistItemId, planLevelId] = key.split("::");
            if (!checklistItemId || !planLevelId) continue;
            const attForm = new FormData();
            attForm.set("file", file);
            await uploadWorkControlAttestation(
              projectId,
              checklistItemId,
              planLevelId,
              attForm,
              { skipRevalidate: true }
            );
            lifted++;
          }
        }

        const message =
          category === "levee_controle"
            ? `« ${result.fileName} » classé en ${INCOMING_FILE_CATEGORY_LABELS[category]} — ${lifted} point(s) levé(s).`
            : `« ${result.fileName} » classé en ${INCOMING_FILE_CATEGORY_LABELS[category]}.`;
        resetAfterSuccess(message);
      } catch (err) {
        const raw = err instanceof Error ? err.message : "Erreur de classement.";
        // Outlook taskpane : revalidate/RSC peut throw après un save réussi
        if (raw.includes("Server Components render")) {
          resetAfterSuccess(
            "Fichier probablement classé. Actualisez le volet si besoin."
          );
          return;
        }
        setError(normalizeClassifyError(raw));
      }
    });
  }

  const canSubmit =
    file &&
    category &&
    enterpriseId &&
    (!selectedCategory?.requiresSituation || situationId) &&
    (category !== "levee_controle" || selectedNcKeys.length > 0) &&
    (category !== "devis" || devisMode !== "signed" || selectedQuoteId) &&
    (category !== "devis" || !devisValues.isTma || Boolean(tmaLogementNumber)) &&
    (category !== "tma" || Boolean(tmaLogementNumber)) &&
    !isPending;

  const gridCols = compact ? "grid-cols-2" : "grid-cols-2";

  return (
    <div className="space-y-4">
      {file && (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2">
          <p className="text-sm font-medium text-emerald-800">{file.name}</p>
          <p className="text-xs text-emerald-600">
            {(file.size / 1024).toFixed(0)} Ko
          </p>
        </div>
      )}

      <section>
        <p className="mb-2 text-sm font-semibold text-slate-700">Catégorie</p>
        <div className={`grid ${gridCols} gap-2`}>
          {FILE_SORT_CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              type="button"
              onClick={() => {
                setCategory(cat.id);
                if (!cat.requiresSituation) setSituationId(null);
                setSelectedNcKeys([]);
                setError(null);
              }}
              className={`rounded-xl border-2 px-3 py-2.5 text-left transition-all ${
                category === cat.id
                  ? `${cat.color} ring-2 ring-offset-1 ring-blue-400`
                  : `${cat.color} opacity-80`
              }`}
            >
              <p className="text-sm font-semibold">{cat.label}</p>
              {!compact && (
                <p className="text-xs opacity-75">{cat.description}</p>
              )}
            </button>
          ))}
        </div>
      </section>

      {category && (
        <section>
          <p className="mb-2 text-sm font-semibold text-slate-700">
            Lot / entreprise
          </p>
          {loading ? (
            <p className="text-sm text-slate-500">Chargement des lots…</p>
          ) : lots.length === 0 ? (
            <p className="text-sm text-slate-500">Aucun lot configuré.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {lots.map((lot) => (
                <button
                  key={lot.id}
                  type="button"
                  onClick={() => {
                    setEnterpriseId(lot.id);
                    setSituationId(null);
                    setSelectedNcKeys([]);
                  }}
                  className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors sm:text-sm ${
                    enterpriseId === lot.id
                      ? "border-blue-600 bg-blue-600 text-white"
                      : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {formatLotLabel(lot)}
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {category === "facture" && selectedLot && (
        <section>
          <p className="mb-2 text-sm font-semibold text-slate-700">Situation</p>
          {selectedLot.situations.length === 0 ? (
            <p className="text-sm text-amber-700">Aucune situation pour ce lot.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {selectedLot.situations.map((sit) => (
                <button
                  key={sit.id}
                  type="button"
                  onClick={() => setSituationId(sit.id)}
                  className={`rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors sm:text-sm ${
                    situationId === sit.id
                      ? "border-blue-600 bg-blue-600 text-white"
                      : sit.has_invoice
                        ? "border-slate-200 bg-slate-100 text-slate-500"
                        : "border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100"
                  }`}
                >
                  n°{sit.situation_number}
                  {sit.has_invoice ? " ✓" : ""}
                </button>
              ))}
            </div>
          )}
        </section>
      )}

      {category === "levee_controle" && enterpriseId && (
        <section>
          <div className="mb-2 flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-slate-700">
              Points NC à lever ({enterpriseNcRows.length})
            </p>
            {enterpriseNcRows.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  setSelectedNcKeys(
                    selectedNcKeys.length === enterpriseNcRows.length
                      ? []
                      : enterpriseNcRows.map(ncRowKey)
                  )
                }
                className="text-[10px] font-semibold text-teal-700 hover:underline"
              >
                {selectedNcKeys.length === enterpriseNcRows.length
                  ? "Tout désélectionner"
                  : "Tout sélectionner"}
              </button>
            )}
          </div>
          {loadingNc ? (
            <p className="text-xs text-slate-500">Chargement des NC…</p>
          ) : enterpriseNcRows.length === 0 ? (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
              Aucune non-conformité ouverte pour cette entreprise.
            </p>
          ) : (
            <ul className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-teal-200 bg-teal-50/40 p-1">
              {enterpriseNcRows.map((r) => {
                const key = ncRowKey(r);
                const checked = selectedNcKeys.includes(key);
                return (
                  <li key={key}>
                    <label
                      className={`flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-xs ${
                        checked ? "bg-teal-100" : "hover:bg-white/80"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleNcKey(key)}
                        className="mt-0.5"
                      />
                      <span>
                        <span className="font-semibold text-slate-900">
                          {r.itemLabel}
                        </span>
                        <span className="block text-[10px] text-slate-500">
                          {r.planName} / {r.levelName}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}

      {category === "tma" && enterpriseId && (
        <section className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-purple-700">
              Logement TMA
            </label>
            {tmaLogements.length === 0 ? (
              <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Aucune demande TMA ouverte. Créez d&apos;abord une TMA sur PC.
              </p>
            ) : (
              <select
                value={tmaLogementNumber}
                onChange={(e) => setTmaLogementNumber(e.target.value)}
                className="w-full rounded-lg border border-purple-200 px-3 py-2 text-sm"
              >
                <option value="">— Choisir le logement —</option>
                {tmaLogements.map((l) => (
                  <option key={l.dossierId} value={l.logementNumber}>
                    Logt {l.logementNumber}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">N° devis</label>
            <input
              type="text"
              value={tmaQuoteNumber}
              onChange={(e) => setTmaQuoteNumber(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Date du devis</label>
            <input
              type="date"
              value={tmaQuoteDate}
              onChange={(e) => setTmaQuoteDate(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <p className="text-[10px] text-slate-500">
            Le dépôt apparaîtra dans « Dépôts à analyser » du suivi TMA sur PC.
          </p>
        </section>
      )}

      {category === "devis" && enterpriseId && (
        <section className="space-y-3">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setDevisMode("new")}
              className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold ${
                devisMode === "new"
                  ? "bg-amber-100 text-amber-900"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              Nouveau devis
            </button>
            <button
              type="button"
              onClick={() => setDevisMode("signed")}
              className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold ${
                devisMode === "signed"
                  ? "bg-emerald-100 text-emerald-900"
                  : "bg-slate-100 text-slate-600"
              }`}
            >
              Devis signé
            </button>
          </div>
          {devisMode === "signed" ? (
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Devis existant
              </label>
              <select
                value={selectedQuoteId}
                onChange={(e) => setSelectedQuoteId(e.target.value)}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">— Choisir —</option>
                {enterpriseQuotes.map((quote) => (
                  <option key={quote.id} value={quote.id}>
                    {quote.quote_number || "Devis"} — {quote.designation ?? ""}
                  </option>
                ))}
              </select>
              <div className="mt-2">
                <DevisFormFields
                  values={devisValues}
                  onChange={setDevisValues}
                  mode="signed"
                />
              </div>
            </div>
          ) : (
            <>
              <DevisFormFields
                values={devisValues}
                onChange={setDevisValues}
                mode="new"
              />
              {devisValues.isTma && (
                <div>
                  <label className="mb-1 block text-xs font-semibold text-violet-700">
                    Logement TMA concerné
                  </label>
                  {tmaLogements.length === 0 ? (
                    <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                      Aucune demande TMA ouverte. Créez d&apos;abord une nouvelle TMA dans le
                      suivi travaux.
                    </p>
                  ) : (
                    <select
                      value={tmaLogementNumber}
                      onChange={(e) => setTmaLogementNumber(e.target.value)}
                      className="w-full rounded-lg border border-violet-200 px-3 py-2 text-sm"
                    >
                      <option value="">— Choisir le logement —</option>
                      {tmaLogements.map((l) => (
                        <option key={l.dossierId} value={l.logementNumber}>
                          Logt {l.logementNumber}
                        </option>
                      ))}
                    </select>
                  )}
                  <p className="mt-1 text-[10px] text-slate-500">
                    Le dépôt sera placé dans « Dépôts à analyser » du suivi TMA.
                  </p>
                </div>
              )}
            </>
          )}
        </section>
      )}

      {category && enterpriseId && category !== "devis" && category !== "tma" && (
        <section className="space-y-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              E-mail expéditeur
            </label>
            <input
              type="email"
              value={sourceEmail}
              onChange={(e) => setSourceEmail(e.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">
              Note
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Objet du mail…"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
        </section>
      )}

      {category === "devis" && enterpriseId && (
        <section>
          <label className="mb-1 block text-xs font-medium text-slate-500">
            E-mail expéditeur
          </label>
          <input
            type="email"
            value={sourceEmail}
            onChange={(e) => setSourceEmail(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </section>
      )}

      {category === "tma" && enterpriseId && (
        <section>
          <label className="mb-1 block text-xs font-medium text-slate-500">
            E-mail expéditeur
          </label>
          <input
            type="email"
            value={sourceEmail}
            onChange={(e) => setSourceEmail(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </section>
      )}

      {error && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      {success && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {success}
        </p>
      )}

      <button
        type="button"
        disabled={!canSubmit}
        onClick={handleSubmit}
        className="w-full rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {isPending
          ? "Classement…"
          : category === "tma"
            ? "Déposer dans le suivi TMA"
            : category === "devis"
            ? devisMode === "signed"
              ? "Enregistrer le devis signé"
              : "Enregistrer dans le suivi devis"
            : category === "levee_controle" && selectedNcKeys.length > 0
              ? `Classer et lever (${selectedNcKeys.length})`
              : submitLabel}
      </button>
    </div>
  );
}
