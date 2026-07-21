import { TmaTrackingPanel } from "@/components/travaux/TmaTrackingPanel";
import {
  DatabaseErrorNotice,
  SupabaseSetupNotice,
} from "@/components/SupabaseSetupNotice";
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
    const [entries, project] = await Promise.all([
      getTmaEntries(id),
      getProject(id),
    ]);
    return (
      <TmaTrackingPanel
        projectId={id}
        entries={entries}
        enterprises={project.enterprises ?? []}
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
