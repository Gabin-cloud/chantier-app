import Link from "next/link";
import { FinanceLayout } from "@/components/finance/FinanceLayout";
import { formatCurrency } from "@/lib/finance/calculations";
import {
  DatabaseErrorNotice,
  SupabaseSetupNotice,
} from "@/components/SupabaseSetupNotice";
import { getProjectFinancialData } from "@/lib/actions/finance";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { LotWithFinancials } from "@/lib/types/database";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function FinanceSituationsPage({ params }: PageProps) {
  if (!isSupabaseConfigured()) {
    return <SupabaseSetupNotice />;
  }

  const { id } = await params;

  try {
    const project = await getProjectFinancialData(id);
    const lots = (project.enterprises ?? []) as LotWithFinancials[];

    return (
      <FinanceLayout
        title="Situations de travaux"
        subtitle="Sélectionnez un lot pour saisir ou consulter ses situations mensuelles."
      >
        {lots.length === 0 ? (
          <p className="rounded-2xl bg-white p-5 text-sm text-slate-500 shadow-sm">
            Aucun lot configuré.{" "}
            <Link
              href={`/pc/projets/${id}/finance/lots`}
              className="font-medium text-blue-600 hover:text-blue-700"
            >
              Ajouter des lots
            </Link>
          </p>
        ) : (
          <div className="overflow-x-auto rounded-2xl bg-white shadow-sm">
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
                  <tr key={lot.id} className="border-b border-slate-100">
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
                        href={`/pc/projets/${id}/finance/situations/${lot.id}`}
                        className="rounded-lg bg-blue-50 px-3 py-1.5 font-medium text-blue-700 hover:bg-blue-100"
                      >
                        Ouvrir
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </FinanceLayout>
    );
  } catch (error) {
    return (
      <DatabaseErrorNotice
        message={
          error instanceof Error ? error.message : "Projet introuvable."
        }
      />
    );
  }
}
