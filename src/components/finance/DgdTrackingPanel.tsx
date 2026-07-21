"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { SlantedColumnHeader } from "@/components/marche/SlantedColumnHeader";
import { updateDgdBooleanField, updateDgdDateField } from "@/lib/actions/dgd";
import type { FinancialDgdRow } from "@/lib/types/database";

type DgdTrackingPanelProps = {
  projectId: string;
  rows: FinancialDgdRow[];
};

const BORDER = "border border-slate-300";

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
              <th className={`${BORDER} px-2 py-2 text-left font-bold`}>lot n°</th>
              <th className={`${BORDER} px-2 py-2 text-left font-bold`}>lot</th>
              <th className={`${BORDER} px-2 py-2 text-left font-bold`}>Entreprises</th>
              <SlantedColumnHeader label="Projet DGD envoyé par l'entreprise à DANOBAT" />
              <SlantedColumnHeader label="Projet DGD envoyé au MOU pour validation le:" />
              <SlantedColumnHeader label="Réserves de réception levées" title="Réserves de réception levées" />
              <SlantedColumnHeader label="Avis du BC levés" title="Avis du BC levés" />
              <SlantedColumnHeader label="Sous-traitants payés" title="Sous-traitants payés" />
              <SlantedColumnHeader label="CIE ok" title="CIE ok" />
              <SlantedColumnHeader label="Avenants" title="Avenants" />
              <SlantedColumnHeader label="Proposition DGD transmis à l'entreprise le:" />
              <SlantedColumnHeader label="Projet DGD retourné par l'Entreprise à DANOBAT le:" />
              <SlantedColumnHeader label="Exemplaire DGD (signé par Entreprise + DANOBAT) envoyé au Mou le:" />
              <SlantedColumnHeader label="DGD (accepté par le Mou) reçu par DANOBAT le:" />
              <SlantedColumnHeader label="Libération RG / CB le :" />
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
