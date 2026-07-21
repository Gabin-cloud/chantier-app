"use client";

import { useEffect, useState } from "react";
import { AppFormField } from "@/components/ui/AppFormField";
import {
  normalizeQuoteCategory,
  validateQuoteCategory,
  type QuoteCategoryFlags,
} from "@/lib/finance/quote-category";

export type DevisFormValues = {
  quoteNumber: string;
  quoteDate: string;
  designation: string;
  amountHt: string;
  comment: string;
  isCie: boolean;
  isTs: boolean;
  isTma: boolean;
  markRejected: boolean;
  validatedAt: string;
};

type DevisFormFieldsProps = {
  values: DevisFormValues;
  onChange: (values: DevisFormValues) => void;
  mode?: "new" | "signed";
  showValidation?: boolean;
};

function setCategory(
  values: DevisFormValues,
  key: keyof QuoteCategoryFlags,
  checked: boolean
): DevisFormValues {
  if (!checked) {
    return { ...values, isCie: key === "is_cie" ? false : values.isCie, isTs: key === "is_ts" ? false : values.isTs, isTma: key === "is_tma" ? false : values.isTma };
  }
  const normalized = normalizeQuoteCategory({
    is_cie: key === "is_cie",
    is_ts: key === "is_ts",
    is_tma: key === "is_tma",
  });
  return {
    ...values,
    isCie: normalized.is_cie,
    isTs: normalized.is_ts,
    isTma: normalized.is_tma,
  };
}

export function DevisFormFields({
  values,
  onChange,
  mode = "new",
  showValidation = true,
}: DevisFormFieldsProps) {
  const [categoryError, setCategoryError] = useState<string | null>(null);

  useEffect(() => {
    setCategoryError(
      validateQuoteCategory({
        is_cie: values.isCie,
        is_ts: values.isTs,
        is_tma: values.isTma,
      })
    );
  }, [values.isCie, values.isTs, values.isTma]);

  function patch(partial: Partial<DevisFormValues>) {
    onChange({ ...values, ...partial });
  }

  function toggleCategory(key: keyof QuoteCategoryFlags) {
    const map = { is_cie: "isCie", is_ts: "isTs", is_tma: "isTma" } as const;
    const field = map[key];
    const checked = !values[field];
    const normalized = normalizeQuoteCategory({
      is_cie: key === "is_cie" ? checked : false,
      is_ts: key === "is_ts" ? checked : false,
      is_tma: key === "is_tma" ? checked : false,
    });
    patch({
      isCie: normalized.is_cie,
      isTs: normalized.is_ts,
      isTma: normalized.is_tma,
    });
  }

  if (mode === "signed") {
    return (
      <div className="space-y-2">
        <label className="block text-xs font-semibold text-slate-600">
          Date de validation
        </label>
        <input
          type="date"
          value={values.validatedAt}
          onChange={(e) => patch({ validatedAt: e.target.value })}
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
        />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={values.markRejected}
            onChange={(e) => patch({ markRejected: e.target.checked })}
          />
          Non validé
        </label>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <AppFormField
        label="N° devis"
        name="quoteNumber"
        value={values.quoteNumber}
        onChange={(v) => patch({ quoteNumber: v })}
      />
      <label className="block text-xs font-semibold text-slate-600">Date du devis</label>
      <input
        type="date"
        value={values.quoteDate}
        onChange={(e) => patch({ quoteDate: e.target.value })}
        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
      />
      <div className="flex gap-3 text-sm">
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={values.isCie} onChange={() => toggleCategory("is_cie")} />
          CIE
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={values.isTs} onChange={() => toggleCategory("is_ts")} />
          TS
        </label>
        <label className="flex items-center gap-1">
          <input type="checkbox" checked={values.isTma} onChange={() => toggleCategory("is_tma")} />
          TMA
        </label>
      </div>
      {categoryError && <p className="text-xs text-red-600">{categoryError}</p>}
      <AppFormField
        label="Désignation"
        name="designation"
        value={values.designation}
        onChange={(v) => patch({ designation: v })}
      />
      <AppFormField
        label="Montant H.T."
        name="amount_ht"
        format="money"
        value={values.amountHt}
        onChange={(v) => patch({ amountHt: v })}
      />
      <AppFormField
        label="Commentaire DANOBAT"
        name="comment"
        value={values.comment}
        onChange={(v) => patch({ comment: v })}
        hint="Visible uniquement en interne — n'apparaît pas dans les avenants."
      />
      {showValidation && (
        <>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={values.markRejected}
              onChange={(e) => patch({ markRejected: e.target.checked })}
            />
            Non validé
          </label>
          {!values.markRejected && (
            <>
              <label className="block text-xs font-semibold text-slate-600">
                Date de validation (optionnel)
              </label>
              <input
                type="date"
                value={values.validatedAt}
                onChange={(e) => patch({ validatedAt: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </>
          )}
        </>
      )}
    </div>
  );
}

export function devisValuesToFormData(
  values: DevisFormValues,
  enterpriseId: string,
  file?: File | null,
  extra?: Record<string, string>
) {
  const formData = new FormData();
  formData.set("enterpriseId", enterpriseId);
  formData.set("quoteNumber", values.quoteNumber);
  formData.set("quoteDate", values.quoteDate);
  formData.set("designation", values.designation);
  formData.set("amount_ht", values.amountHt);
  formData.set("comment", values.comment);
  if (values.isCie) formData.set("is_cie", "true");
  if (values.isTs) formData.set("is_ts", "true");
  if (values.isTma) formData.set("is_tma", "true");
  if (values.markRejected) formData.set("markRejected", "true");
  if (values.validatedAt) formData.set("validatedAt", values.validatedAt);
  if (file) formData.set("file", file);
  if (extra) {
    for (const [k, v] of Object.entries(extra)) formData.set(k, v);
  }
  return formData;
}
