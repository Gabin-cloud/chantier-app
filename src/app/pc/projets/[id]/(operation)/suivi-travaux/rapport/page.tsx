import Link from "next/link";
import {
  DatabaseErrorNotice,
  SupabaseSetupNotice,
} from "@/components/SupabaseSetupNotice";
import { PcVisitReportsPanel } from "@/components/controls/PcVisitReportsPanel";
import {
  getM365DraftReadiness,
  getPcVisitReports,
} from "@/lib/actions/control-board";
import { canEditProject, getProjectRole } from "@/lib/auth/permissions";
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
    const [visits, m365, projectRole] = await Promise.all([
      getPcVisitReports(id),
      getM365DraftReadiness(),
      getProjectRole(id),
    ]);

    if (!projectRole) {
      return <DatabaseErrorNotice message="Accès refusé." />;
    }

    const canEdit = canEditProject(projectRole);

    return (
      <div className="space-y-6">
        <header>
          <h2 className="text-lg font-semibold text-slate-900">
            Rapports de visite
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            PDF généré automatiquement à la fin de chaque visite. Récap
            conformité / NC / remarques libres, puis envoi mail type aux
            entreprises concernées (
            <Link href="/pc/parametres" className="font-semibold text-violet-700 underline">
              modèle dans Paramétrage
            </Link>
            ).
          </p>
        </header>

        <PcVisitReportsPanel
          projectId={id}
          visits={visits}
          canEdit={canEdit}
          m365Ready={m365.ready}
          m365Email={m365.msEmail}
          m365Message={m365.message}
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
