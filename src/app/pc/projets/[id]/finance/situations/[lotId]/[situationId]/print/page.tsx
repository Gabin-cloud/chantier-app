import Link from "next/link";
import { SituationCertificate } from "@/components/finance/SituationCertificate";
import {
  DatabaseErrorNotice,
  SupabaseSetupNotice,
} from "@/components/SupabaseSetupNotice";
import { getSituation } from "@/lib/actions/finance";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type PageProps = {
  params: Promise<{ id: string; lotId: string; situationId: string }>;
};

export default async function PrintSituationPage({ params }: PageProps) {
  if (!isSupabaseConfigured()) {
    return <SupabaseSetupNotice />;
  }

  const { id, lotId, situationId } = await params;

  try {
    const situation = await getSituation(id, lotId, situationId);
    const lot = situation.enterprise;

    return (
      <main className="min-h-full bg-slate-100 px-6 py-8 print:bg-white print:p-0">
        <div className="mx-auto max-w-4xl print:max-w-none">
          <Link
            href={`/pc/projets/${id}/finance/situations/${lotId}/${situationId}`}
            className="no-print mb-4 inline-block text-sm font-medium text-slate-400 hover:text-slate-600"
          >
            ← Retour à la situation
          </Link>
          <SituationCertificate
            project={lot.project}
            lot={lot}
            situation={situation}
            delegations={situation.financial_situation_delegations ?? []}
          />
        </div>
      </main>
    );
  } catch (error) {
    return (
      <DatabaseErrorNotice
        message={
          error instanceof Error ? error.message : "Situation introuvable."
        }
      />
    );
  }
}
