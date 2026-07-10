import Link from "next/link";
import { LotSituationsList } from "@/components/finance/LotSituationsList";
import {
  DatabaseErrorNotice,
  SupabaseSetupNotice,
} from "@/components/SupabaseSetupNotice";
import { getLot } from "@/lib/actions/finance";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type PageProps = {
  params: Promise<{ id: string; lotId: string }>;
};

export default async function FinanceLotSituationsPage({ params }: PageProps) {
  if (!isSupabaseConfigured()) {
    return <SupabaseSetupNotice />;
  }

  const { id, lotId } = await params;

  try {
    const lot = await getLot(id, lotId);

    return (
      <main className="min-h-full bg-slate-50 px-6 py-8">
        <div className="mx-auto w-full max-w-3xl">
          <Link
            href={`/pc/projets/${id}/finance/situations`}
            className="text-sm font-medium text-slate-400 hover:text-slate-600"
          >
            ← Situations de travaux
          </Link>
          <LotSituationsList project={lot.project} lot={lot} />
        </div>
      </main>
    );
  } catch (error) {
    return (
      <DatabaseErrorNotice
        message={
          error instanceof Error ? error.message : "Lot introuvable."
        }
      />
    );
  }
}
