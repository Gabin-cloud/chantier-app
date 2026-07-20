import {
  DatabaseErrorNotice,
  SupabaseSetupNotice,
} from "@/components/SupabaseSetupNotice";
import { WorkControlPanel } from "@/components/travaux/WorkControlPanel";
import { getWorkControlPanel } from "@/lib/actions/work-control";
import { canManageMembers, getProjectRole } from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function TravauxControlePage({ params }: PageProps) {
  if (!isSupabaseConfigured()) {
    return <SupabaseSetupNotice />;
  }

  const { id } = await params;

  try {
    const [data, projectRole] = await Promise.all([
      getWorkControlPanel(id),
      getProjectRole(id),
    ]);

    if (!projectRole) {
      return <DatabaseErrorNotice message="Accès refusé." />;
    }

    const canAdmin = canManageMembers(projectRole);

    return (
      <div className="space-y-4">
        <header>
          <h2 className="text-lg font-semibold text-slate-900">
            Contrôle des points de vérification
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Suivi en lecture seule alimenté par la tablette. L&apos;administrateur
            peut dispenser un niveau ou suivre les attestations entreprise.
          </p>
        </header>
        <WorkControlPanel
          projectId={id}
          data={data}
          canAdmin={canAdmin}
          settingsHref={`/pc/projets/${id}/parametres?tab=controles`}
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
