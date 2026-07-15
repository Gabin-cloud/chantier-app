import Link from "next/link";
import { OperationAdvancedSettings } from "@/components/projects/OperationAdvancedSettings";
import { OperationSheet } from "@/components/projects/OperationSheet";
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
import { getProjectMembers } from "@/lib/actions/members";
import { getProjectChecklistItems } from "@/lib/actions/checklist";
import {
  getCompanyDirectory,
  getOwnerDirectory,
} from "@/lib/actions/operation-sheet";
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
    const [
      project,
      phases,
      checklistItems,
      zones,
      members,
      directory,
      ownerDirectory,
      projectRole,
    ] = await Promise.all([
      getProject(id),
      getProjectPhases(id),
      getProjectChecklistItems(id),
      getProjectZones(id),
      getProjectMembers(id),
      getCompanyDirectory().catch(() => []),
      getOwnerDirectory().catch(() => []),
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
      <main className="min-h-full bg-slate-50 px-4 py-6 sm:px-6">
        <div className="mx-auto w-full max-w-[110rem]">
          <Link
            href={`/pc/projets/${id}/tableau-de-bord`}
            className="text-sm font-medium text-slate-400 hover:text-slate-600"
          >
            ← Retour à l&apos;opération
          </Link>
          <header className="mb-4 mt-3 rounded-xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
            <h1 className="text-2xl font-semibold text-slate-900">Fiche opération</h1>
            <p className="mt-1 text-slate-500">
              {project.name} — configuration complète de l&apos;opération.
            </p>
          </header>

          {canEdit || canPlans ? (
            <OperationSheet
              project={project}
              enterprises={project.enterprises ?? []}
              directory={directory}
              ownerDirectory={ownerDirectory}
              canEdit={canEdit}
            />
          ) : null}

          <div className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-400">
              Configuration avancée
            </h2>
            <OperationAdvancedSettings
              projectId={id}
              members={members}
              phases={phases}
              zones={zones}
              checklistItems={checklistItems}
              canManageMembers={canManage}
              canEditPlans={canPlans}
              canEdit={canEdit}
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
