import Link from "next/link";
import { formatCurrency } from "@/lib/finance/calculations";
import type { LotWithFinancials, Project } from "@/lib/types/database";

type SituationsTravauxPanelProps = {
  project: Project;
  projectId: string;
  lots: LotWithFinancials[];
};

export function SituationsTravauxPanel({
  project,
  projectId,
  lots,
}: SituationsTravauxPanelProps) {
  return (
    <section className="overflow-x-auto rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="mb-1 text-lg font-semibold text-slate-900">
        Situations de travaux
      </h2>
      <p className="mb-4 text-sm text-slate-500">
        {project.name} — Saisie et consultation des situations mensuelles par lot.
      </p>

      {lots.length === 0 ? (
        <p className="text-sm text-slate-500">
          Aucun lot configuré.{" "}
          <Link
            href={`/pc/projets/${projectId}/finance/lots`}
            className="font-medium text-blue-600 hover:text-blue-700"
          >
            Ajouter des lots
          </Link>
        </p>
      ) : (
        <table className="w-full min-w-[800px] text-sm">
          <thead>
            <tr className="border-b border-slate-200 text-left text-slate-500">
              <th className="px-4 py-3 font-medium">Lot</th>
              <th className="px-4 py-3 font-medium">Entreprise</th>
              <th className="px-4 py-3 font-medium text-right">Marché H.T.</th>
              <th className="px-4 py-3 font-medium text-right">Situations</th>
              <th className="px-4 py-3 font-medium" />
            </tr>
          </thead>
          <tbody>
            {lots.map((lot) => (
              <tr key={lot.id} className="border-b border-slate-100 hover:bg-slate-50">
                <td className="px-4 py-3 font-medium">
                  {lot.lot_number} — {lot.designation}
                </td>
                <td className="px-4 py-3">{lot.name}</td>
                <td className="px-4 py-3 text-right">
                  {formatCurrency(Number(lot.contract_amount_ht))}
                </td>
                <td className="px-4 py-3 text-right">
                  {(lot.situations ?? []).length}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link
                    href={`/pc/projets/${projectId}/suivi-financier/situation-travaux/${lot.id}`}
                    className="rounded-lg bg-blue-50 px-3 py-1.5 font-medium text-blue-700 hover:bg-blue-100"
                  >
                    Ouvrir
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
