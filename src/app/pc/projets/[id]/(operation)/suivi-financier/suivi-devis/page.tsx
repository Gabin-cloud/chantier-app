import { QuoteTrackingPanel } from "@/components/finance/QuoteTrackingPanel";
import {
  DatabaseErrorNotice,
  SupabaseSetupNotice,
} from "@/components/SupabaseSetupNotice";
import { getM365DraftReadiness } from "@/lib/actions/control-board";
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
    const [quotes, project, m365] = await Promise.all([
      getProjectQuotes(id),
      getProject(id),
      getM365DraftReadiness(),
    ]);
    return (
      <QuoteTrackingPanel
        projectId={id}
        quotes={quotes}
        project={project}
        m365Ready={m365.ready}
      />
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
