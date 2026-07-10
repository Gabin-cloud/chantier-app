"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  deleteSituation,
  saveSituationDelegations,
  upsertSituation,
} from "@/lib/actions/finance";
import { FormField, financeInputClass } from "@/components/finance/FormField";
import { MoneyInput } from "@/components/finance/MoneyInput";
import { SituationExportPanel } from "@/components/finance/SituationExportPanel";
import {
  computeAutoRetentionGuarantee,
  computeSituation,
  formatCurrency,
  formatPercent,
  getDefaultSituationDate,
  getEndOfMonthLabel,
} from "@/lib/finance/calculations";
import type {
  FinancialSituation,
  FinancialSituationDelegation,
  LotWithFinancials,
  Project,
} from "@/lib/types/database";

type SituationFormProps = {
  project: Project;
  lot: LotWithFinancials;
  situation?: FinancialSituation & {
    financial_situation_delegations?: FinancialSituationDelegation[];
  };
  invoiceUrl?: string | null;
  isNew?: boolean;
};

function monthValueFromDate(dateStr: string): string {
  const d = new Date(dateStr);
  const month = String(d.getMonth() + 1).padStart(2, "0");
  return `${d.getFullYear()}-${month}`;
}

function endOfMonthFromMonthValue(monthValue: string): string {
  const [year, month] = monthValue.split("-").map(Number);
  const lastDay = new Date(year, month, 0);
  return lastDay.toISOString().slice(0, 10);
}

export function SituationForm({
  project,
  lot,
  situation,
  invoiceUrl,
  isNew,
}: SituationFormProps) {
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
    ? situations.length > 0
      ? Math.max(...situations.map((s) => s.situation_number)) + 1
      : 1
    : situation?.situation_number ?? 1;

  const defaultDate =
    situation?.situation_date ?? getDefaultSituationDate();

  const [formState, setFormState] = useState({
    situation_number: nextNumber,
    situation_month: monthValueFromDate(defaultDate),
    situation_date: defaultDate,
    works_cumulative_ht: situation?.works_cumulative_ht ?? 0,
    amendment_works_cumulative_ht:
      situation?.amendment_works_cumulative_ht ?? 0,
    retention_finition_cumulative_ht:
      situation?.retention_finition_cumulative_ht ?? 0,
    retention_diverse_cumulative_ht:
      situation?.retention_diverse_cumulative_ht ?? 0,
    penalties_cumulative_ht: situation?.penalties_cumulative_ht ?? 0,
    cie_cumulative_ht: situation?.cie_cumulative_ht ?? 0,
    notes: situation?.notes ?? "",
  });

  const hasBankGuarantee = Boolean(lot.has_bank_guarantee);

  const autoRetention = computeAutoRetentionGuarantee(
    formState.works_cumulative_ht,
    formState.amendment_works_cumulative_ht,
    hasBankGuarantee
  );

  const computed = useMemo(() => {
    const draftSituation: FinancialSituation = {
      id: situation?.id ?? "",
      enterprise_id: lot.id,
      situation_number: formState.situation_number,
      situation_date: formState.situation_date,
      works_cumulative_ht: formState.works_cumulative_ht,
      amendment_works_cumulative_ht: formState.amendment_works_cumulative_ht,
      prorata_cumulative_ht: 0,
      retention_guarantee_cumulative_ht: autoRetention,
      retention_finition_cumulative_ht: formState.retention_finition_cumulative_ht,
      retention_diverse_cumulative_ht: formState.retention_diverse_cumulative_ht,
      penalties_cumulative_ht: formState.penalties_cumulative_ht,
      cie_cumulative_ht: formState.cie_cumulative_ht,
      notes: formState.notes,
      invoice_file_path: situation?.invoice_file_path ?? null,
      invoice_file_name: situation?.invoice_file_name ?? null,
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
      hasBankGuarantee,
      autoRetention: true,
    });
  }, [formState, lot, previousSituation, situation, autoRetention, hasBankGuarantee]);

  function updateField<K extends keyof typeof formState>(
    field: K,
    value: (typeof formState)[K]
  ) {
    setFormState((prev) => ({ ...prev, [field]: value }));
  }

  function handleMonthChange(monthValue: string) {
    updateField("situation_month", monthValue);
    updateField("situation_date", endOfMonthFromMonthValue(monthValue));
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
            retention_guarantee_cumulative_ht: autoRetention,
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
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-2">
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-2 text-lg font-semibold text-slate-900">
            {isNew ? "Nouvelle situation" : `Situation n°${situation?.situation_number}`}
          </h2>
          <p className="mb-4 text-sm text-slate-500">
            Lot {lot.lot_number} — {lot.designation} · {lot.name}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <FormField label="N° situation">
                <input
                  type="number"
                  min="1"
                  value={formState.situation_number}
                  onChange={(e) =>
                    updateField("situation_number", Number(e.target.value))
                  }
                  className={financeInputClass}
                  required
                />
              </FormField>

              <FormField
                label="Mois de situation"
                hint="Les situations sont en fin de mois"
              >
                <input
                  type="month"
                  value={formState.situation_month}
                  onChange={(e) => handleMonthChange(e.target.value)}
                  className={financeInputClass}
                  required
                />
              </FormField>

              <FormField
                label="Date (modifiable)"
                hint={getEndOfMonthLabel(formState.situation_date)}
              >
                <input
                  type="date"
                  value={formState.situation_date}
                  onChange={(e) => updateField("situation_date", e.target.value)}
                  className={financeInputClass}
                  required
                />
              </FormField>
            </div>

            <FormField
              label="Travaux marché — cumul H.T."
              hint="Montant cumulé saisi depuis la facture entreprise"
            >
              <MoneyInput
                value={formState.works_cumulative_ht}
                onChange={(v) => updateField("works_cumulative_ht", v)}
                required
              />
            </FormField>

            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Travaux avenants — cumul H.T.">
                <MoneyInput
                  value={formState.amendment_works_cumulative_ht}
                  onChange={(v) =>
                    updateField("amendment_works_cumulative_ht", v)
                  }
                />
              </FormField>

              <FormField
                label="Retenue de garantie 5 % — cumul H.T."
                hint={
                  hasBankGuarantee
                    ? "Caution bancaire en place : retenue non appliquée"
                    : "Calculée automatiquement à 5 % des travaux cumulés"
                }
              >
                <MoneyInput value={autoRetention} disabled />
              </FormField>

              <FormField label="Retenue finition — cumul H.T.">
                <MoneyInput
                  value={formState.retention_finition_cumulative_ht}
                  onChange={(v) =>
                    updateField("retention_finition_cumulative_ht", v)
                  }
                />
              </FormField>

              <FormField label="Retenues diverses — cumul H.T.">
                <MoneyInput
                  value={formState.retention_diverse_cumulative_ht}
                  onChange={(v) =>
                    updateField("retention_diverse_cumulative_ht", v)
                  }
                />
              </FormField>

              <FormField label="Pénalités — cumul H.T.">
                <MoneyInput
                  value={formState.penalties_cumulative_ht}
                  onChange={(v) => updateField("penalties_cumulative_ht", v)}
                />
              </FormField>

              <FormField label="CIE — cumul H.T.">
                <MoneyInput
                  value={formState.cie_cumulative_ht}
                  onChange={(v) => updateField("cie_cumulative_ht", v)}
                />
              </FormField>
            </div>

            <FormField label="Notes">
              <textarea
                value={formState.notes}
                onChange={(e) => updateField("notes", e.target.value)}
                rows={2}
                className={financeInputClass}
              />
            </FormField>

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
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={isPending}
                  className="rounded-xl bg-red-50 px-5 py-3 text-sm font-semibold text-red-600 hover:bg-red-100 disabled:opacity-50"
                >
                  Supprimer
                </button>
              )}
            </div>
          </form>
        </section>

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h3 className="mb-4 text-lg font-semibold text-slate-900">
            Calcul automatique
          </h3>

          <div className="mb-4 grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Avancement</p>
              <p className="text-xl font-bold">
                {formatPercent(computed.advancementPercent)}
              </p>
            </div>
            <div className="rounded-xl bg-slate-50 p-4">
              <p className="text-xs text-slate-500">Du mois H.T.</p>
              <p className="text-xl font-bold">
                {formatCurrency(computed.totalPeriodHt)}
              </p>
            </div>
            <div className="rounded-xl bg-blue-50 p-4">
              <p className="text-xs text-blue-600">Du mois T.T.C.</p>
              <p className="text-xl font-bold text-blue-700">
                {formatCurrency(computed.totalPeriodTtc)}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] text-sm">
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
                  <td className="py-2 text-right">
                    {formatCurrency(computed.totalTtc)}
                  </td>
                  <td className="py-2 text-right">
                    {formatCurrency(computed.totalPreviousTtc)}
                  </td>
                  <td className="py-2 text-right text-blue-600">
                    {formatCurrency(computed.totalPeriodTtc)}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {!isNew && situation && (
        <SituationExportPanel
          project={project}
          lot={lot}
          situation={situation}
          invoiceUrl={invoiceUrl}
        />
      )}
    </div>
  );
}
