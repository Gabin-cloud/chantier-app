import { SituationForm } from "@/components/finance/SituationForm";
import {
  DatabaseErrorNotice,
  SupabaseSetupNotice,
} from "@/components/SupabaseSetupNotice";
import { getFinancialFileUrl, getSituation } from "@/lib/actions/finance";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type PageProps = {
  params: Promise<{ id: string; lotId: string; situationId: string }>;
};

export default async function EditSituationTravauxPage({ params }: PageProps) {
  if (!isSupabaseConfigured()) {
    return <SupabaseSetupNotice />;
  }

  const { id, lotId, situationId } = await params;

  try {
    const situation = await getSituation(id, lotId, situationId);
    const lot = situation.enterprise;
    const invoiceUrl = situation.invoice_file_path
      ? await getFinancialFileUrl(id, situation.invoice_file_path)
      : null;

    return (
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <SituationForm
          project={lot.project}
          lot={lot}
          situation={situation}
          invoiceUrl={invoiceUrl}
        />
      </section>
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
