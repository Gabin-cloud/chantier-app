import {
  DatabaseErrorNotice,
  SupabaseSetupNotice,
} from "@/components/SupabaseSetupNotice";
import { WorkControlPanel } from "@/components/travaux/WorkControlPanel";
import { getWorkControlPanel } from "@/lib/actions/work-control";
import {
  canEditProject,
  canManageMembers,
  getProjectRole,
} from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ enterprise?: string }>;
};

export default async function TravauxControlePage({
  params,
  searchParams,
}: PageProps) {
  if (!isSupabaseConfigured()) {
    return <SupabaseSetupNotice />;
  }

  const { id } = await params;
  const { enterprise: enterpriseId } = await searchParams;

  try {
    const [data, projectRole] = await Promise.all([
      getWorkControlPanel(id),
      getProjectRole(id),
    ]);

    if (!projectRole) {
      return <DatabaseErrorNotice message="Accès refusé." />;
    }

    const canEdit = canEditProject(projectRole);
    const canAdmin = canManageMembers(projectRole);

    return (
      <div className="space-y-4">
        <header>
          <h2 className="text-lg font-semibold text-slate-900">
            Contrôle des points de vérification
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Suivi détaillé par phase, plan et niveau. L&apos;administrateur définit
            les points de contrôle ; les équipes terrain renseignent les résultats.
          </p>
        </header>
        <WorkControlPanel
          projectId={id}
          data={data}
          canEdit={canEdit || projectRole === "terrain"}
          canAdmin={canAdmin}
          initialEnterpriseId={enterpriseId}
        />
      </div>
    );
  } catch (error) {
    return (
      <DatabaseErrorNotice
        message={error instanceof Error ? error.message : "Erreur de chargement."}
      />
    );
  }
}
