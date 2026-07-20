import {
  DatabaseErrorNotice,
  SupabaseSetupNotice,
} from "@/components/SupabaseSetupNotice";
import { WorkPlansByTypeManager } from "@/components/travaux/WorkPlansByTypeManager";
import {
  canAccessField,
  canManageMembers,
  getProjectRole,
} from "@/lib/auth/permissions";
import { getWorkPlansByType } from "@/lib/actions/work-control";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function TravauxPlanPage({ params }: PageProps) {
  if (!isSupabaseConfigured()) {
    return <SupabaseSetupNotice />;
  }

  const { id } = await params;

  try {
    const [plansData, projectRole] = await Promise.all([
      getWorkPlansByType(id),
      getProjectRole(id),
    ]);

    if (!projectRole) {
      return <DatabaseErrorNotice message="Accès refusé." />;
    }

    const canPlans = canAccessField(projectRole);
    const canAdmin = canManageMembers(projectRole);

    return (
      <div className="space-y-6">
        <header>
          <h2 className="text-lg font-semibold text-slate-900">Plans</h2>
          <p className="mt-1 text-sm text-slate-500">
            Gérez les plans PDF par type de support (architecte, béton, ELEX,
            plomberie…). Les types alimentent les points de contrôle.
          </p>
        </header>

        {canPlans ? (
          <WorkPlansByTypeManager
            projectId={id}
            planTypes={plansData.planTypes}
            plans={plansData.plans}
            canEdit={canPlans}
            canAdmin={canAdmin}
          />
        ) : (
          <p className="text-sm text-slate-500">
            Droits insuffisants pour gérer les plans.
          </p>
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
