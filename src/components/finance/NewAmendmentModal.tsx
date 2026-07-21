"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AppFormField } from "@/components/ui/AppFormField";
import { createAmendmentFromQuotes } from "@/lib/actions/finance";
import { getQuotesForAmendment } from "@/lib/actions/quotes";
import { buildAmendmentDocumentHtml } from "@/lib/finance/amendment-document";
import { formatCurrency, parseMoneyInput } from "@/lib/finance/calculations";
import type {
  FinancialQuote,
  LotWithFinancials,
  Project,
} from "@/lib/types/database";

type LineDraft = {
  id: string;
  designation: string;
  amount_ht: string;
  quote_id: string | null;
  selected: boolean;
};

type NewAmendmentModalProps = {
  project: Project;
  lots: LotWithFinancials[];
  open: boolean;
  onClose: () => void;
};

function formatLotOption(lot: LotWithFinancials): string {
  const left = [lot.lot_number, lot.designation].filter(Boolean).join(" ");
  return left ? `${left} — ${lot.name}` : lot.name;
}

export function NewAmendmentModal({
  project,
  lots,
  open,
  onClose,
}: NewAmendmentModalProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [enterpriseId, setEnterpriseId] = useState(lots[0]?.id ?? "");
  const [amendmentType, setAmendmentType] = useState<"ts" | "tma">("ts");
  const [availableQuotes, setAvailableQuotes] = useState<FinancialQuote[]>([]);
  const [loadingQuotes, setLoadingQuotes] = useState(false);
  const [manualLines, setManualLines] = useState<LineDraft[]>([]);
  const [selectedQuoteIds, setSelectedQuoteIds] = useState<Set<string>>(new Set());
  const [danobatComment, setDanobatComment] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"form" | "email">("form");
  const [emailDraft, setEmailDraft] = useState<{ subject: string; body: string } | null>(
    null
  );

  const selectedLot = useMemo(
    () => lots.find((lot) => lot.id === enterpriseId) ?? null,
    [lots, enterpriseId]
  );

  useEffect(() => {
    if (!open || !enterpriseId) return;

    setLoadingQuotes(true);
    getQuotesForAmendment(project.id, enterpriseId)
      .then((quotes) => {
        const filtered = quotes.filter((q) => !q.is_rejected);
        setAvailableQuotes(filtered);
        setSelectedQuoteIds(new Set());
      })
      .catch(() => setAvailableQuotes([]))
      .finally(() => setLoadingQuotes(false));
  }, [open, enterpriseId, project.id]);

  if (!open) return null;

  const selectedQuoteLines: LineDraft[] = availableQuotes
    .filter((quote) => selectedQuoteIds.has(quote.id))
    .map((quote) => ({
      id: quote.id,
      designation: quote.designation ?? `Devis ${quote.quote_number}`,
      amount_ht: String(quote.amount_ht),
      quote_id: quote.id,
      selected: true,
    }));

  const allLines = [...selectedQuoteLines, ...manualLines.filter((l) => l.designation.trim())];

  function toggleQuote(id: string) {
    setSelectedQuoteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function addManualLine() {
    setManualLines((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        designation: "",
        amount_ht: "",
        quote_id: null,
        selected: true,
      },
    ]);
  }

  function updateManualLine(id: string, field: "designation" | "amount_ht", value: string) {
    setManualLines((prev) =>
      prev.map((line) => (line.id === id ? { ...line, [field]: value } : line))
    );
  }

  function removeManualLine(id: string) {
    setManualLines((prev) => prev.filter((line) => line.id !== id));
  }

  const totalHt = allLines.reduce((sum, line) => {
    const amount = parseMoneyInput(line.amount_ht);
    return sum + (Number.isFinite(amount) ? amount : 0);
  }, 0);

  function handleCreate() {
    if (!selectedLot) {
      setError("Sélectionnez une entreprise.");
      return;
    }
    if (allLines.length === 0) {
      setError("Ajoutez au moins une ligne à l'avenant.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const lines = allLines.map((line) => ({
        designation: line.designation.trim(),
        amount_ht: parseMoneyInput(line.amount_ht),
        quote_id: line.quote_id,
      }));

      const documentHtml = buildAmendmentDocumentHtml({
        project,
        lot: selectedLot,
        amendmentNumber:
          (selectedLot.amendments?.reduce(
            (max, a) => Math.max(max, a.amendment_number),
            0
          ) ?? 0) + 1,
        amendmentType,
        lines,
        danobatComment,
      });

      const result = await createAmendmentFromQuotes(project.id, {
        enterpriseId,
        amendmentType,
        lines,
        danobatComment,
        documentHtml,
      });

      if (!result.ok) {
        setError(result.error);
        return;
      }

      setEmailDraft(result.emailDraft);
      setStep("email");
      router.refresh();
    });
  }

  function openMailClient() {
    if (!emailDraft) return;
    const mailto = `mailto:?subject=${encodeURIComponent(emailDraft.subject)}&body=${encodeURIComponent(emailDraft.body)}`;
    window.location.href = mailto;
  }

  function handleClose() {
    setStep("form");
    setEmailDraft(null);
    setError(null);
    setManualLines([]);
    setSelectedQuoteIds(new Set());
    setDanobatComment("");
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white shadow-xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4">
          <h3 className="text-lg font-semibold text-slate-900">
            {step === "form" ? "Création AVENANT" : "Mail type — envoi à l'entreprise"}
          </h3>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-lg px-3 py-1 text-sm text-slate-500 hover:bg-slate-100"
          >
            Fermer
          </button>
        </div>

        {step === "form" ? (
          <div className="space-y-4 p-5">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Lot / Entreprise
              </label>
              <select
                value={enterpriseId}
                onChange={(e) => setEnterpriseId(e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              >
                {lots.map((lot) => (
                  <option key={lot.id} value={lot.id}>
                    {formatLotOption(lot)}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-4">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="amendmentType"
                  checked={amendmentType === "tma"}
                  onChange={() => setAmendmentType("tma")}
                />
                TMA
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="amendmentType"
                  checked={amendmentType === "ts"}
                  onChange={() => setAmendmentType("ts")}
                />
                TS
              </label>
            </div>

            <div>
              <p className="mb-2 text-sm font-medium text-slate-700">
                Devis validés ou sans réponse
              </p>
              {loadingQuotes ? (
                <p className="text-sm text-slate-500">Chargement des devis…</p>
              ) : availableQuotes.length === 0 ? (
                <p className="text-sm text-slate-500">
                  Aucun devis disponible pour cette entreprise.
                </p>
              ) : (
                <div className="max-h-40 overflow-y-auto rounded-lg border border-slate-200">
                  {availableQuotes.map((quote) => (
                    <label
                      key={quote.id}
                      className="flex cursor-pointer items-center gap-2 border-b border-slate-100 px-3 py-2 text-sm last:border-b-0 hover:bg-slate-50"
                    >
                      <input
                        type="checkbox"
                        checked={selectedQuoteIds.has(quote.id)}
                        onChange={() => toggleQuote(quote.id)}
                      />
                      <span className="flex-1">
                        {quote.quote_number || "Devis"} — {quote.designation ?? ""}
                      </span>
                      <span className="tabular-nums text-slate-600">
                        {formatCurrency(Number(quote.amount_ht))}
                      </span>
                      <span className="text-xs text-slate-400">
                        {quote.validated_at
                          ? `Validé ${new Date(quote.validated_at).toLocaleDateString("fr-FR")}`
                          : "Sans réponse"}
                      </span>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="text-sm font-medium text-slate-700">
                  Détail du présent avenant
                </p>
                <button
                  type="button"
                  onClick={addManualLine}
                  className="text-sm text-blue-600 hover:text-blue-800"
                >
                  + Ligne manuelle
                </button>
              </div>
              <div className="space-y-2">
                {allLines.map((line) => (
                  <div key={line.id} className="flex gap-2">
                    <input
                      type="text"
                      value={line.designation}
                      readOnly={Boolean(line.quote_id)}
                      onChange={(e) =>
                        !line.quote_id &&
                        updateManualLine(line.id, "designation", e.target.value)
                      }
                      placeholder="Désignation"
                      className="flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm"
                    />
                    <input
                      type="text"
                      inputMode="decimal"
                      value={line.amount_ht}
                      readOnly={Boolean(line.quote_id)}
                      onChange={(e) =>
                        !line.quote_id &&
                        updateManualLine(line.id, "amount_ht", e.target.value)
                      }
                      placeholder="Montant HT"
                      className="w-32 rounded border border-slate-300 px-2 py-1.5 text-sm text-right"
                    />
                    {!line.quote_id && (
                      <button
                        type="button"
                        onClick={() => removeManualLine(line.id)}
                        className="text-red-500"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
              <p className="mt-2 text-right text-sm font-semibold">
                Total avenant : {formatCurrency(totalHt)}
              </p>
            </div>

            <AppFormField
              label="Commentaire suivie DANOBAT"
              name="danobat_comment"
              value={danobatComment}
              onChange={setDanobatComment}
            />

            {error && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={handleCreate}
              disabled={isPending}
              className="w-full rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
            >
              {isPending ? "Création…" : "Création AVENANT"}
            </button>
          </div>
        ) : (
          <div className="space-y-4 p-5">
            <p className="text-sm text-slate-600">
              L&apos;avenant a été créé. Les devis cités sont liés. Utilisez le mail type ci-dessous pour l&apos;envoyer à l&apos;entreprise (devis et avenant à joindre manuellement).
            </p>
            <div>
              <p className="text-xs font-semibold uppercase text-slate-400">Objet</p>
              <p className="mt-1 text-sm">{emailDraft?.subject}</p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase text-slate-400">Corps</p>
              <pre className="mt-1 whitespace-pre-wrap rounded-lg bg-slate-50 p-3 text-sm">
                {emailDraft?.body}
              </pre>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={openMailClient}
                className="flex-1 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
              >
                Ouvrir dans Outlook
              </button>
              <button
                type="button"
                onClick={handleClose}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Terminer
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
