import { ProjectHub } from "@/components/projects/ProjectHub";
import {
  DatabaseErrorNotice,
  SupabaseSetupNotice,
} from "@/components/SupabaseSetupNotice";
import { getProjectRole } from "@/lib/auth/permissions";
import { getProject } from "@/lib/actions/projects";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ProjetPage({ params }: PageProps) {
  if (!isSupabaseConfigured()) {
    return <SupabaseSetupNotice />;
  }

  const { id } = await params;

  try {
    const project = await getProject(id);
    const projectRole = await getProjectRole(id);

    if (!projectRole) {
      return <DatabaseErrorNotice message="Accès refusé à ce projet." />;
    }

    return (
      <main className="min-h-full bg-zinc-100 px-4 py-6 sm:px-6">
        <ProjectHub
          project={project}
          basePath="tablette"
          projectRole={projectRole}
        />
      </main>
    );
  } catch (error) {
    return (
      <DatabaseErrorNotice
        message={
          error instanceof Error ? error.message : "Projet introuvable."
        }
      />
    );
  }
}
