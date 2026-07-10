import { FinanceLayout } from "@/components/finance/FinanceLayout";
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
      <FinanceLayout
        title={`Lot ${lot.lot_number} — ${lot.designation}`}
        subtitle={lot.name}
      >
        <LotSituationsList project={lot.project} lot={lot} />
      </FinanceLayout>
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
