"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import {
  deleteAmendment,
  upsertAmendment,
  upsertLot,
} from "@/lib/actions/finance";
import { FormField, financeInputClass } from "@/components/finance/FormField";
import { LotFormFields, parseLotFormData } from "@/components/finance/LotFormFields";
import { MoneyInput } from "@/components/finance/MoneyInput";
import {
  computeAmendmentsTotals,
  computeContractTtc,
  formatCurrency,
} from "@/lib/finance/calculations";
import type { LotWithFinancials, Project } from "@/lib/types/database";

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
        await upsertLot(project.id, parseLotFormData(form), lot.id);
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

        <form onSubmit={handleUpdateLot} className="space-y-4">
          <LotFormFields project={project} lot={lot} />
          <p className="text-sm text-slate-500">
            Marché T.T.C. : {formatCurrency(contractTtc)} · Total avenants H.T. :{" "}
            {formatCurrency(amendmentsTotalHt)}
          </p>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
          >
            Enregistrer le lot
          </button>
        </form>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-slate-900">Avenants</h3>

        <form
          onSubmit={handleAddAmendment}
          className="mb-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
        >
          <FormField label="N° avenant">
            <input
              name="amendment_number"
              type="number"
              min="1"
              className={financeInputClass}
            />
          </FormField>
          <FormField label="Désignation">
            <input name="designation" className={financeInputClass} />
          </FormField>
          <FormField label="N° OS">
            <input name="os_number" className={financeInputClass} />
          </FormField>
          <FormField label="Montant H.T.">
            <MoneyInput name="amount_ht" defaultValue={0} required />
          </FormField>
          <div className="sm:col-span-2 lg:col-span-4">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
            >
              Ajouter un avenant
            </button>
          </div>
        </form>

        {amendments.length === 0 ? (
          <p className="text-sm text-slate-500">Aucun avenant.</p>
        ) : (
          <ul className="space-y-2">
            {amendments.map((a) => (
              <li
                key={a.id}
                className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-2"
              >
                <div>
                  <p className="font-medium">
                    Avenant n°{a.amendment_number}
                    {a.designation && ` — ${a.designation}`}
                  </p>
                  <p className="text-sm text-slate-500">
                    {formatCurrency(Number(a.amount_ht))} H.T. ·{" "}
                    {formatCurrency(Number(a.amount_ttc))} T.T.C.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteAmendment(a.id)}
                  className="text-sm text-red-600"
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
      </section>

      {error && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}
      {success && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</p>
      )}
    </div>
  );
}
