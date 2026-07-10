import Link from "next/link";
import { SituationForm } from "@/components/finance/SituationForm";
import {
  DatabaseErrorNotice,
  SupabaseSetupNotice,
} from "@/components/SupabaseSetupNotice";
import { getLot } from "@/lib/actions/finance";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type PageProps = {
  params: Promise<{ id: string; lotId: string }>;
};

export default async function NewSituationPage({ params }: PageProps) {
  if (!isSupabaseConfigured()) {
    return <SupabaseSetupNotice />;
  }

  const { id, lotId } = await params;

  try {
    const lot = await getLot(id, lotId);

    return (
      <main className="min-h-full bg-slate-50 px-6 py-8">
        <div className="mx-auto w-full max-w-6xl">
          <Link
            href={`/pc/projets/${id}/finance/situations/${lotId}`}
            className="text-sm font-medium text-slate-400 hover:text-slate-600"
          >
            ← Retour aux situations
          </Link>
          <div className="mt-4">
            <SituationForm project={lot.project} lot={lot} isNew />
          </div>
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
