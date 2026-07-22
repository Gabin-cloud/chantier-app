import { TmaTabletControlPanel } from "@/components/travaux/TmaTabletControlPanel";
import {
  DatabaseErrorNotice,
  SupabaseSetupNotice,
} from "@/components/SupabaseSetupNotice";
import { getProjectRole } from "@/lib/auth/permissions";
import { getProject } from "@/lib/actions/projects";
import { getTmaEntries } from "@/lib/actions/tma";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function TabletteTmaControlePage({ params }: PageProps) {
  if (!isSupabaseConfigured()) {
    return <SupabaseSetupNotice />;
  }

  const { id } = await params;

  try {
    const [project, entries, projectRole] = await Promise.all([
      getProject(id),
      getTmaEntries(id),
      getProjectRole(id),
    ]);

    if (!projectRole) {
      return <DatabaseErrorNotice message="Accès refusé à ce projet." />;
    }

    return (
      <main className="min-h-full px-4 py-6 sm:px-6">
        <TmaTabletControlPanel
          projectId={id}
          projectName={project.name}
          entries={entries}
        />
      </main>
    );
  } catch (error) {
    return (
      <DatabaseErrorNotice
        message={error instanceof Error ? error.message : "Impossible de charger le contrôle TMA."}
      />
    );
  }
}
