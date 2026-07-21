"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  DevisFormFields,
  devisValuesToFormData,
  type DevisFormValues,
} from "@/components/finance/DevisFormFields";
import { formatLotLabel } from "@/components/finance/FileSortForm";
import { ModalPanel } from "@/components/ui/ModalPanel";
import { getQuickSortData, type QuickSortLot } from "@/lib/actions/incoming-files";
import { saveQuote } from "@/lib/actions/quotes";

type AddQuoteModalProps = {
  projectId: string;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
};

const emptyValues = (): DevisFormValues => ({
  quoteNumber: "",
  quoteDate: new Date().toISOString().slice(0, 10),
  designation: "",
  amountHt: "",
  comment: "",
  isCie: false,
  isTs: false,
  isTma: false,
  markRejected: false,
  validatedAt: "",
});

export function AddQuoteModal({
  projectId,
  open,
  onClose,
  onSaved,
}: AddQuoteModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [lots, setLots] = useState<QuickSortLot[]>([]);
  const [enterpriseId, setEnterpriseId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [values, setValues] = useState<DevisFormValues>(emptyValues);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setValues(emptyValues());
    setFile(null);
    setError(null);
    getQuickSortData(projectId)
      .then((data) => {
        setLots(data);
        setEnterpriseId(data[0]?.id ?? "");
      })
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Erreur de chargement.")
      );
  }, [open, projectId]);

  if (!open) return null;

  function handleSubmit() {
    if (!enterpriseId) {
      setError("Veuillez sélectionner un lot / entreprise.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const formData = devisValuesToFormData(values, enterpriseId, file, {
        mode: "new",
      });
      const result = await saveQuote(projectId, formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      onSaved();
    });
  }

  return (
    <ModalPanel
      title="Ajouter un devis"
      subtitle="Saisie manuelle ou import d'un fichier PDF"
      onClose={onClose}
      maxWidth="lg"
    >
      <div className="space-y-4">
        <section>
          <label className="mb-1 block text-xs font-semibold text-slate-600">
            Lot / Entreprise
          </label>
          <select
            value={enterpriseId}
            onChange={(e) => setEnterpriseId(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            {lots.map((lot) => (
              <option key={lot.id} value={lot.id}>
                {formatLotLabel(lot)}
              </option>
            ))}
          </select>
        </section>

        <section>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              const dropped = e.dataTransfer.files[0];
              if (dropped) setFile(dropped);
            }}
            onClick={() => fileInputRef.current?.click()}
            className={`cursor-pointer rounded-xl border-2 border-dashed px-4 py-5 text-center transition-colors ${
              dragOver
                ? "border-blue-400 bg-blue-50"
                : file
                  ? "border-emerald-300 bg-emerald-50"
                  : "border-slate-200 bg-slate-50 hover:border-slate-300"
            }`}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.doc,.docx"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) setFile(f);
              }}
            />
            {file ? (
              <div>
                <p className="font-medium text-emerald-800">{file.name}</p>
                <p className="mt-1 text-xs text-emerald-600">Cliquez pour changer</p>
              </div>
            ) : (
              <div>
                <p className="text-sm font-medium text-slate-700">
                  Glissez le devis ici (optionnel)
                </p>
                <p className="mt-1 text-xs text-slate-500">PDF, images, Word</p>
              </div>
            )}
          </div>
        </section>

        <DevisFormFields values={values} onChange={setValues} mode="new" />

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <div className="flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isPending || !enterpriseId}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
          >
            {isPending ? "Enregistrement…" : "Enregistrer le devis"}
          </button>
        </div>
      </div>
    </ModalPanel>
  );
}
