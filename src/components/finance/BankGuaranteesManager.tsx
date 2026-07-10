"use client";

import { useState, useTransition } from "react";
import {
  addBankGuarantee,
  deleteBankGuarantee,
} from "@/lib/actions/finance";
import { FormField, financeInputClass } from "@/components/finance/FormField";
import { MoneyInput } from "@/components/finance/MoneyInput";
import { formatCurrency } from "@/lib/finance/calculations";
import type { FinancialBankGuarantee } from "@/lib/types/database";

type BankGuaranteesManagerProps = {
  projectId: string;
  guarantees: FinancialBankGuarantee[];
};

export function BankGuaranteesManager({
  projectId,
  guarantees,
}: BankGuaranteesManagerProps) {
  const [isPending, startTransition] = useTransition();
  const [companyName, setCompanyName] = useState("");
  const [amountHt, setAmountHt] = useState(0);

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!companyName.trim()) return;

    startTransition(async () => {
      await addBankGuarantee(projectId, {
        company_name: companyName.trim(),
        amount_ht: amountHt,
      });
      setCompanyName("");
      setAmountHt(0);
    });
  }

  function handleDelete(id: string) {
    if (!confirm("Supprimer cette caution bancaire ?")) return;
    startTransition(async () => {
      await deleteBankGuarantee(projectId, id);
    });
  }

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="mb-1 text-lg font-semibold text-slate-900">
        Cautions bancaires du chantier
      </h2>
      <p className="mb-4 text-sm text-slate-500">
        Valeurs fixes pour toute l&apos;opération. Si un lot a une caution en
        place, la retenue de garantie 5&nbsp;% ne s&apos;applique pas.
      </p>

      <form onSubmit={handleAdd} className="mb-4 grid gap-3 sm:grid-cols-3">
        <FormField label="Entreprise / émetteur">
          <input
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            className={financeInputClass}
            required
          />
        </FormField>
        <FormField label="Montant caution H.T.">
          <MoneyInput value={amountHt} onChange={setAmountHt} />
        </FormField>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={isPending}
            className="w-full rounded-xl bg-slate-800 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-50"
          >
            Ajouter une caution
          </button>
        </div>
      </form>

      {guarantees.length === 0 ? (
        <p className="text-sm text-slate-500">Aucune caution enregistrée.</p>
      ) : (
        <ul className="space-y-2">
          {guarantees.map((g) => (
            <li
              key={g.id}
              className="flex items-center justify-between rounded-xl border border-slate-200 px-4 py-3"
            >
              <div>
                <p className="font-medium text-slate-900">{g.company_name}</p>
                <p className="text-sm text-slate-600">
                  {formatCurrency(Number(g.amount_ht))} H.T.
                </p>
              </div>
              <button
                type="button"
                onClick={() => handleDelete(g.id)}
                className="text-sm text-red-600 hover:text-red-700"
              >
                Supprimer
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
