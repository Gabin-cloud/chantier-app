"use client";

import { useEffect, useState, useTransition } from "react";
import { upsertAmendment } from "@/lib/actions/finance";
import { FormField, financeInputClass } from "@/components/finance/FormField";
import { MoneyInput } from "@/components/finance/MoneyInput";
import { parseAmendmentFormData } from "@/lib/finance/amendment-form";
import {
  AMENDMENT_SIGNATURE_STATUS_LABELS,
  AMENDMENT_SIGNATURE_STATUSES,
  AMENDMENT_TYPE_LABELS,
} from "@/lib/finance/amendment-workflow";
import { formatCurrency } from "@/lib/finance/calculations";
import type {
  AmendmentFormData,
  AmendmentSignatureStatus,
  AmendmentType,
  FinancialAmendment,
  LotWithFinancials,
  Project,
} from "@/lib/types/database";

type AmendmentsTrackerProps = {
  project: Project;
  lots: LotWithFinancials[];
};

type EditState = {
  amendmentId: string;
  lotId: string;
  form: AmendmentFormData;
};

const signatureStatuses = AMENDMENT_SIGNATURE_STATUSES;

const amendmentTypes = Object.keys(AMENDMENT_TYPE_LABELS) as AmendmentType[];

function AmendmentEditForm({
  projectId,
  lotId,
  amendment,
  onCancel,
  onSaved,
}: {
  projectId: string;
  lotId: string;
  amendment: FinancialAmendment;
  onCancel: () => void;
  onSaved: (saved: AmendmentFormData) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = e.currentTarget;
    const amountField = form.querySelector<HTMLInputElement>(
      'input[inputmode="decimal"]'
    );
    amountField?.dispatchEvent(new FocusEvent("blur", { bubbles: true }));

    const parsed = parseAmendmentFormData(new FormData(form));
    if (!parsed.ok) {
      setError(parsed.error);
      return;
    }

    startTransition(async () => {
      const result = await upsertAmendment(
        projectId,
        lotId,
        parsed.data,
        amendment.id
      );
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSaved(parsed.data);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-2 lg:grid-cols-3">
      <FormField label="N° avenant">
        <input
          name="amendment_number"
          type="number"
          min="1"
          defaultValue={amendment.amendment_number}
          className={financeInputClass}
          required
        />
      </FormField>
      <FormField label="Type">
        <select
          name="amendment_type"
          defaultValue={amendment.amendment_type}
          className={financeInputClass}
        >
          {amendmentTypes.map((type) => (
            <option key={type} value={type}>
              {AMENDMENT_TYPE_LABELS[type]}
            </option>
          ))}
        </select>
      </FormField>
      <FormField label="Statut signature">
        <select
          name="signature_status"
          defaultValue={amendment.signature_status}
          className={financeInputClass}
        >
          {signatureStatuses.map((status) => (
            <option key={status} value={status}>
              {AMENDMENT_SIGNATURE_STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </FormField>
      <FormField label="Désignation">
        <input
          name="designation"
          defaultValue={amendment.designation ?? ""}
          className={financeInputClass}
        />
      </FormField>
      <FormField label="N° OS">
        <input
          name="os_number"
          defaultValue={amendment.os_number ?? ""}
          className={financeInputClass}
        />
      </FormField>
      <FormField label="Montant H.T.">
        <MoneyInput
          name="amount_ht"
          defaultValue={Number(amendment.amount_ht)}
          required
        />
      </FormField>
      <FormField label="Commentaire interne" className="sm:col-span-2 lg:col-span-3">
        <textarea
          name="internal_comment"
          rows={2}
          defaultValue={amendment.internal_comment ?? ""}
          className={financeInputClass}
          placeholder="Rappel interne sur cet avenant (visible au survol dans la synthèse)"
        />
      </FormField>
      <div className="flex flex-wrap gap-2 sm:col-span-2 lg:col-span-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
        >
          Enregistrer
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100"
        >
          Annuler
        </button>
      </div>
      {error && <p className="text-sm text-red-600 sm:col-span-2 lg:col-span-3">{error}</p>}
    </form>
  );
}

export function AmendmentsTracker({ project, lots }: AmendmentsTrackerProps) {
  const [editing, setEditing] = useState<EditState | null>(null);
  const [savedOverrides, setSavedOverrides] = useState<
    Record<string, Partial<FinancialAmendment>>
  >({});

  useEffect(() => {
    setSavedOverrides({});
    setEditing(null);
  }, [project.id, lots]);

  const lotsWithAmendments = lots
    .map((lot) => ({
      lot,
      amendments: [...(lot.amendments ?? [])]
        .map((amendment) => ({
          ...amendment,
          ...savedOverrides[amendment.id],
        }))
        .sort((a, b) => a.amendment_number - b.amendment_number),
    }))
    .filter((entry) => entry.amendments.length > 0);

  if (lotsWithAmendments.length === 0) {
    return (
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-2 text-lg font-semibold text-slate-900">
          Suivi des avenants
        </h2>
        <p className="text-sm text-slate-500">
          Aucun avenant enregistré. Créez des avenants depuis la fiche lot
          (Marché / Administratif ou Lots &amp; marchés).
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4 rounded-2xl bg-white p-5 shadow-sm">
      <div>
        <h2 className="text-lg font-semibold text-slate-900">Suivi des avenants</h2>
        <p className="text-sm text-slate-500">
          Modifiez le type (TS/TMA), le statut de signature et le commentaire
          interne. Les couleurs et infobulles apparaissent dans la synthèse
          financière.
        </p>
      </div>

      {lotsWithAmendments.map(({ lot, amendments }) => (
        <div key={lot.id} className="space-y-3">
          <h3 className="text-sm font-semibold text-slate-800">
            Lot {lot.lot_number} — {lot.designation} ({lot.name})
          </h3>
          <ul className="space-y-3">
            {amendments.map((amendment) => (
              <li key={amendment.id} className="rounded-xl border border-slate-200">
                {editing?.amendmentId === amendment.id ? (
                  <AmendmentEditForm
                    projectId={project.id}
                    lotId={lot.id}
                    amendment={amendment}
                    onCancel={() => setEditing(null)}
                    onSaved={(saved) => {
                      setSavedOverrides((current) => ({
                        ...current,
                        [amendment.id]: {
                          amendment_number: saved.amendment_number,
                          designation: saved.designation ?? null,
                          os_number: saved.os_number ?? null,
                          amount_ht: saved.amount_ht,
                          amendment_type: saved.amendment_type ?? "ts",
                          signature_status:
                            saved.signature_status ?? "chez_entreprise",
                          internal_comment: saved.internal_comment ?? null,
                        },
                      }));
                      setEditing(null);
                    }}
                  />
                ) : (
                  <div className="flex flex-wrap items-start justify-between gap-3 px-4 py-3">
                    <div>
                      <p className="font-medium">
                        Avenant n°{amendment.amendment_number}
                        {amendment.designation && ` — ${amendment.designation}`}
                      </p>
                      <p className="text-sm text-slate-600">
                        {AMENDMENT_TYPE_LABELS[amendment.amendment_type]} ·{" "}
                        {AMENDMENT_SIGNATURE_STATUS_LABELS[amendment.signature_status]} ·{" "}
                        {formatCurrency(Number(amendment.amount_ht))} H.T.
                      </p>
                      {amendment.internal_comment && (
                        <p className="mt-1 text-sm text-slate-500">
                          {amendment.internal_comment}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setEditing({
                          amendmentId: amendment.id,
                          lotId: lot.id,
                          form: {
                            amendment_number: amendment.amendment_number,
                            designation: amendment.designation ?? undefined,
                            os_number: amendment.os_number ?? undefined,
                            amount_ht: Number(amendment.amount_ht),
                            amendment_type: amendment.amendment_type,
                            signature_status: amendment.signature_status,
                            internal_comment: amendment.internal_comment ?? undefined,
                          },
                        })
                      }
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      Modifier
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </section>
  );
}
