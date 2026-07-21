"use client";

import { useEffect, useState, useTransition } from "react";
import { AppFormField } from "@/components/ui/AppFormField";
import { ModalPanel } from "@/components/ui/ModalPanel";
import { useOpenDocument } from "@/components/documents/DocumentLink";
import { getQuoteFileUrl } from "@/lib/actions/quotes";
import {
  getTmaAnalysisContext,
  saveTmaAnalysis,
  type TmaAnalysisLineInput,
} from "@/lib/actions/tma";
import { formatCurrency } from "@/lib/finance/calculations";
import type { WorkTmaEntry } from "@/lib/types/database";

type AnalysisLine = TmaAnalysisLineInput & { id?: string };

type TmaAnalysisModalProps = {
  projectId: string;
  entryIds: string[];
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
};

function entryToLine(entry: WorkTmaEntry): AnalysisLine {
  return {
    id: entry.id,
    localisation: entry.localisation,
    natureTravaux: entry.nature_travaux,
    montantHt: entry.montant_ht,
    isRequestLine: entry.is_request_line,
  };
}

export function TmaAnalysisModal({
  projectId,
  entryIds,
  open,
  onClose,
  onSaved,
}: TmaAnalysisModalProps) {
  const [isPending, startTransition] = useTransition();
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lines, setLines] = useState<AnalysisLine[]>([]);
  const [requestLines, setRequestLines] = useState<WorkTmaEntry[]>([]);
  const [contractAmountHt, setContractAmountHt] = useState(0);
  const [logementNumber, setLogementNumber] = useState("");
  const [enterpriseId, setEnterpriseId] = useState<string | null>(null);
  const [enterpriseName, setEnterpriseName] = useState("");
  const [dossierId, setDossierId] = useState<string | null>(null);
  const [quoteId, setQuoteId] = useState<string | null>(null);
  const [depositFilePath, setDepositFilePath] = useState<string | null>(null);
  const [depositFileName, setDepositFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showMarketPrice, setShowMarketPrice] = useState(false);
  const { openDocument } = useOpenDocument();

  useEffect(() => {
    if (!open || !entryIds.length) return;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setLoadError(null);
      const result = await getTmaAnalysisContext(projectId, entryIds);
      if (cancelled) return;
      if (!result.ok) {
        setLoadError(result.error);
        setLoading(false);
        return;
      }

      const first = result.entries[0];
      setLines(result.entries.map(entryToLine));
      setRequestLines(result.requestLines);
      setContractAmountHt(result.contractAmountHt);
      setLogementNumber(first.logement_number);
      setEnterpriseId(first.enterprise_id);
      setEnterpriseName(first.enterprise_name);
      setDossierId(first.dossier_id);
      setQuoteId(first.quote_id);
      setDepositFilePath(first.deposit_file_path);
      setDepositFileName(first.deposit_file_name);
      setLoading(false);
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [open, projectId, entryIds]);

  if (!open) return null;

  function updateLine(index: number, patch: Partial<AnalysisLine>) {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function addLine(fromRequest?: WorkTmaEntry) {
    setLines((prev) => [
      ...prev,
      fromRequest
        ? {
            localisation: fromRequest.localisation,
            natureTravaux: fromRequest.nature_travaux,
            montantHt: 0,
            isRequestLine: true,
          }
        : {
            localisation: "",
            natureTravaux: "",
            montantHt: 0,
            isRequestLine: false,
          },
    ]);
  }

  function removeLine(index: number) {
    setLines((prev) => prev.filter((_, i) => i !== index));
  }

  function handleSave(markAnalyzed: boolean) {
    setError(null);
    startTransition(async () => {
      const result = await saveTmaAnalysis(projectId, {
        entryIds,
        logementNumber,
        enterpriseId,
        enterpriseName,
        dossierId,
        quoteId,
        lines,
        markAnalyzed,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSaved();
      onClose();
    });
  }

  const totalHt = lines.reduce((sum, l) => sum + (l.montantHt || 0), 0);

  return (
    <ModalPanel
      title="Analyse du dépôt TMA"
      subtitle={`Logement ${logementNumber || "—"} — ${enterpriseName || "Entreprise"}`}
      onClose={onClose}
      maxWidth="2xl"
    >
      {loading ? (
        <p className="text-sm text-slate-500">Chargement…</p>
      ) : loadError ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{loadError}</p>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setShowMarketPrice((v) => !v)}
              className="rounded-lg border border-violet-300 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-800 hover:bg-violet-100"
            >
              {showMarketPrice ? "Masquer" : "Voir"} le montant marché H.T.
            </button>
            {showMarketPrice && (
              <span className="text-sm font-semibold text-violet-700">
                Marché : {formatCurrency(contractAmountHt)}
              </span>
            )}
            {depositFilePath && (
              <button
                type="button"
                onClick={async () => {
                  const url = await getQuoteFileUrl(projectId, depositFilePath);
                  openDocument(url, depositFileName ?? "Dépôt TMA");
                }}
                className="text-xs font-semibold text-blue-600 hover:underline"
              >
                Ouvrir le dépôt PDF
              </button>
            )}
          </div>

          {requestLines.length > 0 && (
            <section className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <h3 className="text-xs font-bold uppercase text-slate-500">
                Demande initiale (référence)
              </h3>
              <ul className="mt-2 space-y-1 text-xs text-slate-700">
                {requestLines.map((req) => (
                  <li key={req.id} className="flex flex-wrap gap-2">
                    <span className="font-medium">{req.localisation || "—"}</span>
                    <span>—</span>
                    <span>{req.nature_travaux || "—"}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 text-left text-xs font-semibold text-slate-600">
                  <th className="border-b border-slate-200 px-2 py-2">Localisation</th>
                  <th className="border-b border-slate-200 px-2 py-2">Nature des travaux</th>
                  <th className="border-b border-slate-200 px-2 py-2 text-right">Montant H.T.</th>
                  <th className="w-8 border-b border-slate-200 px-1 py-2" />
                </tr>
              </thead>
              <tbody>
                {lines.map((line, index) => (
                  <tr key={line.id ?? `new-${index}`} className="border-b border-slate-100">
                    <td className="px-2 py-1 align-top">
                      <input
                        type="text"
                        value={line.localisation}
                        onChange={(e) => updateLine(index, { localisation: e.target.value })}
                        className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs"
                      />
                    </td>
                    <td className="px-2 py-1 align-top">
                      <input
                        type="text"
                        value={line.natureTravaux}
                        onChange={(e) => updateLine(index, { natureTravaux: e.target.value })}
                        className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs"
                      />
                      {!line.isRequestLine && (
                        <span className="mt-0.5 block text-[10px] text-amber-600">
                          Ligne ajoutée à l&apos;analyse
                        </span>
                      )}
                    </td>
                    <td className="px-2 py-1 align-top">
                      <AppFormField
                        label=""
                        name={`montant_${index}`}
                        format="money"
                        value={line.montantHt ? String(line.montantHt) : ""}
                        onChange={(v) =>
                          updateLine(index, {
                            montantHt:
                              parseFloat(v.replace(/\s/g, "").replace(",", ".")) || 0,
                          })
                        }
                      />
                    </td>
                    <td className="px-1 py-1 text-center align-top">
                      {lines.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeLine(index)}
                          className="text-slate-400 hover:text-red-600"
                        >
                          ✕
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-semibold">
                  <td colSpan={2} className="px-2 py-2 text-right text-xs">
                    Total H.T.
                  </td>
                  <td className="px-2 py-2 text-right text-xs tabular-nums">
                    {formatCurrency(totalHt)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
            <div className="border-t border-slate-200 px-2 py-2">
              <button
                type="button"
                onClick={() => addLine()}
                className="text-xs font-semibold text-violet-600 hover:underline"
              >
                + Ajouter une ligne
              </button>
            </div>
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
          )}

          <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Annuler
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleSave(false)}
              className="rounded-lg border border-violet-300 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-800 hover:bg-violet-100 disabled:opacity-50"
            >
              {isPending ? "Enregistrement…" : "Enregistrer brouillon"}
            </button>
            <button
              type="button"
              disabled={isPending}
              onClick={() => handleSave(true)}
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
            >
              {isPending ? "Enregistrement…" : "Valider l'analyse"}
            </button>
          </div>
        </div>
      )}
    </ModalPanel>
  );
}
