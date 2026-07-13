import { PcSousTraitancePanel } from "@/components/finance/PcSousTraitancePanel";
import {
  DatabaseErrorNotice,
  SupabaseSetupNotice,
} from "@/components/SupabaseSetupNotice";
import { getSousTraitanceRequests } from "@/lib/actions/sous-traitance";
import { canEditProject, getProjectRole } from "@/lib/auth/permissions";
import { getProject } from "@/lib/actions/projects";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function PcSousTraitancePage({ params }: PageProps) {
  if (!isSupabaseConfigured()) {
    return <SupabaseSetupNotice />;
  }

  const { id } = await params;

  try {
    const [project, projectRole, requests] = await Promise.all([
      getProject(id),
      getProjectRole(id),
      getSousTraitanceRequests(id),
    ]);

    if (!projectRole) {
      return <DatabaseErrorNotice message="Accès refusé à ce projet." />;
    }

    return (
      <main className="min-h-full bg-slate-50 px-6 py-8">
        <div className="mx-auto max-w-4xl">
          <p className="mb-4 text-sm text-slate-500">{project.name}</p>
          <PcSousTraitancePanel
            projectId={id}
            requests={requests}
            canManage={canEditProject(projectRole)}
          />
        </div>
      </main>
    );
  } catch (error) {
    return (
      <DatabaseErrorNotice
        message={
          error instanceof Error
            ? error.message
            : "Impossible de charger la sous-traitance."
        }
      />
    );
  }
}
