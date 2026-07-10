import Link from "next/link";
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
      <main className="min-h-full bg-slate-50 px-6 py-8">
        <div className="mx-auto w-full max-w-3xl">
          <Link
            href={`/pc/projets/${id}/finance`}
            className="text-sm font-medium text-slate-400 hover:text-slate-600"
          >
            ← Suivi financier
          </Link>
          <header className="mb-6 mt-4">
            <h1 className="text-2xl font-bold text-slate-900">
              Situations de travaux
            </h1>
            <p className="mt-1 text-slate-500">
              Sélectionnez un lot pour saisir ou consulter ses situations mensuelles.
            </p>
          </header>

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
            <ul className="space-y-3">
              {lots.map((lot) => (
                <li key={lot.id}>
                  <Link
                    href={`/pc/projets/${id}/finance/situations/${lot.id}`}
                    className="block rounded-2xl bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
                  >
                    <p className="font-semibold text-slate-900">
                      {lot.lot_number} — {lot.designation}
                    </p>
                    <p className="text-sm text-slate-500">{lot.name}</p>
                    <p className="mt-2 text-sm text-slate-600">
                      {(lot.situations ?? []).length} situation(s) · Marché{" "}
                      {formatCurrency(Number(lot.contract_amount_ht))} HT
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
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
