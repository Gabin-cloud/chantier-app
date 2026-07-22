"use client";

import { useEffect, useState, useTransition } from "react";
import { AppFormField } from "@/components/ui/AppFormField";
import { ModalPanel } from "@/components/ui/ModalPanel";
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
  const requestEntryId = entry.id.startsWith("seed-")
    ? entry.id.replace(/^seed-/, "")
    : undefined;
  return {
    id: entry.id.startsWith("seed-") ? undefined : entry.id,
    requestEntryId,
    localisation: entry.localisation,
    natureTravaux: entry.nature_travaux,
    montantHt: entry.montant_ht,
    isRequestLine: Boolean(requestEntryId) || entry.is_request_line,
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
  const [depositPdfUrl, setDepositPdfUrl] = useState<string | null>(null);
  const [depositFileName, setDepositFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showMarketPrice, setShowMarketPrice] = useState(false);

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
      setLines(
        result.entries.map((entry) => {
          const line = entryToLine(entry);
          if (!line.requestEntryId && result.requestLines.length) {
            const match = result.requestLines.find(
              (req) =>
                req.localisation.trim() === entry.localisation.trim() &&
                req.nature_travaux.trim() === entry.nature_travaux.trim()
            );
            if (match) {
              line.requestEntryId = match.id;
              line.isRequestLine = true;
            }
          }
          return line;
        })
      );
      setRequestLines(result.requestLines);
      setContractAmountHt(result.contractAmountHt);
      setLogementNumber(first.logement_number);
      setEnterpriseId(first.enterprise_id);
      setEnterpriseName(first.enterprise_name);
      setDossierId(first.dossier_id);
      setQuoteId(first.quote_id);
      setDepositFileName(result.depositFileName);

      if (result.depositFilePath) {
        const url = await getQuoteFileUrl(projectId, result.depositFilePath);
        if (!cancelled) setDepositPdfUrl(url);
      } else {
        setDepositPdfUrl(null);
      }

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

  function addLine() {
    setLines((prev) => [
      ...prev,
      { localisation: "", natureTravaux: "", montantHt: 0, isRequestLine: false },
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
      maxWidth="fullscreen"
    >
      {loading ? (
        <p className="text-sm text-slate-500">Chargement…</p>
      ) : loadError ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{loadError}</p>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col space-y-4">
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
          </div>

          <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-[1.2fr_0.8fr]">
            <section className="flex min-h-0 flex-col rounded-lg border border-slate-200 bg-slate-50">
              <header className="border-b border-slate-200 px-3 py-2 text-xs font-semibold uppercase text-slate-500">
                Devis entreprise
              </header>
              {depositPdfUrl ? (
                <iframe
                  src={depositPdfUrl}
                  title={depositFileName ?? "Devis TMA"}
                  className="min-h-0 flex-1 w-full bg-white"
                  style={{ minHeight: "70vh" }}
                />
              ) : (
                <p className="flex flex-1 items-center justify-center p-4 text-sm text-slate-500">
                  Aucun PDF de dépôt disponible.
                </p>
              )}
            </section>

            <section className="space-y-3">
              {requestLines.length > 0 && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2">
                  <h3 className="text-[10px] font-bold uppercase text-slate-500">
                    Demande initiale ({enterpriseName})
                  </h3>
                  <ul className="mt-1 space-y-0.5 text-xs text-slate-600">
                    {requestLines.map((req) => (
                      <li key={req.id}>
                        {req.localisation || "—"} — {req.nature_travaux || "—"}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="w-full border-collapse text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-left text-xs font-semibold text-slate-600">
                      <th className="border-b border-slate-200 px-2 py-2">Localisation</th>
                      <th className="border-b border-slate-200 px-2 py-2">Nature des travaux</th>
                      <th className="border-b border-slate-200 px-2 py-2 text-right">
                        Montant H.T.
                      </th>
                      <th className="w-8 border-b border-slate-200" />
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, index) => (
                      <tr key={line.id ?? `line-${index}`} className="border-b border-slate-100">
                        <td className="px-2 py-1 align-top">
                          <input
                            type="text"
                            value={line.localisation}
                            onChange={(e) =>
                              updateLine(index, { localisation: e.target.value })
                            }
                            className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs"
                          />
                        </td>
                        <td className="px-2 py-1 align-top">
                          <input
                            type="text"
                            value={line.natureTravaux}
                            onChange={(e) =>
                              updateLine(index, { natureTravaux: e.target.value })
                            }
                            className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs"
                          />
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
                    onClick={addLine}
                    className="text-xs font-semibold text-violet-600 hover:underline"
                  >
                    + Ajouter une ligne
                  </button>
                </div>
              </div>
            </section>
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
