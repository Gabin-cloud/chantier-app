import Link from "next/link";
import { ControlBoardPanel } from "@/components/controls/ControlBoardPanel";
import { PcVisitReportsPanel } from "@/components/controls/PcVisitReportsPanel";
import {
  DatabaseErrorNotice,
  SupabaseSetupNotice,
} from "@/components/SupabaseSetupNotice";
import {
  getM365DraftReadiness,
  getPcVisitReports,
  getProjectControlBoard,
  syncControlBoardFromMarkers,
} from "@/lib/actions/control-board";
import { canEditProject, getProjectRole } from "@/lib/auth/permissions";
import { getProjectPhases } from "@/lib/actions/phases";
import { getProject } from "@/lib/actions/projects";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
};

export default async function ControlesPage({ params, searchParams }: PageProps) {
  if (!isSupabaseConfigured()) {
    return <SupabaseSetupNotice />;
  }

  const { id } = await params;
  const { tab } = await searchParams;
  const activeTab = tab === "rapports" ? "rapports" : "tableau";

  try {
    const [project, phases, projectRole] = await Promise.all([
      getProject(id),
      getProjectPhases(id),
      getProjectRole(id),
    ]);

    if (!projectRole) {
      return <DatabaseErrorNotice message="Accès refusé à ce projet." />;
    }

    const canEdit = canEditProject(projectRole);

    if (canEdit) {
      try {
        await syncControlBoardFromMarkers(id);
      } catch {
        // migration 012 peut ne pas être appliquée encore
      }
    }

    const [rows, visits, m365] = await Promise.all([
      getProjectControlBoard(id).catch(() => []),
      getPcVisitReports(id).catch(() => []),
      getM365DraftReadiness(),
    ]);

    return (
      <main className="min-h-full bg-slate-50 px-6 py-8">
        <div className="mx-auto w-full max-w-[1400px]">
          <Link
            href={`/pc/projets/${id}`}
            className="text-sm font-medium text-slate-400 hover:text-slate-600"
          >
            ← Retour au projet
          </Link>
          <header className="mb-6 mt-4 rounded-xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
            <h1 className="text-2xl font-semibold text-slate-900">
              Tableau de contrôle
            </h1>
            <p className="mt-2 text-slate-500">{project.name}</p>
          </header>

          <div className="mb-6 flex gap-2 border-b border-slate-200">
            <Link
              href={`/pc/projets/${id}/controles`}
              className={`rounded-t-lg px-4 py-2.5 text-sm font-semibold ${
                activeTab === "tableau"
                  ? "bg-white text-emerald-700 shadow-sm ring-1 ring-slate-200"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Tableau de contrôle
            </Link>
            <Link
              href={`/pc/projets/${id}/controles?tab=rapports`}
              className={`rounded-t-lg px-4 py-2.5 text-sm font-semibold ${
                activeTab === "rapports"
                  ? "bg-white text-emerald-700 shadow-sm ring-1 ring-slate-200"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              Rapports &amp; brouillons
            </Link>
          </div>

          {activeTab === "tableau" ? (
            <ControlBoardPanel
              projectId={id}
              phases={phases}
              rows={rows}
              canEdit={canEdit}
            />
          ) : (
            <PcVisitReportsPanel
              projectId={id}
              visits={visits}
              canEdit={canEdit}
              m365Ready={m365.ready}
              m365Email={m365.msEmail}
              m365Message={m365.message}
            />
          )}
        </div>
      </main>
    );
  } catch (error) {
    return (
      <DatabaseErrorNotice
        message={
          error instanceof Error ? error.message : "Impossible de charger les contrôles."
        }
      />
    );
  }
}
