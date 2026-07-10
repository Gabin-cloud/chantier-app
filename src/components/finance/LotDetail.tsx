"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  deleteAmendment,
  upsertAmendment,
  upsertLot,
} from "@/lib/actions/finance";
import {
  computeAmendmentsTotals,
  computeContractTtc,
  formatCurrency,
} from "@/lib/finance/calculations";
import type { LotWithFinancials, Project } from "@/lib/types/database";

const inputClass =
  "w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-800 placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none";

type LotDetailProps = {
  project: Project;
  lot: LotWithFinancials;
};

export function LotDetail({ project, lot }: LotDetailProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const amendments = lot.amendments ?? [];
  const { totalHt: amendmentsTotalHt } = computeAmendmentsTotals(amendments);
  const contractTtc = computeContractTtc(
    Number(lot.contract_amount_ht),
    Number(lot.vat_rate)
  );

  function handleUpdateLot(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const form = new FormData(e.currentTarget);

    startTransition(async () => {
      try {
        await upsertLot(
          project.id,
          {
            lot_number: (form.get("lot_number") as string).trim(),
            designation: (form.get("designation") as string).trim(),
            name: (form.get("name") as string).trim(),
            enterprise_address:
              (form.get("enterprise_address") as string).trim() || undefined,
            contract_amount_ht: Number(form.get("contract_amount_ht")),
            prorata_percent: Number(form.get("prorata_percent")) / 100,
            payment_terms: (form.get("payment_terms") as string).trim() || undefined,
            vat_rate: Number(form.get("vat_rate") || 20),
          },
          lot.id
        );
        setSuccess("Lot mis à jour.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Une erreur est survenue.");
      }
    });
  }

  function handleAddAmendment(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const form = new FormData(e.currentTarget);
    const nextNumber =
      amendments.length > 0
        ? Math.max(...amendments.map((a) => a.amendment_number)) + 1
        : 1;

    startTransition(async () => {
      try {
        await upsertAmendment(project.id, lot.id, {
          amendment_number: Number(form.get("amendment_number") || nextNumber),
          designation: (form.get("designation") as string).trim() || undefined,
          os_number: (form.get("os_number") as string).trim() || undefined,
          amount_ht: Number(form.get("amount_ht")),
        });
        e.currentTarget.reset();
        setSuccess("Avenant ajouté.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Une erreur est survenue.");
      }
    });
  }

  function handleDeleteAmendment(amendmentId: string) {
    if (!confirm("Supprimer cet avenant ?")) return;

    startTransition(async () => {
      try {
        await deleteAmendment(project.id, lot.id, amendmentId);
        setSuccess("Avenant supprimé.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Une erreur est survenue.");
      }
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">
          Lot {lot.lot_number} — {lot.designation}
        </h2>

        <form onSubmit={handleUpdateLot} className="space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <input name="lot_number" required defaultValue={lot.lot_number ?? ""} className={inputClass} />
            <input name="designation" required defaultValue={lot.designation ?? ""} className={inputClass} />
            <input name="name" required defaultValue={lot.name} className={inputClass} />
            <input name="enterprise_address" defaultValue={lot.enterprise_address ?? ""} className={inputClass} />
            <input name="contract_amount_ht" required type="number" step="0.01" defaultValue={lot.contract_amount_ht} className={inputClass} />
            <input name="prorata_percent" type="number" step="0.001" defaultValue={(Number(lot.prorata_percent) * 100).toFixed(3)} className={inputClass} />
            <input name="vat_rate" type="number" step="0.01" defaultValue={lot.vat_rate} className={inputClass} />
            <input name="payment_terms" defaultValue={lot.payment_terms ?? project.default_payment_terms ?? "30 JOURS"} className={inputClass} />
          </div>
          <p className="text-sm text-slate-500">
            Marché TTC : {formatCurrency(contractTtc)} · Total avenants HT :{" "}
            {formatCurrency(amendmentsTotalHt)}
          </p>
          <button type="submit" disabled={isPending} className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50">
            Enregistrer le lot
          </button>
        </form>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-slate-900">Avenants</h3>

        <form onSubmit={handleAddAmendment} className="mb-4 grid gap-3 sm:grid-cols-4">
          <input name="amendment_number" type="number" min="1" placeholder="N°" className={inputClass} />
          <input name="designation" placeholder="Désignation" className={inputClass} />
          <input name="os_number" placeholder="N° OS" className={inputClass} />
          <input name="amount_ht" required type="number" step="0.01" placeholder="Montant HT" className={inputClass} />
          <button type="submit" disabled={isPending} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50 sm:col-span-4">
            Ajouter un avenant
          </button>
        </form>

        {amendments.length === 0 ? (
          <p className="text-sm text-slate-500">Aucun avenant pour ce lot.</p>
        ) : (
          <ul className="space-y-2">
            {amendments.map((a) => (
              <li key={a.id} className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-2">
                <div>
                  <p className="font-medium text-slate-900">
                    Avenant n°{a.amendment_number}
                    {a.designation && ` — ${a.designation}`}
                  </p>
                  <p className="text-sm text-slate-500">
                    {formatCurrency(Number(a.amount_ht))} HT ·{" "}
                    {formatCurrency(Number(a.amount_ttc))} TTC
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteAmendment(a.id)}
                  className="text-sm text-red-600 hover:text-red-700"
                >
                  Supprimer
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">Situations</h3>
          <Link
            href={`/pc/projets/${project.id}/finance/situations/${lot.id}/nouvelle`}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
          >
            + Nouvelle situation
          </Link>
        </div>
        <p className="mt-2 text-sm text-slate-500">
          {(lot.situations ?? []).length} situation(s) enregistrée(s)
        </p>
      </section>

      {error && <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}
      {success && <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</p>}
    </div>
  );
}
