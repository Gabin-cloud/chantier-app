"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updateQuoteValidation, getQuoteFileUrl } from "@/lib/actions/quotes";
import { formatCurrency } from "@/lib/finance/calculations";
import type { FinancialQuoteWithLot } from "@/lib/types/database";

type QuoteTrackingTableProps = {
  projectId: string;
  quotes: FinancialQuoteWithLot[];
};

type LotGroup = {
  lotNumber: string;
  enterpriseName: string;
  lotDesignation: string | null;
  quotes: FinancialQuoteWithLot[];
};

function formatValidatedCell(quote: FinancialQuoteWithLot): string {
  if (quote.is_rejected) return "non";
  if (quote.validated_at) {
    return new Date(quote.validated_at).toLocaleDateString("fr-FR");
  }
  return "";
}

function groupQuotes(quotes: FinancialQuoteWithLot[]): LotGroup[] {
  const map = new Map<string, LotGroup>();

  for (const quote of quotes) {
    const key = quote.enterprise_id;
    const existing = map.get(key);
    if (existing) {
      existing.quotes.push(quote);
    } else {
      map.set(key, {
        lotNumber: quote.lot_number ?? "",
        enterpriseName: quote.enterprise_name,
        lotDesignation: quote.lot_designation,
        quotes: [quote],
      });
    }
  }

  return Array.from(map.values()).sort((a, b) =>
    a.lotNumber.localeCompare(b.lotNumber, "fr", { numeric: true })
  );
}

export function QuoteTrackingTable({ projectId, quotes }: QuoteTrackingTableProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [validatedInput, setValidatedInput] = useState("");
  const groups = useMemo(() => groupQuotes(quotes), [quotes]);

  async function openQuote(quote: FinancialQuoteWithLot) {
    const filePath = quote.signed_file_path ?? quote.file_path;
    if (!filePath) return;
    const url = await getQuoteFileUrl(projectId, filePath);
    window.open(url, "_blank", "noopener,noreferrer");
  }

  function startEditValidation(quote: FinancialQuoteWithLot) {
    setEditingId(quote.id);
    if (quote.is_rejected) {
      setValidatedInput("non");
    } else if (quote.validated_at) {
      setValidatedInput(quote.validated_at);
    } else {
      setValidatedInput("");
    }
  }

  function saveValidation(quoteId: string) {
    startTransition(async () => {
      const trimmed = validatedInput.trim().toLowerCase();
      const isRejected = trimmed === "non";
      const validatedAt =
        !isRejected && trimmed
          ? trimmed
          : isRejected
            ? null
            : null;

      await updateQuoteValidation(projectId, quoteId, validatedAt, isRejected);
      setEditingId(null);
      router.refresh();
    });
  }

  const BORDER = "border border-black";

  return (
    <section className="overflow-x-auto rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="mb-1 text-lg font-semibold text-slate-900">Suivi des devis</h2>
      <p className="mb-4 text-sm text-slate-500">
        Cliquez sur le N° devis pour ouvrir le document. Saisissez une date ou « non » dans Validé.
      </p>

      {groups.length === 0 ? (
        <p className="text-sm text-slate-500">
          Aucun devis enregistré. Utilisez l&apos;onglet Outlook « Suivi devis » pour classer les devis reçus par mail.
        </p>
      ) : (
        <table className={`w-full min-w-[1200px] border-collapse text-sm ${BORDER}`}>
          <thead>
            <tr className="bg-slate-100 text-left font-bold">
              <th className={`${BORDER} px-2 py-2 text-center`}>Lot</th>
              <th className={`${BORDER} px-2 py-2`}>Entreprise</th>
              <th className={`${BORDER} px-2 py-2`}>N° devis</th>
              <th className={`${BORDER} px-2 py-2`}>Date</th>
              <th className={`${BORDER} px-2 py-2 text-center`}>CIE</th>
              <th className={`${BORDER} px-2 py-2 text-center`}>TS</th>
              <th className={`${BORDER} px-2 py-2 text-center`}>TMA</th>
              <th className={`${BORDER} px-2 py-2`}>Désignation</th>
              <th className={`${BORDER} px-2 py-2 text-right`}>Montant H.T.</th>
              <th className={`${BORDER} px-2 py-2`}>Validé</th>
              <th className={`${BORDER} px-2 py-2`}>Avenant</th>
              <th className={`${BORDER} px-2 py-2`}>Commentaire</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) =>
              group.quotes.map((quote, index) => (
                <tr key={quote.id} className="hover:bg-slate-50">
                  {index === 0 && (
                    <>
                      <td
                        rowSpan={group.quotes.length}
                        className={`${BORDER} px-2 py-2 text-center align-middle font-medium`}
                      >
                        {group.lotNumber}
                      </td>
                      <td
                        rowSpan={group.quotes.length}
                        className={`${BORDER} px-2 py-2 align-middle font-medium`}
                      >
                        {group.enterpriseName}
                      </td>
                    </>
                  )}
                  <td className={`${BORDER} px-2 py-2`}>
                    {quote.file_path || quote.signed_file_path ? (
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
                    {new Date(quote.quote_date).toLocaleDateString("fr-FR")}
                  </td>
                  <td className={`${BORDER} px-2 py-2 text-center`}>
                    {quote.is_cie ? "✓" : ""}
                  </td>
                  <td className={`${BORDER} px-2 py-2 text-center`}>
                    {quote.is_ts ? "✓" : ""}
                  </td>
                  <td className={`${BORDER} px-2 py-2 text-center`}>
                    {quote.is_tma ? "✓" : ""}
                  </td>
                  <td className={`${BORDER} px-2 py-2`}>{quote.designation ?? "—"}</td>
                  <td className={`${BORDER} px-2 py-2 text-right tabular-nums`}>
                    {formatCurrency(Number(quote.amount_ht))}
                  </td>
                  <td className={`${BORDER} px-2 py-2`}>
                    {editingId === quote.id ? (
                      <div className="flex items-center gap-1">
                        <input
                          type="text"
                          value={validatedInput}
                          onChange={(e) => setValidatedInput(e.target.value)}
                          placeholder="date ou non"
                          className="w-24 rounded border border-slate-300 px-1 py-0.5 text-xs"
                          disabled={isPending}
                        />
                        <button
                          type="button"
                          onClick={() => saveValidation(quote.id)}
                          className="text-xs text-blue-600"
                          disabled={isPending}
                        >
                          OK
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => startEditValidation(quote)}
                        className="min-w-[4rem] text-left hover:text-blue-600"
                        title="Cliquer pour modifier"
                      >
                        {formatValidatedCell(quote) || "—"}
                      </button>
                    )}
                  </td>
                  <td className={`${BORDER} px-2 py-2`}>
                    {quote.amendment_id ? "✓" : ""}
                  </td>
                  <td className={`${BORDER} px-2 py-2`}>{quote.comment ?? ""}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      )}
    </section>
  );
}
