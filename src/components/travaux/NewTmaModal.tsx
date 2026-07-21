"use client";

import { useEffect, useState, useTransition } from "react";
import { AppFormField } from "@/components/ui/AppFormField";
import { ModalPanel } from "@/components/ui/ModalPanel";
import { createTmaEntry, type TmaFormData } from "@/lib/actions/tma";
import type { Enterprise } from "@/lib/types/database";

type NewTmaModalProps = {
  projectId: string;
  enterprises: Enterprise[];
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
};

const emptyForm = (): TmaFormData => ({
  logementNumber: "",
  localisation: "",
  modifDemandeeLe: "",
  natureTravaux: "",
  enterpriseId: "",
  enterpriseName: "",
  devisNumber: "",
  devisRecuLe: "",
  mouEnvoi: "",
  mouAcceptation: "",
  montantHt: "",
});

export function NewTmaModal({
  projectId,
  enterprises,
  open,
  onClose,
  onSaved,
}: NewTmaModalProps) {
  const [isPending, startTransition] = useTransition();
  const [values, setValues] = useState<TmaFormData>(emptyForm);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setValues(emptyForm());
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  function setField<K extends keyof TmaFormData>(key: K, value: TmaFormData[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const result = await createTmaEntry(projectId, values);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSaved();
      onClose();
    });
  }

  return (
    <ModalPanel
      title="Nouvelle TMA"
      subtitle="Questionnaire de saisie rapide pour le tableau TMA"
      onClose={onClose}
      maxWidth="xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <AppFormField
            label="Logt n°"
            name="logement_number"
            value={values.logementNumber}
            onChange={(v) => setField("logementNumber", v)}
            required
          />
          <AppFormField
            label="Localisation"
            name="localisation"
            value={values.localisation}
            onChange={(v) => setField("localisation", v)}
          />
        </div>

        <AppFormField label="Modif demandée le" name="modif_demandee_le">
          <input
            id="modif_demandee_le"
            name="modif_demandee_le"
            type="date"
            value={values.modifDemandeeLe}
            onChange={(e) => setField("modifDemandeeLe", e.target.value)}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
          />
        </AppFormField>

        <AppFormField
          label="Nature des travaux modificatifs"
          name="nature_travaux"
          value={values.natureTravaux}
          onChange={(v) => setField("natureTravaux", v)}
          required
        />

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-slate-700">
              Entreprise concernée
            </label>
            <select
              value={values.enterpriseId}
              onChange={(e) => {
                const id = e.target.value;
                const ent = enterprises.find((x) => x.id === id);
                setField("enterpriseId", id);
                if (ent) setField("enterpriseName", ent.name);
              }}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">— Autre / saisie libre —</option>
              {enterprises.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.lot_number ? `Lot ${e.lot_number} — ` : ""}
                  {e.name}
                </option>
              ))}
            </select>
          </div>
          {!values.enterpriseId && (
            <AppFormField
              label="Nom entreprise (libre)"
              name="enterprise_name"
              value={values.enterpriseName}
              onChange={(v) => setField("enterpriseName", v)}
            />
          )}
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            Entreprise — devis
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <AppFormField
              label="N° devis"
              name="devis_number"
              value={values.devisNumber}
              onChange={(v) => setField("devisNumber", v)}
            />
            <AppFormField label="Reçu le" name="devis_recu_le">
              <input
                id="devis_recu_le"
                name="devis_recu_le"
                type="date"
                value={values.devisRecuLe}
                onChange={(e) => setField("devisRecuLe", e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </AppFormField>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            MOU devis
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <AppFormField label="Envoi" name="mou_envoi">
              <input
                id="mou_envoi"
                name="mou_envoi"
                type="date"
                value={values.mouEnvoi}
                onChange={(e) => setField("mouEnvoi", e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </AppFormField>
            <AppFormField label="Acceptation" name="mou_acceptation">
              <input
                id="mou_acceptation"
                name="mou_acceptation"
                type="date"
                value={values.mouAcceptation}
                onChange={(e) => setField("mouAcceptation", e.target.value)}
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              />
            </AppFormField>
          </div>
        </div>

        <AppFormField
          label="Montant H.T."
          name="montant_ht"
          format="money"
          value={values.montantHt}
          onChange={(v) => setField("montantHt", v)}
        />

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Annuler
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {isPending ? "Enregistrement…" : "Ajouter au tableau"}
          </button>
        </div>
      </form>
    </ModalPanel>
  );
}
