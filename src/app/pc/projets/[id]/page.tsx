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

export default async function PcProjetPage({ params }: PageProps) {
  if (!isSupabaseConfigured()) {
    return <SupabaseSetupNotice />;
  }

  const { id } = await params;

  try {
    const project = await getProject(id);
    const projectRole = await getProjectRole(id);

    if (!projectRole) {
      return (
        <DatabaseErrorNotice message="Accès refusé à ce projet." />
      );
    }

    return (
      <main className="min-h-full bg-slate-50 px-6 py-8">
        <ProjectHub project={project} basePath="pc" projectRole={projectRole} />
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
