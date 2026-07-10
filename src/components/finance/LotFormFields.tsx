"use client";

import { FormField, financeInputClass } from "@/components/finance/FormField";
import { MoneyInput } from "@/components/finance/MoneyInput";
import type { Enterprise, Project } from "@/lib/types/database";

type LotFormFieldsProps = {
  project: Project;
  lot?: Enterprise;
  prefix?: string;
};

export function LotFormFields({ project, lot, prefix = "" }: LotFormFieldsProps) {
  const id = (name: string) => (prefix ? `${prefix}_${name}` : name);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <FormField label="N° lot" htmlFor={id("lot_number")}>
        <input
          id={id("lot_number")}
          name="lot_number"
          required
          defaultValue={lot?.lot_number ?? ""}
          className={financeInputClass}
        />
      </FormField>

      <FormField label="Désignation des travaux" htmlFor={id("designation")}>
        <input
          id={id("designation")}
          name="designation"
          required
          defaultValue={lot?.designation ?? ""}
          className={financeInputClass}
        />
      </FormField>

      <FormField label="Entreprise titulaire" htmlFor={id("name")}>
        <input
          id={id("name")}
          name="name"
          required
          defaultValue={lot?.name ?? ""}
          className={financeInputClass}
        />
      </FormField>

      <FormField label="Adresse entreprise" htmlFor={id("enterprise_address")}>
        <input
          id={id("enterprise_address")}
          name="enterprise_address"
          defaultValue={lot?.enterprise_address ?? ""}
          className={financeInputClass}
        />
      </FormField>

      <FormField label="Montant marché H.T." htmlFor={id("contract_amount_ht")}>
        <MoneyInput
          id={id("contract_amount_ht")}
          name="contract_amount_ht"
          defaultValue={Number(lot?.contract_amount_ht ?? 0)}
          required
        />
      </FormField>

      <FormField
        label="Prorata (%)"
        htmlFor={id("prorata_percent")}
        hint="Ex. 1,5 pour 1,5 %"
      >
        <input
          id={id("prorata_percent")}
          name="prorata_percent"
          type="number"
          step="0.001"
          min="0"
          max="100"
          defaultValue={
            lot
              ? (Number(lot.prorata_percent) * 100).toFixed(3)
              : "1.5"
          }
          className={financeInputClass}
        />
      </FormField>

      <FormField label="TVA (%)" htmlFor={id("vat_rate")}>
        <input
          id={id("vat_rate")}
          name="vat_rate"
          type="number"
          step="0.01"
          defaultValue={lot?.vat_rate ?? 20}
          className={financeInputClass}
        />
      </FormField>

      <FormField label="Conditions de règlement" htmlFor={id("payment_terms")}>
        <input
          id={id("payment_terms")}
          name="payment_terms"
          defaultValue={
            lot?.payment_terms ?? project.default_payment_terms ?? "30 JOURS"
          }
          className={financeInputClass}
        />
      </FormField>

      <FormField label="E-mail chantier" htmlFor={id("email_chantier")}>
        <input
          id={id("email_chantier")}
          name="email_chantier"
          type="email"
          defaultValue={lot?.email_chantier ?? ""}
          className={financeInputClass}
        />
      </FormField>

      <FormField label="E-mail factures" htmlFor={id("email_factures")}>
        <input
          id={id("email_factures")}
          name="email_factures"
          type="email"
          defaultValue={lot?.email_factures ?? ""}
          className={financeInputClass}
        />
      </FormField>

      <FormField label="E-mail administratif" htmlFor={id("email_administratif")}>
        <input
          id={id("email_administratif")}
          name="email_administratif"
          type="email"
          defaultValue={lot?.email_administratif ?? ""}
          className={financeInputClass}
        />
      </FormField>

      <FormField label="Caution bancaire en place">
        <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
          <input
            type="checkbox"
            name="has_bank_guarantee"
            defaultChecked={lot?.has_bank_guarantee ?? false}
            className="h-4 w-4 rounded border-slate-300"
          />
          <span className="text-sm text-slate-700">
            Oui — pas de retenue de garantie 5&nbsp;%
          </span>
        </label>
      </FormField>
    </div>
  );
}

export function parseLotFormData(form: FormData): {
  lot_number: string;
  designation: string;
  name: string;
  enterprise_address?: string;
  contract_amount_ht: number;
  prorata_percent: number;
  payment_terms?: string;
  vat_rate?: number;
  email_chantier?: string;
  email_factures?: string;
  email_administratif?: string;
  has_bank_guarantee?: boolean;
} {
  const parseMoney = (key: string) => {
    const raw = String(form.get(key) ?? "0");
    return Number(raw) || 0;
  };

  return {
    lot_number: (form.get("lot_number") as string).trim(),
    designation: (form.get("designation") as string).trim(),
    name: (form.get("name") as string).trim(),
    enterprise_address: (form.get("enterprise_address") as string).trim() || undefined,
    contract_amount_ht: parseMoney("contract_amount_ht"),
    prorata_percent: Number(form.get("prorata_percent")) / 100,
    payment_terms: (form.get("payment_terms") as string).trim() || undefined,
    vat_rate: Number(form.get("vat_rate") || 20),
    email_chantier: (form.get("email_chantier") as string).trim() || undefined,
    email_factures: (form.get("email_factures") as string).trim() || undefined,
    email_administratif:
      (form.get("email_administratif") as string).trim() || undefined,
    has_bank_guarantee: form.get("has_bank_guarantee") === "on",
  };
}
