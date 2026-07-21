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

export default async function NewSituationTravauxPage({ params }: PageProps) {
  if (!isSupabaseConfigured()) {
    return <SupabaseSetupNotice />;
  }

  const { id, lotId } = await params;

  try {
    const lot = await getLot(id, lotId);

    return (
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <SituationForm project={lot.project} lot={lot} isNew />
      </section>
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
