import Link from "next/link";
import { SituationsRecap } from "@/components/finance/SituationsRecap";
import {
  DatabaseErrorNotice,
  SupabaseSetupNotice,
} from "@/components/SupabaseSetupNotice";
import { getProjectFinancialData } from "@/lib/actions/finance";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function FinanceRecapSituationsPage({ params }: PageProps) {
  if (!isSupabaseConfigured()) {
    return <SupabaseSetupNotice />;
  }

  const { id } = await params;

  try {
    const project = await getProjectFinancialData(id);

    return (
      <main className="min-h-full bg-slate-50 px-6 py-8">
        <div className="mx-auto w-full max-w-5xl">
          <Link
            href={`/pc/projets/${id}/finance`}
            className="text-sm font-medium text-slate-400 hover:text-slate-600"
          >
            ← Suivi financier
          </Link>
          <header className="mb-6 mt-4">
            <h1 className="text-2xl font-bold text-slate-900">Récap situations</h1>
          </header>
          <SituationsRecap project={project} lots={project.enterprises ?? []} />
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
