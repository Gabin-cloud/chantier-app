import { ProjectList } from "@/components/projects/ProjectList";
import {
  DatabaseErrorNotice,
  SupabaseSetupNotice,
} from "@/components/SupabaseSetupNotice";
import { getProjects } from "@/lib/actions/projects";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default async function TabletteHomePage() {
  if (!isSupabaseConfigured()) {
    return <SupabaseSetupNotice />;
  }

  try {
    const projects = await getProjects();

    return (
      <main className="min-h-full bg-zinc-100 px-4 py-6 sm:px-6">
        <ProjectList projects={projects} basePath="tablette" />
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
