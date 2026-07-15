import { PlanManager } from "@/components/projects/PlanManager";
import {
  DatabaseErrorNotice,
  SupabaseSetupNotice,
} from "@/components/SupabaseSetupNotice";
import { canAccessField, getProjectRole } from "@/lib/auth/permissions";
import { getPlanFolders, getPlansWithUrls } from "@/lib/actions/plans";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function TravauxRapportPage({ params }: PageProps) {
  if (!isSupabaseConfigured()) {
    return <SupabaseSetupNotice />;
  }

  const { id } = await params;

  try {
    const [plans, planFolders, projectRole] = await Promise.all([
      getPlansWithUrls(id),
      getPlanFolders(id),
      getProjectRole(id),
    ]);

    if (!projectRole) {
      return <DatabaseErrorNotice message="Accès refusé." />;
    }

    const canPlans = canAccessField(projectRole);

    return (
      <div className="space-y-6">
        <header>
          <h2 className="text-lg font-semibold text-slate-900">Rapport &amp; plan</h2>
          <p className="mt-1 text-sm text-slate-500">
            Bibliothèque de plans PDF de l&apos;opération.
          </p>
        </header>

        {canPlans ? (
          <PlanManager
            projectId={id}
            initialPlans={plans}
            initialFolders={planFolders}
          />
        ) : (
          <p className="text-sm text-slate-500">Droits insuffisants pour gérer les plans.</p>
        )}
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
