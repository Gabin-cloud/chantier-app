"use client";

import { FormField } from "@/components/finance/FormField";
import { MoneyInput } from "@/components/finance/MoneyInput";
import { AppFormField } from "@/components/ui/AppFormField";
import type { Enterprise, Project } from "@/lib/types/database";

type LotFormFieldsProps = {
  project: Project;
  lot?: Enterprise;
  prefix?: string;
};

export function LotFormFields({ project, lot, prefix = "" }: LotFormFieldsProps) {
  const id = (name: string) => (prefix ? `${prefix}_${name}` : name);
  const prorataDefault = lot
    ? (Number(lot.prorata_percent) * 100).toFixed(3)
    : "1.5";
  const vatDefault = String(lot?.vat_rate ?? 20);

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      <AppFormField
        label="N° lot"
        id={id("lot_number")}
        name="lot_number"
        defaultValue={lot?.lot_number ?? ""}
        required
      />

      <AppFormField
        label="Désignation des travaux"
        id={id("designation")}
        name="designation"
        defaultValue={lot?.designation ?? ""}
        required
      />

      <AppFormField
        label="Entreprise titulaire"
        id={id("name")}
        name="name"
        defaultValue={lot?.name ?? ""}
        required
      />

      <AppFormField
        label="Adresse entreprise"
        id={id("enterprise_address")}
        name="enterprise_address"
        defaultValue={lot?.enterprise_address ?? ""}
      />

      <FormField label="Montant marché H.T." htmlFor={id("contract_amount_ht")}>
        <MoneyInput
          id={id("contract_amount_ht")}
          name="contract_amount_ht"
          defaultValue={Number(lot?.contract_amount_ht ?? 0)}
          savedValue={Number(lot?.contract_amount_ht ?? 0)}
          required
        />
      </FormField>

      <AppFormField
        label="Prorata"
        id={id("prorata_percent")}
        name="prorata_percent"
        format="percent"
        decimals={3}
        defaultValue={prorataDefault}
        savedValue={prorataDefault}
        hint="Ex. 1,500 % pour 1,5 %"
      />

      <AppFormField
        label="TVA"
        id={id("vat_rate")}
        name="vat_rate"
        format="percent"
        defaultValue={vatDefault}
        savedValue={vatDefault}
      />

      <AppFormField
        label="Conditions de règlement"
        id={id("payment_terms")}
        name="payment_terms"
        defaultValue={lot?.payment_terms ?? project.default_payment_terms ?? "30 JOURS"}
        savedValue={lot?.payment_terms ?? project.default_payment_terms ?? "30 JOURS"}
      />

      <AppFormField
        label="E-mail chantier"
        id={id("email_chantier")}
        name="email_chantier"
        format="email"
        defaultValue={lot?.email_chantier ?? ""}
        savedValue={lot?.email_chantier ?? ""}
      />

      <AppFormField
        label="E-mail factures"
        id={id("email_factures")}
        name="email_factures"
        format="email"
        defaultValue={lot?.email_factures ?? ""}
        savedValue={lot?.email_factures ?? ""}
      />

      <AppFormField
        label="E-mail administratif"
        id={id("email_administratif")}
        name="email_administratif"
        format="email"
        defaultValue={lot?.email_administratif ?? ""}
        savedValue={lot?.email_administratif ?? ""}
      />

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
