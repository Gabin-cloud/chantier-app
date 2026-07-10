import { FinanceLayout } from "@/components/finance/FinanceLayout";
import { LotDetail } from "@/components/finance/LotDetail";
import {
  DatabaseErrorNotice,
  SupabaseSetupNotice,
} from "@/components/SupabaseSetupNotice";
import { getLot } from "@/lib/actions/finance";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type PageProps = {
  params: Promise<{ id: string; lotId: string }>;
};

export default async function FinanceLotDetailPage({ params }: PageProps) {
  if (!isSupabaseConfigured()) {
    return <SupabaseSetupNotice />;
  }

  const { id, lotId } = await params;

  try {
    const lot = await getLot(id, lotId);

    return (
      <FinanceLayout
        title={`Lot ${lot.lot_number}`}
        subtitle={`${lot.designation} — ${lot.name}`}
      >
        <LotDetail project={lot.project} lot={lot} />
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
