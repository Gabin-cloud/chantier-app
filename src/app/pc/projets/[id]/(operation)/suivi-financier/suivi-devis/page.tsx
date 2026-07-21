import { QuoteTrackingTable } from "@/components/finance/QuoteTrackingTable";
import {
  DatabaseErrorNotice,
  SupabaseSetupNotice,
} from "@/components/SupabaseSetupNotice";
import { getProjectQuotes } from "@/lib/actions/quotes";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function SuiviDevisPage({ params }: PageProps) {
  if (!isSupabaseConfigured()) {
    return <SupabaseSetupNotice />;
  }

  const { id } = await params;

  try {
    const quotes = await getProjectQuotes(id);
    return <QuoteTrackingTable projectId={id} quotes={quotes} />;
  } catch (error) {
    return (
      <DatabaseErrorNotice
        message={
          error instanceof Error ? error.message : "Impossible de charger le suivi des devis."
        }
      />
    );
  }
}
