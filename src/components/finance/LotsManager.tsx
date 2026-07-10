"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { deleteLot, upsertLot } from "@/lib/actions/finance";
import { formatCurrency } from "@/lib/finance/calculations";
import type { LotWithFinancials, Project } from "@/lib/types/database";

const inputClass =
  "w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-800 placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none";

type LotsManagerProps = {
  project: Project;
  lots: LotWithFinancials[];
};

export function LotsManager({ project, lots }: LotsManagerProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const form = new FormData(e.currentTarget);

    startTransition(async () => {
      try {
        await upsertLot(project.id, {
          lot_number: (form.get("lot_number") as string).trim(),
          designation: (form.get("designation") as string).trim(),
          name: (form.get("name") as string).trim(),
          enterprise_address:
            (form.get("enterprise_address") as string).trim() || undefined,
          contract_amount_ht: Number(form.get("contract_amount_ht")),
          prorata_percent: Number(form.get("prorata_percent")) / 100,
          payment_terms: (form.get("payment_terms") as string).trim() || undefined,
          vat_rate: Number(form.get("vat_rate") || 20),
        });
        e.currentTarget.reset();
        setShowForm(false);
        setSuccess("Lot ajouté.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Une erreur est survenue.");
      }
    });
  }

  function handleDelete(lotId: string) {
    if (!confirm("Supprimer ce lot et toutes ses situations ?")) return;

    startTransition(async () => {
      try {
        await deleteLot(project.id, lotId);
        setSuccess("Lot supprimé.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Une erreur est survenue.");
      }
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Lots du chantier</h2>
            <p className="text-sm text-slate-500">
              1 lot = 1 entreprise titulaire
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowForm(!showForm)}
            className="rounded-xl bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
          >
            {showForm ? "Annuler" : "+ Ajouter un lot"}
          </button>
        </div>

        {showForm && (
          <form onSubmit={handleSubmit} className="mb-6 space-y-3 rounded-xl border border-slate-200 p-4">
            <div className="grid gap-3 sm:grid-cols-2">
              <input name="lot_number" required placeholder="N° lot (01, 11A…)" className={inputClass} />
              <input name="designation" required placeholder="Désignation (DEMOLITION…)" className={inputClass} />
              <input name="name" required placeholder="Entreprise titulaire" className={inputClass} />
              <input name="enterprise_address" placeholder="Adresse entreprise" className={inputClass} />
              <input name="contract_amount_ht" required type="number" step="0.01" min="0" placeholder="Montant marché HT" className={inputClass} />
              <input name="prorata_percent" type="number" step="0.001" min="0" max="100" defaultValue="1.5" placeholder="% prorata (ex: 1.5)" className={inputClass} />
              <input name="vat_rate" type="number" step="0.01" defaultValue="20" placeholder="TVA %" className={inputClass} />
              <input name="payment_terms" defaultValue={project.default_payment_terms ?? "30 JOURS"} placeholder="Conditions règlement" className={inputClass} />
            </div>
            <button type="submit" disabled={isPending} className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">
              {isPending ? "Ajout…" : "Ajouter le lot"}
            </button>
          </form>
        )}

        {lots.length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
            Aucun lot configuré. Ajoutez vos lots pour commencer le suivi financier.
          </p>
        ) : (
          <ul className="space-y-3">
            {lots.map((lot) => (
              <li
                key={lot.id}
                className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3"
              >
                <div>
                  <p className="font-semibold text-slate-900">
                    {lot.lot_number} — {lot.designation}
                  </p>
                  <p className="text-sm text-slate-500">{lot.name}</p>
                  <p className="text-sm text-slate-600">
                    {formatCurrency(Number(lot.contract_amount_ht))} HT
                    {Number(lot.prorata_percent) > 0 &&
                      ` · Prorata ${(Number(lot.prorata_percent) * 100).toFixed(2)} %`}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Link
                    href={`/pc/projets/${project.id}/finance/lots/${lot.id}`}
                    className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
                  >
                    Gérer
                  </Link>
                  <button
                    type="button"
                    onClick={() => handleDelete(lot.id)}
                    disabled={isPending}
                    className="rounded-lg bg-red-50 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-100 disabled:opacity-50"
                  >
                    Supprimer
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {error && (
          <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
        )}
        {success && (
          <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</p>
        )}
      </section>
    </div>
  );
}
