import {
  DatabaseErrorNotice,
  SupabaseSetupNotice,
} from "@/components/SupabaseSetupNotice";
import { WorkControlSynthesisTable } from "@/components/travaux/WorkControlSynthesisTable";
import { getWorkControlSynthesis } from "@/lib/actions/work-control";
import { getProjectRole } from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function TravauxSynthesePage({ params }: PageProps) {
  if (!isSupabaseConfigured()) {
    return <SupabaseSetupNotice />;
  }

  const { id } = await params;

  try {
    const [data, projectRole] = await Promise.all([
      getWorkControlSynthesis(id),
      getProjectRole(id),
    ]);

    if (!projectRole) {
      return <DatabaseErrorNotice message="Accès refusé." />;
    }

    return (
      <div className="space-y-4">
        <header>
          <h2 className="text-lg font-semibold text-slate-900">
            Synthèse des contrôles
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Conformités et non-conformités par lot et par phase. La colonne Total
            alimente le tableau de bord général de l&apos;opération.
          </p>
        </header>
        <WorkControlSynthesisTable projectId={id} data={data} />
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
