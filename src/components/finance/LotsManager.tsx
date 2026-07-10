"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { deleteLot, upsertLot } from "@/lib/actions/finance";
import { LotFormFields, parseLotFormData } from "@/components/finance/LotFormFields";
import { formatCurrency } from "@/lib/finance/calculations";
import type { LotWithFinancials, Project } from "@/lib/types/database";

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
        await upsertLot(project.id, parseLotFormData(form));
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
    <section className="rounded-2xl bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Lots du chantier</h2>
          <p className="text-sm text-slate-500">1 lot = 1 entreprise titulaire</p>
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
        <form
          onSubmit={handleSubmit}
          className="mb-6 space-y-4 rounded-xl border border-slate-200 p-5"
        >
          <LotFormFields project={project} />
          <button
            type="submit"
            disabled={isPending}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
          >
            {isPending ? "Ajout…" : "Ajouter le lot"}
          </button>
        </form>
      )}

      {lots.length === 0 ? (
        <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
          Aucun lot configuré.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-slate-500">
                <th className="px-3 py-2">N°</th>
                <th className="px-3 py-2">Désignation</th>
                <th className="px-3 py-2">Entreprise</th>
                <th className="px-3 py-2 text-right">Marché H.T.</th>
                <th className="px-3 py-2 text-right">Prorata</th>
                <th className="px-3 py-2">Caution</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody>
              {lots.map((lot) => (
                <tr key={lot.id} className="border-b border-slate-100">
                  <td className="px-3 py-3 font-medium">{lot.lot_number}</td>
                  <td className="px-3 py-3">{lot.designation}</td>
                  <td className="px-3 py-3">{lot.name}</td>
                  <td className="px-3 py-3 text-right">
                    {formatCurrency(Number(lot.contract_amount_ht))}
                  </td>
                  <td className="px-3 py-3 text-right">
                    {(Number(lot.prorata_percent) * 100).toFixed(2)} %
                  </td>
                  <td className="px-3 py-3">
                    {lot.has_bank_guarantee ? "Oui" : "Non"}
                  </td>
                  <td className="px-3 py-3 text-right">
                    <Link
                      href={`/pc/projets/${project.id}/finance/lots/${lot.id}`}
                      className="mr-2 rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-200"
                    >
                      Modifier
                    </Link>
                    <button
                      type="button"
                      onClick={() => handleDelete(lot.id)}
                      disabled={isPending}
                      className="rounded-lg bg-red-50 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-100"
                    >
                      Supprimer
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {error && (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>
      )}
      {success && (
        <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</p>
      )}
    </section>
  );
}
