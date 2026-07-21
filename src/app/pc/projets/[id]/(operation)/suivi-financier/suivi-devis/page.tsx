import { QuoteTrackingPanel } from "@/components/finance/QuoteTrackingPanel";
import {
  DatabaseErrorNotice,
  SupabaseSetupNotice,
} from "@/components/SupabaseSetupNotice";
import { getProject } from "@/lib/actions/projects";
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
    const [quotes, project] = await Promise.all([getProjectQuotes(id), getProject(id)]);
    return (
      <QuoteTrackingPanel projectId={id} quotes={quotes} project={project} />
    );
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
