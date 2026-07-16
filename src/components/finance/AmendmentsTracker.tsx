"use client";

import { useState, useTransition } from "react";
import { upsertAmendment } from "@/lib/actions/finance";
import { FormField, financeInputClass } from "@/components/finance/FormField";
import { MoneyInput } from "@/components/finance/MoneyInput";
import {
  AMENDMENT_SIGNATURE_STATUS_LABELS,
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

const signatureStatuses = Object.keys(
  AMENDMENT_SIGNATURE_STATUS_LABELS
) as AmendmentSignatureStatus[];

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
  onSaved: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const form = new FormData(e.currentTarget);
    const payload: AmendmentFormData = {
      amendment_number: Number(form.get("amendment_number")),
      designation: (form.get("designation") as string).trim() || undefined,
      os_number: (form.get("os_number") as string).trim() || undefined,
      amount_ht: Number(form.get("amount_ht")),
      amendment_type: form.get("amendment_type") as AmendmentType,
      signature_status: form.get("signature_status") as AmendmentSignatureStatus,
      internal_comment:
        (form.get("internal_comment") as string).trim() || undefined,
    };

    startTransition(async () => {
      try {
        await upsertAmendment(projectId, lotId, payload, amendment.id);
        onSaved();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Une erreur est survenue.");
      }
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
  const [savedTick, setSavedTick] = useState(0);

  const lotsWithAmendments = lots
    .map((lot) => ({
      lot,
      amendments: [...(lot.amendments ?? [])].sort(
        (a, b) => a.amendment_number - b.amendment_number
      ),
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
        <div key={`${lot.id}-${savedTick}`} className="space-y-3">
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
                    onSaved={() => {
                      setEditing(null);
                      setSavedTick((value) => value + 1);
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
