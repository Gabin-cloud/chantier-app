import Link from "next/link";
import { OperationSheet } from "@/components/projects/OperationSheet";
import { ProjectSettings } from "@/components/projects/ProjectSettings";
import {
  DatabaseErrorNotice,
  SupabaseSetupNotice,
} from "@/components/SupabaseSetupNotice";
import {
  canAccessField,
  canEditProject,
  canManageMembers,
  getProjectRole,
} from "@/lib/auth/permissions";
import { getEnterpriseAccessForProject } from "@/lib/actions/enterprise-access";
import { getProjectMembers } from "@/lib/actions/members";
import { getProjectLocations } from "@/lib/actions/locations";
import { getPlanFolders, getPlansWithUrls } from "@/lib/actions/plans";
import { getProjectChecklistItems } from "@/lib/actions/checklist";
import { getCompanyDirectory } from "@/lib/actions/operation-sheet";
import { getProjectPhases } from "@/lib/actions/phases";
import { getProjectZones } from "@/lib/actions/zones";
import { getProject } from "@/lib/actions/projects";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function PcParametresPage({ params }: PageProps) {
  if (!isSupabaseConfigured()) {
    return <SupabaseSetupNotice />;
  }

  const { id } = await params;

  try {
    const [project, plans, planFolders, phases, checklistItems, zones, members, enterpriseAccess, locations, directory, projectRole] = await Promise.all([
      getProject(id),
      getPlansWithUrls(id),
      getPlanFolders(id),
      getProjectPhases(id),
      getProjectChecklistItems(id),
      getProjectZones(id),
      getProjectMembers(id),
      getEnterpriseAccessForProject(id).catch(() => []),
      getProjectLocations(id).catch(() => []),
      getCompanyDirectory().catch(() => []),
      getProjectRole(id),
    ]);

    if (!projectRole) {
      return <DatabaseErrorNotice message="Accès refusé à ce projet." />;
    }

    const canEdit = canEditProject(projectRole);
    const canManage = canManageMembers(projectRole);
    const canPlans = canAccessField(projectRole);

    if (!canEdit && !canManage && !canPlans) {
      return (
        <DatabaseErrorNotice message="Droits insuffisants pour accéder aux paramètres." />
      );
    }

    return (
      <main className="min-h-full bg-slate-50 px-6 py-8">
        <div className="mx-auto w-full max-w-4xl">
          <Link
            href={`/pc/projets/${id}/tableau-de-bord`}
            className="text-sm font-medium text-slate-400 hover:text-slate-600"
          >
            ← Retour à l&apos;opération
          </Link>
          <header className="mb-6 mt-4 rounded-xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
            <h1 className="text-2xl font-semibold text-slate-900">Fiche opération</h1>
            <p className="mt-2 text-slate-500">
              {project.name} — configuration complète de l&apos;opération.
            </p>
          </header>

          {canEdit || canPlans ? (
            <OperationSheet
              project={project}
              enterprises={project.enterprises ?? []}
              directory={directory}
              canEdit={canEdit}
            />
          ) : null}

          <div className="mt-10">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
              Configuration avancée
            </h2>
            <ProjectSettings
              project={project}
              enterprises={project.enterprises ?? []}
              plans={plans}
              planFolders={planFolders}
              phases={phases}
              zones={zones}
              checklistItems={checklistItems}
              locations={locations}
              members={members}
              enterpriseAccess={enterpriseAccess}
              basePath="pc"
              canEdit={canEdit}
              canManageMembers={canManage}
              canEditPlans={canPlans}
              showProjectInfo={false}
              showSharePoint={false}
            />
          </div>
        </div>
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
