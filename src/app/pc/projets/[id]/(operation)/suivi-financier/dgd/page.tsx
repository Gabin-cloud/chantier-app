import { DgdTrackingPanel } from "@/components/finance/DgdTrackingPanel";
import {
  DatabaseErrorNotice,
  SupabaseSetupNotice,
} from "@/components/SupabaseSetupNotice";
import { getDgdTracking } from "@/lib/actions/dgd";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function FinanceDgdPage({ params }: PageProps) {
  if (!isSupabaseConfigured()) {
    return <SupabaseSetupNotice />;
  }

  const { id } = await params;

  try {
    const rows = await getDgdTracking(id);
    return <DgdTrackingPanel projectId={id} rows={rows} />;
  } catch (error) {
    return (
      <DatabaseErrorNotice
        message={
          error instanceof Error ? error.message : "Impossible de charger le suivi DGD."
        }
      />
    );
  }
}
