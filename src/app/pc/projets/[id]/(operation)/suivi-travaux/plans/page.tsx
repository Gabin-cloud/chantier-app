import {
  DatabaseErrorNotice,
  SupabaseSetupNotice,
} from "@/components/SupabaseSetupNotice";
import { WorkPlansTracking } from "@/components/travaux/WorkPlansTracking";
import { getWorkPlansByType } from "@/lib/actions/work-control";
import { getProjectRole } from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function TravauxPlansPage({ params }: PageProps) {
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

    return (
      <div className="space-y-4">
        <header>
          <h2 className="text-lg font-semibold text-slate-900">
            Suivi des plans
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Vue synthétique des plans importés et de leurs subdivisions par
            discipline.
          </p>
        </header>
        <WorkPlansTracking
          planTypes={plansData.planTypes}
          plans={plansData.plans}
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
