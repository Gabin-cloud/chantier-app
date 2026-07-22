"use client";

import { useEffect, useState, useTransition } from "react";
import { AppFormField } from "@/components/ui/AppFormField";
import { ModalPanel } from "@/components/ui/ModalPanel";
import { TmaEmailStep } from "@/components/travaux/TmaEmailStep";
import { saveTmaDossier, getTmaDossierByLogement, type TmaDossierFormData, type TmaLineInput, type TmaTriState } from "@/lib/actions/tma";
import type { Enterprise } from "@/lib/types/database";

type NewTmaModalProps = {
  projectId: string;
  projectName: string;
  enterprises: Enterprise[];
  m365Ready: boolean;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
};

const emptyLine = (): TmaLineInput => ({
  localisation: "",
  enterpriseId: "",
  enterpriseName: "",
  natureTravaux: "",
});

function TriStateGroup({
  label,
  value,
  onChange,
}: {
  label: string;
  value: TmaTriState | "";
  onChange: (v: TmaTriState) => void;
}) {
  const options: { id: TmaTriState; label: string }[] = [
    { id: "oui", label: "Oui" },
    { id: "non", label: "Non" },
    { id: "nc", label: "NC" },
  ];

  return (
    <fieldset>
      <legend className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</legend>
      <div className="flex flex-wrap gap-4">
        {options.map((opt) => (
          <label key={opt.id} className="flex items-center gap-2 text-sm">
            <input
              type="radio"
              name={label}
              checked={value === opt.id}
              onChange={() => onChange(opt.id)}
            />
            {opt.label}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function NewTmaModal({
  projectId,
  projectName,
  enterprises,
  m365Ready,
  open,
  onClose,
  onSaved,
}: NewTmaModalProps) {
  const [isPending, startTransition] = useTransition();
  const [logementNumber, setLogementNumber] = useState("");
  const [nfStatus, setNfStatus] = useState<TmaTriState | "">("");
  const [pmrStatus, setPmrStatus] = useState<TmaTriState | "">("");
  const [lines, setLines] = useState<TmaLineInput[]>([emptyLine()]);
  const [mouFiles, setMouFiles] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [emailDossierId, setEmailDossierId] = useState<string | null>(null);
  const [existingDossierId, setExistingDossierId] = useState<string | null>(null);
  const [loadingDossier, setLoadingDossier] = useState(false);
  const [dossierLoaded, setDossierLoaded] = useState(false);

  useEffect(() => {
    if (open) {
      setLogementNumber("");
      setNfStatus("");
      setPmrStatus("");
      setLines([emptyLine()]);
      setMouFiles([]);
      setError(null);
      setEmailDossierId(null);
      setExistingDossierId(null);
      setDossierLoaded(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open || !logementNumber.trim()) {
      setExistingDossierId(null);
      setDossierLoaded(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoadingDossier(true);
      const result = await getTmaDossierByLogement(projectId, logementNumber);
      setLoadingDossier(false);
      if (!result) {
        setExistingDossierId(null);
        setDossierLoaded(false);
        return;
      }
      setExistingDossierId(result.dossier.id);
      setNfStatus(result.dossier.nf_status ?? "");
      setPmrStatus(result.dossier.pmr_status ?? "");
      setLines(result.lines.length ? result.lines : [emptyLine()]);
      setDossierLoaded(true);
    }, 400);

    return () => clearTimeout(timer);
  }, [open, projectId, logementNumber]);

  if (!open) return null;

  if (emailDossierId) {
    return (
      <TmaEmailStep
        projectId={projectId}
        projectName={projectName}
        dossierId={emailDossierId}
        m365Ready={m365Ready}
        onClose={() => {
          onSaved();
          onClose();
        }}
        onComplete={() => {
          onSaved();
          onClose();
        }}
      />
    );
  }

  function updateLine(index: number, patch: Partial<TmaLineInput>) {
    setLines((prev) => prev.map((line, i) => (i === index ? { ...line, ...patch } : line)));
  }

  function copyFromAbove(index: number, field: "localisation" | "enterprise") {
    if (index === 0) return;
    const above = lines[index - 1];
    if (field === "localisation") {
      updateLine(index, { localisation: above.localisation });
    } else {
      updateLine(index, {
        enterpriseId: above.enterpriseId,
        enterpriseName: above.enterpriseName,
      });
    }
  }

  function buildFormData(markSent: boolean): FormData {
    const payload: TmaDossierFormData = {
      dossierId: existingDossierId ?? undefined,
      logementNumber,
      nfStatus,
      pmrStatus,
      lines,
    };
    const fd = new FormData();
    fd.set("payload", JSON.stringify(payload));
    fd.set("markSent", markSent ? "true" : "false");
    for (const file of mouFiles) fd.append("mouFiles", file);
    return fd;
  }

  function handleSave(markSent: boolean) {
    setError(null);
    startTransition(async () => {
      const fd = buildFormData(markSent);
      const result = await saveTmaDossier(projectId, fd, { markSent });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      if (markSent) {
        setEmailDossierId(result.dossierId);
      } else {
        onSaved();
        onClose();
      }
    });
  }

  return (
    <ModalPanel
      title={existingDossierId ? `TMA logement ${logementNumber}` : "Nouvelle TMA"}
      subtitle={
        existingDossierId
          ? "Dossier existant — modifiez et enregistrez, envoi mail possible ensuite"
          : "Questionnaire de saisie pour le logement"
      }
      onClose={onClose}
      maxWidth="2xl"
    >
      <div className="space-y-5">
        <AppFormField
          label="N° du logement"
          name="logement_number"
          value={logementNumber}
          onChange={setLogementNumber}
          required
        />

        {loadingDossier && (
          <p className="text-xs text-slate-500">Recherche d&apos;un dossier existant…</p>
        )}
        {dossierLoaded && existingDossierId && (
          <p className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs text-blue-900">
            Dossier TMA trouvé pour ce logement. Les lignes existantes sont pré-remplies — vous
            pouvez les modifier puis enregistrer ou envoyer aux entreprises.
          </p>
        )}

        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-xs font-semibold text-slate-600">
                <th className="border-b border-slate-200 px-2 py-2">Localisation</th>
                <th className="border-b border-slate-200 px-2 py-2">Entreprise</th>
                <th className="border-b border-slate-200 px-2 py-2">Nature des travaux</th>
                <th className="w-8 border-b border-slate-200 px-1 py-2" />
              </tr>
            </thead>
            <tbody>
              {lines.map((line, index) => (
                <tr key={index} className="border-b border-slate-100">
                  <td className="px-2 py-1 align-top">
                    <div className="space-y-1">
                      {index > 0 && (
                        <button
                          type="button"
                          onClick={() => copyFromAbove(index, "localisation")}
                          className="text-[10px] text-violet-600 hover:underline"
                        >
                          Identique ligne du dessus
                        </button>
                      )}
                      <input
                        type="text"
                        value={line.localisation}
                        onChange={(e) => updateLine(index, { localisation: e.target.value })}
                        className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs"
                      />
                    </div>
                  </td>
                  <td className="px-2 py-1 align-top">
                    <div className="space-y-1">
                      {index > 0 && (
                        <button
                          type="button"
                          onClick={() => copyFromAbove(index, "enterprise")}
                          className="text-[10px] text-violet-600 hover:underline"
                        >
                          Identique ligne du dessus
                        </button>
                      )}
                      <select
                        value={line.enterpriseId}
                        onChange={(e) => {
                          const id = e.target.value;
                          const ent = enterprises.find((x) => x.id === id);
                          updateLine(index, {
                            enterpriseId: id,
                            enterpriseName: ent?.name ?? "",
                          });
                        }}
                        className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs"
                      >
                        <option value="">— Autre —</option>
                        {enterprises.map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.lot_number ? `Lot ${e.lot_number} — ` : ""}
                            {e.name}
                          </option>
                        ))}
                      </select>
                      {!line.enterpriseId && (
                        <input
                          type="text"
                          value={line.enterpriseName}
                          onChange={(e) => updateLine(index, { enterpriseName: e.target.value })}
                          placeholder="Nom entreprise"
                          className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs"
                        />
                      )}
                    </div>
                  </td>
                  <td className="px-2 py-1 align-top">
                    <input
                      type="text"
                      value={line.natureTravaux}
                      onChange={(e) => updateLine(index, { natureTravaux: e.target.value })}
                      className="w-full rounded border border-slate-300 px-2 py-1.5 text-xs"
                    />
                  </td>
                  <td className="px-1 py-1 text-center align-top">
                    {lines.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setLines((prev) => prev.filter((_, i) => i !== index))}
                        className="text-slate-400 hover:text-red-600"
                      >
                        ✕
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-slate-200 px-2 py-2">
            <button
              type="button"
              onClick={() => setLines((prev) => [...prev, emptyLine()])}
              className="text-xs font-semibold text-violet-600 hover:underline"
            >
              + Ajouter une ligne
            </button>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <TriStateGroup
            label="Le logement reste-t-il NF ?"
            value={nfStatus}
            onChange={setNfStatus}
          />
          <TriStateGroup
            label="Le logement reste-t-il PMR ?"
            value={pmrStatus}
            onChange={setPmrStatus}
          />
        </div>

        {(nfStatus || pmrStatus) && (
          <p className="rounded-lg border border-violet-200 bg-violet-50 px-3 py-2 text-xs text-violet-900">
            <strong>Note :</strong>{" "}
            {nfStatus === "non" && pmrStatus === "non"
              ? "Ce logement perd la certification NF et la conformité PMR suite à cette demande TMA."
              : nfStatus === "non"
                ? "Ce logement perd la partie NF (norme feu) suite à cette demande TMA."
                : pmrStatus === "non"
                  ? "Ce logement perd la partie PMR (accessibilité) suite à cette demande TMA."
                  : nfStatus === "oui" && pmrStatus === "oui"
                    ? "Le logement conserve ses certifications NF et PMR."
                    : nfStatus === "nc" || pmrStatus === "nc"
                      ? "Vérifiez les impacts NF/PMR : une réponse « NC » nécessite une validation complémentaire."
                      : "Précisez l'impact NF et PMR avant envoi aux entreprises."}
          </p>
        )}

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700">
            Documents maître d&apos;ouvrage (zone de dépôt)
          </label>
          <input
            type="file"
            multiple
            accept=".pdf,.doc,.docx,image/*"
            onChange={(e) => setMouFiles(Array.from(e.target.files ?? []))}
            className="block w-full cursor-pointer text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium"
          />
          {mouFiles.length > 0 && (
            <ul className="mt-2 space-y-1 text-xs text-slate-500">
              {mouFiles.map((f) => (
                <li key={`${f.name}-${f.size}`}>{f.name}</li>
              ))}
            </ul>
          )}
        </div>

        {error && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}

        <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            Annuler
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => handleSave(false)}
            className="rounded-lg border border-violet-300 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-800 hover:bg-violet-100 disabled:opacity-50"
          >
            {isPending ? "Enregistrement…" : "Enregistrer"}
          </button>
          <button
            type="button"
            disabled={isPending}
            onClick={() => handleSave(true)}
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {isPending ? "Enregistrement…" : "Envoyer aux entreprises"}
          </button>
        </div>
      </div>
    </ModalPanel>
  );
}
