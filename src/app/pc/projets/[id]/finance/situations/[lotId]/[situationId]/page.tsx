import { FinanceLayout } from "@/components/finance/FinanceLayout";
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

export default async function EditSituationPage({ params }: PageProps) {
  if (!isSupabaseConfigured()) {
    return <SupabaseSetupNotice />;
  }

  const { id, lotId, situationId } = await params;

  try {
    const situation = await getSituation(id, lotId, situationId);
    const lot = situation.enterprise;
    const invoiceUrl = situation.invoice_file_path
      ? await getFinancialFileUrl(situation.invoice_file_path)
      : null;

    return (
      <FinanceLayout
        title={`Situation n°${situation.situation_number}`}
        subtitle={`Lot ${lot.lot_number} — ${lot.name}`}
      >
        <SituationForm
          project={lot.project}
          lot={lot}
          situation={situation}
          invoiceUrl={invoiceUrl}
        />
      </FinanceLayout>
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
