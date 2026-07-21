"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { updateDgdBooleanField, updateDgdDateField } from "@/lib/actions/dgd";
import type { FinancialDgdRow } from "@/lib/types/database";

type DgdTrackingPanelProps = {
  projectId: string;
  rows: FinancialDgdRow[];
};

const BORDER = "border border-slate-300";
const TH = `${BORDER} px-2 py-2 text-left align-top text-[10px] font-bold leading-tight text-slate-800`;

function formatDate(value: string | null): string {
  if (!value) return "";
  return new Date(value).toLocaleDateString("fr-FR");
}

function DateCell({
  projectId,
  entryId,
  field,
  value,
}: {
  projectId: string;
  entryId: string;
  field:
    | "projet_envoye_danobat"
    | "projet_envoye_mou"
    | "proposition_transmise_entreprise"
    | "projet_retourne_entreprise"
    | "exemplaire_signe_envoye_mou"
    | "dgd_accepte_recu_danobat"
    | "liberation_rg_cb";
  value: string | null;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleBlur(e: React.FocusEvent<HTMLInputElement>) {
    const raw = e.target.value;
    startTransition(async () => {
      await updateDgdDateField(projectId, entryId, field, raw || null);
      router.refresh();
    });
  }

  return (
    <input
      type="date"
      defaultValue={value ?? ""}
      onBlur={handleBlur}
      disabled={isPending}
      className="w-full min-w-[7rem] border-0 bg-transparent px-1 py-0.5 text-xs focus:bg-yellow-50 focus:outline-none"
      title={formatDate(value) || "Saisir une date"}
    />
  );
}

function CheckCell({
  projectId,
  entryId,
  field,
  value,
}: {
  projectId: string;
  entryId: string;
  field:
    | "reserves_reception_levees"
    | "avis_bc_leves"
    | "sous_traitants_payes"
    | "cie_ok"
    | "avenants_ok";
  value: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    startTransition(async () => {
      await updateDgdBooleanField(projectId, entryId, field, e.target.checked);
      router.refresh();
    });
  }

  return (
    <input
      type="checkbox"
      defaultChecked={value}
      onChange={handleChange}
      disabled={isPending}
      className="h-4 w-4 accent-violet-600"
    />
  );
}

export function DgdTrackingPanel({ projectId, rows }: DgdTrackingPanelProps) {
  return (
    <section className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <header className="border-b border-slate-200 px-4 py-3">
        <h2 className="text-sm font-semibold text-slate-900">Suivi DGD</h2>
        <p className="mt-0.5 text-xs text-slate-500">
          Décomptes généraux définitifs par lot et entreprise.
        </p>
      </header>

      {rows.length === 0 ? (
        <p className="px-4 py-8 text-sm text-slate-500">
          Aucun lot configuré. Ajoutez des entreprises dans la fiche opération.
        </p>
      ) : (
        <table className={`w-full min-w-[1400px] border-collapse text-xs ${BORDER}`}>
          <thead>
            <tr className="bg-slate-50">
              <th className={TH}>lot n°</th>
              <th className={TH}>lot</th>
              <th className={TH}>Entreprises</th>
              <th className={TH}>Projet DGD envoyé par l&apos;entreprise à DANOBAT</th>
              <th className={TH}>Projet DGD envoyé au MOU pour validation le:</th>
              <th className={`${TH} italic`}>Réserves de réception levées</th>
              <th className={`${TH} italic`}>Avis du BC levés</th>
              <th className={`${TH} italic`}>Sous-traitants payés</th>
              <th className={`${TH} italic`}>CIE ok</th>
              <th className={`${TH} italic`}>Avenants</th>
              <th className={TH}>Proposition DGD transmis à l&apos;entreprise le:</th>
              <th className={TH}>Projet DGD retourné par l&apos;Entreprise à DANOBAT le:</th>
              <th className={TH}>Exemplaire DGD (signé par Entreprise + DANOBAT) envoyé au Mou le:</th>
              <th className={TH}>DGD (accepté par le Mou) reçu par DANOBAT le:</th>
              <th className={TH}>Libération RG / CB le :</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50/50">
                <td className={`${BORDER} px-2 py-1 font-medium`}>{row.lot_number ?? "—"}</td>
                <td className={`${BORDER} px-2 py-1`}>{row.lot_designation ?? "—"}</td>
                <td className={`${BORDER} px-2 py-1 font-medium`}>{row.enterprise_name}</td>
                <td className={`${BORDER} px-1 py-1 text-center`}>
                  <DateCell
                    projectId={projectId}
                    entryId={row.id}
                    field="projet_envoye_danobat"
                    value={row.projet_envoye_danobat}
                  />
                </td>
                <td className={`${BORDER} px-1 py-1 text-center`}>
                  <DateCell
                    projectId={projectId}
                    entryId={row.id}
                    field="projet_envoye_mou"
                    value={row.projet_envoye_mou}
                  />
                </td>
                <td className={`${BORDER} px-1 py-1 text-center italic`}>
                  <CheckCell
                    projectId={projectId}
                    entryId={row.id}
                    field="reserves_reception_levees"
                    value={row.reserves_reception_levees}
                  />
                </td>
                <td className={`${BORDER} px-1 py-1 text-center italic`}>
                  <CheckCell
                    projectId={projectId}
                    entryId={row.id}
                    field="avis_bc_leves"
                    value={row.avis_bc_leves}
                  />
                </td>
                <td className={`${BORDER} px-1 py-1 text-center italic`}>
                  <CheckCell
                    projectId={projectId}
                    entryId={row.id}
                    field="sous_traitants_payes"
                    value={row.sous_traitants_payes}
                  />
                </td>
                <td className={`${BORDER} px-1 py-1 text-center italic`}>
                  <CheckCell
                    projectId={projectId}
                    entryId={row.id}
                    field="cie_ok"
                    value={row.cie_ok}
                  />
                </td>
                <td className={`${BORDER} px-1 py-1 text-center italic`}>
                  <CheckCell
                    projectId={projectId}
                    entryId={row.id}
                    field="avenants_ok"
                    value={row.avenants_ok}
                  />
                </td>
                <td className={`${BORDER} px-1 py-1 text-center`}>
                  <DateCell
                    projectId={projectId}
                    entryId={row.id}
                    field="proposition_transmise_entreprise"
                    value={row.proposition_transmise_entreprise}
                  />
                </td>
                <td className={`${BORDER} px-1 py-1 text-center`}>
                  <DateCell
                    projectId={projectId}
                    entryId={row.id}
                    field="projet_retourne_entreprise"
                    value={row.projet_retourne_entreprise}
                  />
                </td>
                <td className={`${BORDER} px-1 py-1 text-center`}>
                  <DateCell
                    projectId={projectId}
                    entryId={row.id}
                    field="exemplaire_signe_envoye_mou"
                    value={row.exemplaire_signe_envoye_mou}
                  />
                </td>
                <td className={`${BORDER} px-1 py-1 text-center`}>
                  <DateCell
                    projectId={projectId}
                    entryId={row.id}
                    field="dgd_accepte_recu_danobat"
                    value={row.dgd_accepte_recu_danobat}
                  />
                </td>
                <td className={`${BORDER} px-1 py-1 text-center`}>
                  <DateCell
                    projectId={projectId}
                    entryId={row.id}
                    field="liberation_rg_cb"
                    value={row.liberation_rg_cb}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
