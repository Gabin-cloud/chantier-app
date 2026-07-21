import { TmaTrackingPanel } from "@/components/travaux/TmaTrackingPanel";
import {
  DatabaseErrorNotice,
  SupabaseSetupNotice,
} from "@/components/SupabaseSetupNotice";
import { getM365DraftReadiness } from "@/lib/actions/control-board";
import { getProject } from "@/lib/actions/projects";
import { getTmaEntries } from "@/lib/actions/tma";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function TmaPage({ params }: PageProps) {
  if (!isSupabaseConfigured()) {
    return <SupabaseSetupNotice />;
  }

  const { id } = await params;

  try {
    const [entries, project, m365] = await Promise.all([
      getTmaEntries(id),
      getProject(id),
      getM365DraftReadiness(),
    ]);
    return (
      <TmaTrackingPanel
        projectId={id}
        projectName={project.name}
        entries={entries}
        enterprises={project.enterprises ?? []}
        m365Ready={m365.ready}
      />
    );
  } catch (error) {
    return (
      <DatabaseErrorNotice
        message={
          error instanceof Error ? error.message : "Impossible de charger le suivi TMA."
        }
      />
    );
  }
}
