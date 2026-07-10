"use client";

import { useEffect } from "react";
import {
  computeSituation,
  formatCurrency,
  formatDateFr,
  formatPercent,
} from "@/lib/finance/calculations";
import type {
  FinancialSituation,
  FinancialSituationDelegation,
  LotWithFinancials,
  Project,
} from "@/lib/types/database";

type SituationCertificateProps = {
  project: Project;
  lot: LotWithFinancials;
  situation: FinancialSituation;
  delegations?: FinancialSituationDelegation[];
  autoPrint?: boolean;
};

export function SituationCertificate({
  project,
  lot,
  situation,
  delegations = [],
  autoPrint = false,
}: SituationCertificateProps) {
  const situations = lot.situations ?? [];
  const previousSituation =
    situations.find((s) => s.situation_number === situation.situation_number - 1) ??
    null;

  const computed = computeSituation({
    contractAmountHt: Number(lot.contract_amount_ht),
    vatRate: Number(lot.vat_rate),
    prorataPercent: Number(lot.prorata_percent),
    amendments: lot.amendments ?? [],
    situation,
    previousSituation,
  });

  useEffect(() => {
    if (autoPrint) {
      const timer = setTimeout(() => window.print(), 400);
      return () => clearTimeout(timer);
    }
  }, [autoPrint]);

  const amendments = lot.amendments ?? [];
  const amendmentRows = Array.from({ length: 10 }, (_, i) => {
    const a = amendments.find((am) => am.amendment_number === i + 1);
    return a ?? null;
  });

  return (
    <div className="certificate-root mx-auto max-w-4xl bg-white p-8 text-sm text-slate-900 print:p-0">
      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .certificate-root,
          .certificate-root * {
            visibility: visible;
          }
          .certificate-root {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .no-print {
            display: none !important;
          }
        }
      `}</style>

      <div className="no-print mb-6 flex gap-3">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500"
        >
          Imprimer / Enregistrer en PDF
        </button>
      </div>

      <header className="mb-6 border-b border-slate-300 pb-4">
        <p className="text-xs uppercase tracking-wide text-slate-500">
          Attestation de situation de travaux
        </p>
        <h1 className="mt-2 text-xl font-bold">
          {project.client_name ?? project.name}
        </h1>
        <p className="text-slate-600">
          Toulouse, le {formatDateFr(situation.situation_date)}
        </p>
      </header>

      <section className="mb-6 grid grid-cols-2 gap-4">
        <div>
          <p>
            <span className="font-semibold">Lot :</span> {lot.lot_number} —{" "}
            {lot.designation}
          </p>
          <p>
            <span className="font-semibold">Entreprise :</span> {lot.name}
          </p>
          {lot.enterprise_address && (
            <p>
              <span className="font-semibold">Adresse :</span>{" "}
              {lot.enterprise_address}
            </p>
          )}
        </div>
        <div className="text-right">
          <p className="font-semibold">
            SITUATION N° {situation.situation_number}
          </p>
          <p>DU : {formatDateFr(situation.situation_date)}</p>
        </div>
      </section>

      <section className="mb-6 grid grid-cols-2 gap-6">
        <div>
          <h2 className="mb-2 font-semibold">Montant du marché</h2>
          <table className="w-full">
            <tbody>
              <tr>
                <td>MONTANT H.T.</td>
                <td className="text-right">{formatCurrency(computed.contractAmountHt)}</td>
              </tr>
              <tr>
                <td>T.V.A. {lot.vat_rate} %</td>
                <td className="text-right">
                  {formatCurrency(computed.contractAmountTtc - computed.contractAmountHt)}
                </td>
              </tr>
              <tr>
                <td className="font-semibold">MONTANT T.T.C.</td>
                <td className="text-right font-semibold">
                  {formatCurrency(computed.contractAmountTtc)}
                </td>
              </tr>
            </tbody>
          </table>
          <p className="mt-3 text-xs text-slate-500">
            Conditions de règlement : {lot.payment_terms ?? project.default_payment_terms ?? "30 JOURS"}
          </p>
        </div>

        <div>
          <h2 className="mb-2 font-semibold">Avenants</h2>
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="py-1 text-left">N°</th>
                <th className="py-1 text-right">H.T.</th>
                <th className="py-1 text-right">T.T.C.</th>
              </tr>
            </thead>
            <tbody>
              {amendmentRows.map((a, i) => (
                <tr key={i}>
                  <td>{i + 1}</td>
                  <td className="text-right">
                    {a ? formatCurrency(Number(a.amount_ht)) : "—"}
                  </td>
                  <td className="text-right">
                    {a ? formatCurrency(Number(a.amount_ttc)) : "—"}
                  </td>
                </tr>
              ))}
              <tr className="border-t border-slate-200 font-semibold">
                <td>TOTAL MARCHÉ + AVENANTS</td>
                <td className="text-right">{formatCurrency(computed.totalMarketHt)}</td>
                <td className="text-right">{formatCurrency(computed.totalMarketTtc)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-6">
        <h2 className="mb-2 font-semibold">Détail de la situation — Montants H.T.</h2>
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b-2 border-slate-300">
              <th className="py-2 text-left">Libellé</th>
              <th className="py-2 text-right">Cumul</th>
              <th className="py-2 text-right">Cumul précédent</th>
              <th className="py-2 text-right">Situation</th>
            </tr>
          </thead>
          <tbody>
            {computed.lines.map((line) => (
              <tr key={line.label} className="border-b border-slate-100">
                <td className="py-1.5">{line.label}</td>
                <td className="py-1.5 text-right">
                  {line.label === "Avancement de la situation"
                    ? formatPercent(line.cumulative)
                    : formatCurrency(line.cumulative)}
                </td>
                <td className="py-1.5 text-right">
                  {line.label === "Avancement de la situation"
                    ? "—"
                    : formatCurrency(line.previous)}
                </td>
                <td className="py-1.5 text-right font-medium">
                  {line.label === "Avancement de la situation"
                    ? formatPercent(line.period)
                    : formatCurrency(line.period)}
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-slate-300">
              <td className="py-2 font-semibold">T.V.A. {lot.vat_rate} %</td>
              <td className="py-2 text-right">{formatCurrency(computed.vatAmount)}</td>
              <td className="py-2 text-right">{formatCurrency(computed.vatPreviousAmount)}</td>
              <td className="py-2 text-right font-semibold">
                {formatCurrency(computed.vatPeriodAmount)}
              </td>
            </tr>
            <tr className="font-bold">
              <td className="py-2">TOTAL T.T.C.</td>
              <td className="py-2 text-right">{formatCurrency(computed.totalTtc)}</td>
              <td className="py-2 text-right">{formatCurrency(computed.totalPreviousTtc)}</td>
              <td className="py-2 text-right">{formatCurrency(computed.totalPeriodTtc)}</td>
            </tr>
          </tbody>
        </table>
      </section>

      {delegations.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 font-semibold">Ventilation des règlements en délégation</h2>
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="py-1 text-left">Entreprise</th>
                <th className="py-1 text-right">Montant délégation</th>
                <th className="py-1 text-right">Cumul T.T.C.</th>
                <th className="py-1 text-right">Situation du mois</th>
              </tr>
            </thead>
            <tbody>
              {delegations.map((d) => (
                <tr key={d.id}>
                  <td>{d.company_name}</td>
                  <td className="text-right">{formatCurrency(Number(d.delegation_amount))}</td>
                  <td className="text-right">{formatCurrency(Number(d.cumulative_ttc))}</td>
                  <td className="text-right">
                    {formatCurrency(
                      Number(d.cumulative_ttc) - Number(d.previous_cumulative_ttc)
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      <footer className="mt-10 grid grid-cols-2 gap-8 border-t border-slate-300 pt-6">
        <div>
          <p className="font-semibold">Le Maître d&apos;œuvre</p>
          <div className="mt-12 h-16 border-b border-slate-300" />
        </div>
        <div>
          <p className="font-semibold">Le Maître d&apos;ouvrage</p>
          <div className="mt-12 h-16 border-b border-slate-300" />
        </div>
      </footer>
    </div>
  );
}
