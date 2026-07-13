"use client";

import { useEffect, useState, useTransition } from "react";
import {
  classifyIncomingFile,
  getQuickSortData,
  type QuickSortLot,
} from "@/lib/actions/incoming-files";
import type { IncomingFileCategory } from "@/lib/types/database";
import { INCOMING_FILE_CATEGORY_LABELS } from "@/lib/types/database";

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
];

export function formatLotLabel(lot: QuickSortLot) {
  if (lot.lot_number && lot.designation) {
    return `Lot ${lot.lot_number} — ${lot.designation}`;
  }
  if (lot.lot_number) return `Lot ${lot.lot_number}`;
  return lot.name;
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

  const selectedLot = lots.find((l) => l.id === enterpriseId);
  const selectedCategory = FILE_SORT_CATEGORIES.find((c) => c.id === category);

  function handleSubmit() {
    if (!file || !category || !enterpriseId) return;
    if (selectedCategory?.requiresSituation && !situationId) return;

    setError(null);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("category", category);
    formData.append("enterpriseId", enterpriseId);
    if (situationId) formData.append("situationId", situationId);
    if (sourceEmail) formData.append("sourceEmail", sourceEmail);
    if (notes) formData.append("notes", notes);

    startTransition(async () => {
      try {
        await classifyIncomingFile(projectId, formData);
        const message = `« ${file.name} » classé en ${INCOMING_FILE_CATEGORY_LABELS[category]}.`;
        setSuccess(message);
        setCategory(null);
        setEnterpriseId(null);
        setSituationId(null);
        onSuccess?.(message);
        onClassified?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur lors du classement.");
      }
    });
  }

  const canSubmit =
    file &&
    category &&
    enterpriseId &&
    (!selectedCategory?.requiresSituation || situationId) &&
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
        {isPending ? "Classement…" : submitLabel}
      </button>
    </div>
  );
}
