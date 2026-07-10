import { ProjectList } from "@/components/projects/ProjectList";
import {
  DatabaseErrorNotice,
  SupabaseSetupNotice,
} from "@/components/SupabaseSetupNotice";
import { getProjects } from "@/lib/actions/projects";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default async function PcHomePage() {
  if (!isSupabaseConfigured()) {
    return <SupabaseSetupNotice />;
  }

  try {
    const projects = await getProjects();

    return (
      <main className="min-h-full bg-slate-50 px-6 py-8">
        <ProjectList projects={projects} basePath="pc" />
      </main>
    );
  } catch (error) {
    return (
      <DatabaseErrorNotice
        message={
          error instanceof Error ? error.message : "Impossible de charger les projets."
        }
      />
    );
  }
}
