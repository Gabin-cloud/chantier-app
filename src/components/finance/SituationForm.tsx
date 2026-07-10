"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  deleteSituation,
  saveSituationDelegations,
  upsertSituation,
} from "@/lib/actions/finance";
import {
  computeSituation,
  formatCurrency,
  formatPercent,
} from "@/lib/finance/calculations";
import type {
  FinancialSituation,
  FinancialSituationDelegation,
  LotWithFinancials,
  Project,
} from "@/lib/types/database";

const inputClass =
  "w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-3 text-base text-slate-800 placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none";

type SituationFormProps = {
  project: Project;
  lot: LotWithFinancials;
  situation?: FinancialSituation & {
    financial_situation_delegations?: FinancialSituationDelegation[];
  };
  isNew?: boolean;
};

export function SituationForm({ project, lot, situation, isNew }: SituationFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const situations = lot.situations ?? [];
  const previousSituation = isNew
    ? situations[situations.length - 1] ?? null
    : situations.find(
        (s) => s.situation_number === (situation?.situation_number ?? 0) - 1
      ) ?? null;

  const nextNumber = isNew
    ? (situations.length > 0
        ? Math.max(...situations.map((s) => s.situation_number)) + 1
        : 1)
    : situation?.situation_number ?? 1;

  const [formState, setFormState] = useState({
    situation_number: nextNumber,
    situation_date:
      situation?.situation_date ?? new Date().toISOString().slice(0, 10),
    works_cumulative_ht: situation?.works_cumulative_ht ?? 0,
    amendment_works_cumulative_ht:
      situation?.amendment_works_cumulative_ht ?? 0,
    retention_guarantee_cumulative_ht:
      situation?.retention_guarantee_cumulative_ht ?? 0,
    retention_finition_cumulative_ht:
      situation?.retention_finition_cumulative_ht ?? 0,
    retention_diverse_cumulative_ht:
      situation?.retention_diverse_cumulative_ht ?? 0,
    penalties_cumulative_ht: situation?.penalties_cumulative_ht ?? 0,
    cie_cumulative_ht: situation?.cie_cumulative_ht ?? 0,
    notes: situation?.notes ?? "",
  });

  const computed = useMemo(() => {
    const draftSituation: FinancialSituation = {
      id: situation?.id ?? "",
      enterprise_id: lot.id,
      situation_number: formState.situation_number,
      situation_date: formState.situation_date,
      works_cumulative_ht: formState.works_cumulative_ht,
      amendment_works_cumulative_ht: formState.amendment_works_cumulative_ht,
      prorata_cumulative_ht: 0,
      retention_guarantee_cumulative_ht:
        formState.retention_guarantee_cumulative_ht,
      retention_finition_cumulative_ht: formState.retention_finition_cumulative_ht,
      retention_diverse_cumulative_ht: formState.retention_diverse_cumulative_ht,
      penalties_cumulative_ht: formState.penalties_cumulative_ht,
      cie_cumulative_ht: formState.cie_cumulative_ht,
      notes: formState.notes,
      created_at: "",
      updated_at: "",
    };

    return computeSituation({
      contractAmountHt: Number(lot.contract_amount_ht),
      vatRate: Number(lot.vat_rate),
      prorataPercent: Number(lot.prorata_percent),
      amendments: lot.amendments ?? [],
      situation: draftSituation,
      previousSituation,
    });
  }, [formState, lot, previousSituation, situation?.id]);

  function updateField(field: keyof typeof formState, value: string | number) {
    setFormState((prev) => ({ ...prev, [field]: value }));
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      try {
        const situationId = await upsertSituation(
          project.id,
          lot.id,
          {
            situation_number: formState.situation_number,
            situation_date: formState.situation_date,
            works_cumulative_ht: Number(formState.works_cumulative_ht),
            amendment_works_cumulative_ht: Number(
              formState.amendment_works_cumulative_ht
            ),
            retention_guarantee_cumulative_ht: Number(
              formState.retention_guarantee_cumulative_ht
            ),
            retention_finition_cumulative_ht: Number(
              formState.retention_finition_cumulative_ht
            ),
            retention_diverse_cumulative_ht: Number(
              formState.retention_diverse_cumulative_ht
            ),
            penalties_cumulative_ht: Number(formState.penalties_cumulative_ht),
            cie_cumulative_ht: Number(formState.cie_cumulative_ht),
            notes: formState.notes || undefined,
          },
          situation?.id
        );

        await saveSituationDelegations(project.id, lot.id, situationId, []);

        router.push(
          `/pc/projets/${project.id}/finance/situations/${lot.id}/${situationId}`
        );
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Une erreur est survenue.");
      }
    });
  }

  function handleDelete() {
    if (!situation?.id || !confirm("Supprimer cette situation ?")) return;

    startTransition(async () => {
      try {
        await deleteSituation(project.id, lot.id, situation.id);
        router.push(`/pc/projets/${project.id}/finance/situations/${lot.id}`);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Une erreur est survenue.");
      }
    });
  }

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-slate-900">
          {isNew ? "Nouvelle situation" : `Situation n°${situation?.situation_number}`}
        </h2>
        <p className="mb-4 text-sm text-slate-500">
          Lot {lot.lot_number} — {lot.designation} · {lot.name}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                N° situation
              </label>
              <input
                type="number"
                min="1"
                value={formState.situation_number}
                onChange={(e) =>
                  updateField("situation_number", Number(e.target.value))
                }
                className={inputClass}
                required
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-slate-700">
                Date
              </label>
              <input
                type="date"
                value={formState.situation_date}
                onChange={(e) => updateField("situation_date", e.target.value)}
                className={inputClass}
                required
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Travaux marché — cumul H.T. *
            </label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={formState.works_cumulative_ht}
              onChange={(e) =>
                updateField("works_cumulative_ht", Number(e.target.value))
              }
              className={inputClass}
              required
            />
            <p className="mt-1 text-xs text-slate-400">
              Montant principal saisi depuis la facture entreprise.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ["amendment_works_cumulative_ht", "Travaux avenants cumul HT"],
              ["retention_guarantee_cumulative_ht", "Retenue garantie 5 % cumul HT"],
              ["retention_finition_cumulative_ht", "Retenue finition cumul HT"],
              ["retention_diverse_cumulative_ht", "Retenues diverses cumul HT"],
              ["penalties_cumulative_ht", "Pénalités cumul HT"],
              ["cie_cumulative_ht", "CIE cumul HT"],
            ].map(([field, label]) => (
              <div key={field}>
                <label className="mb-1 block text-sm font-medium text-slate-700">
                  {label}
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formState[field as keyof typeof formState] as number}
                  onChange={(e) =>
                    updateField(field as keyof typeof formState, Number(e.target.value))
                  }
                  className={inputClass}
                />
              </div>
            ))}
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-slate-700">
              Notes
            </label>
            <textarea
              value={formState.notes}
              onChange={(e) => updateField("notes", e.target.value)}
              rows={2}
              className={inputClass}
            />
          </div>

          {error && (
            <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={isPending}
              className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {isPending ? "Enregistrement…" : "Enregistrer la situation"}
            </button>
            {!isNew && situation?.id && (
              <>
                <Link
                  href={`/pc/projets/${project.id}/finance/situations/${lot.id}/${situation.id}/print`}
                  className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Voir l&apos;attestation PDF
                </Link>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isPending}
                  className="rounded-xl bg-red-50 px-5 py-3 text-sm font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50"
                >
                  Supprimer
                </button>
              </>
            )}
          </div>
        </form>
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h3 className="mb-4 text-lg font-semibold text-slate-900">
          Calcul automatique
        </h3>

        <div className="mb-4 rounded-xl bg-slate-50 p-4">
          <p className="text-sm text-slate-500">Avancement</p>
          <p className="text-2xl font-bold text-slate-900">
            {formatPercent(computed.advancementPercent)}
          </p>
          <p className="mt-2 text-sm text-slate-600">
            Situation du mois : {formatCurrency(computed.totalPeriodHt)} HT ·{" "}
            {formatCurrency(computed.totalPeriodTtc)} TTC
          </p>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-slate-500">
              <th className="py-2 text-left font-medium">Libellé</th>
              <th className="py-2 text-right font-medium">Cumul</th>
              <th className="py-2 text-right font-medium">Précédent</th>
              <th className="py-2 text-right font-medium">Situation</th>
            </tr>
          </thead>
          <tbody>
            {computed.lines.map((line) => (
              <tr key={line.label} className="border-b border-slate-50">
                <td className="py-2">{line.label}</td>
                <td className="py-2 text-right">
                  {line.label === "Avancement de la situation"
                    ? formatPercent(line.cumulative)
                    : formatCurrency(line.cumulative)}
                </td>
                <td className="py-2 text-right text-slate-500">
                  {line.label === "Avancement de la situation"
                    ? "—"
                    : formatCurrency(line.previous)}
                </td>
                <td className="py-2 text-right font-medium">
                  {line.label === "Avancement de la situation"
                    ? formatPercent(line.period)
                    : formatCurrency(line.period)}
                </td>
              </tr>
            ))}
            <tr className="border-t-2 border-slate-200 font-semibold">
              <td className="py-2">Total T.T.C.</td>
              <td className="py-2 text-right">{formatCurrency(computed.totalTtc)}</td>
              <td className="py-2 text-right">{formatCurrency(computed.totalPreviousTtc)}</td>
              <td className="py-2 text-right text-blue-600">
                {formatCurrency(computed.totalPeriodTtc)}
              </td>
            </tr>
          </tbody>
        </table>
      </section>
    </div>
  );
}
