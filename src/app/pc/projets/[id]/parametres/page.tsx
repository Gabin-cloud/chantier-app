import {
  DatabaseErrorNotice,
  SupabaseSetupNotice,
} from "@/components/SupabaseSetupNotice";
import { OperationParametresView } from "@/components/projects/OperationParametresView";
import {
  canAccessField,
  canEditProject,
  canManageMembers,
  getProjectRole,
} from "@/lib/auth/permissions";
import { getEnterpriseEmailInvitations } from "@/lib/actions/invitations";
import {
  getCompanyDirectory,
  getOwnerDirectory,
} from "@/lib/actions/operation-sheet";
import { getProject } from "@/lib/actions/projects";
import type { Enterprise } from "@/lib/types/database";
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
    const [project, directory, ownerDirectory, projectRole] = await Promise.all([
      getProject(id),
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

    const enterpriseIds = (project.enterprises ?? []).map((e: Enterprise) => e.id);
    const invitationMap = await getEnterpriseEmailInvitations(enterpriseIds);

    return (
      <main className="min-h-full bg-slate-50 px-4 py-6 sm:px-6">
        <div className="mx-auto w-full max-w-[110rem]">
          <OperationParametresView
            project={project}
            enterprises={project.enterprises ?? []}
            directory={directory}
            ownerDirectory={ownerDirectory}
            canEdit={canEdit}
            invitationMap={invitationMap}
            backHref={`/pc/projets/${id}/tableau-de-bord`}
          />
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
