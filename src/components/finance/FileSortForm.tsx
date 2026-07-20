"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  classifyIncomingFile,
  getQuickSortData,
  type QuickSortLot,
} from "@/lib/actions/incoming-files";
import {
  getOpenNcExecutionsForOutlook,
  uploadWorkControlAttestation,
} from "@/lib/actions/work-control";
import type { IncomingFileCategory } from "@/lib/types/database";
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
  compact?: boolean;
  submitLabel?: string;
  onSuccess?: (message: string) => void;
  onClassified?: () => void;
};

export function FileSortForm({
  projectId,
  file,
  sourceEmail: initialSourceEmail = "",
  defaultNotes = "",
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
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [ncRows, setNcRows] = useState<OpenNcRow[]>([]);
  const [loadingNc, setLoadingNc] = useState(false);
  const [selectedNcKeys, setSelectedNcKeys] = useState<string[]>([]);

  useEffect(() => {
    setSourceEmail(initialSourceEmail);
  }, [initialSourceEmail]);

  useEffect(() => {
    if (defaultNotes && !notes) {
      setNotes(defaultNotes);
    }
  }, [defaultNotes, notes]);

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

  function handleSubmit() {
    if (!file || !category || !enterpriseId) return;
    if (selectedCategory?.requiresSituation && !situationId) return;
    if (category === "levee_controle" && selectedNcKeys.length === 0) return;

    setError(null);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("category", category);
    formData.append("enterpriseId", enterpriseId);
    if (situationId) formData.append("situationId", situationId);
    if (sourceEmail) formData.append("sourceEmail", sourceEmail);
    if (notes) formData.append("notes", notes);

    startTransition(async () => {
      const result = await classifyIncomingFile(projectId, formData);
      if (!result.ok) {
        setError(normalizeClassifyError(result.error));
        return;
      }

      let lifted = 0;
      if (category === "levee_controle") {
        try {
          for (const key of selectedNcKeys) {
            const [checklistItemId, planLevelId] = key.split("::");
            if (!checklistItemId || !planLevelId) continue;
            const attForm = new FormData();
            attForm.set("file", file);
            await uploadWorkControlAttestation(
              projectId,
              checklistItemId,
              planLevelId,
              attForm
            );
            lifted++;
          }
        } catch (err) {
          setError(
            err instanceof Error
              ? `Classé, mais levée NC incomplète : ${err.message}`
              : "Classé, mais levée NC incomplète."
          );
          return;
        }
      }

      const message =
        category === "levee_controle"
          ? `« ${result.fileName} » classé en ${INCOMING_FILE_CATEGORY_LABELS[category]} — ${lifted} point(s) levé(s).`
          : `« ${result.fileName} » classé en ${INCOMING_FILE_CATEGORY_LABELS[category]}.`;
      setSuccess(message);
      setCategory(null);
      setEnterpriseId(null);
      setSituationId(null);
      setSelectedNcKeys([]);
      onSuccess?.(message);
      onClassified?.();
    });
  }

  const canSubmit =
    file &&
    category &&
    enterpriseId &&
    (!selectedCategory?.requiresSituation || situationId) &&
    (category !== "levee_controle" || selectedNcKeys.length > 0) &&
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

      {category && enterpriseId && (
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
          : category === "levee_controle" && selectedNcKeys.length > 0
            ? `Classer et lever (${selectedNcKeys.length})`
            : submitLabel}
      </button>
    </div>
  );
}
