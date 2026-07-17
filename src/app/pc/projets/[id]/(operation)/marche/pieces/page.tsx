import { AdminPiecesControlPanel } from "@/components/marche/AdminPiecesControlPanel";
import { DatabaseErrorNotice } from "@/components/SupabaseSetupNotice";
import {
  getEnterpriseAdminControlData,
} from "@/lib/actions/admin-pieces";
import { getM365DraftReadiness } from "@/lib/actions/control-board";
import { canEditProject, getProjectRole } from "@/lib/auth/permissions";
import { getProject } from "@/lib/actions/projects";
import type { Enterprise } from "@/lib/types/database";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ enterprise?: string }>;
};

export default async function MarchePiecesPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { enterprise: enterpriseParam } = await searchParams;

  try {
    const [project, projectRole, m365] = await Promise.all([
      getProject(id),
      getProjectRole(id),
      getM365DraftReadiness(),
    ]);

    const enterprises: Enterprise[] = project.enterprises ?? [];
    const selectedId =
      enterpriseParam && enterprises.some((e) => e.id === enterpriseParam)
        ? enterpriseParam
        : enterprises[0]?.id ?? null;

    const controlData = selectedId
      ? await getEnterpriseAdminControlData(id, selectedId)
      : null;

    const canEdit = projectRole ? canEditProject(projectRole) : false;

    return (
      <AdminPiecesControlPanel
        projectId={id}
        enterprises={enterprises}
        initialEnterpriseId={selectedId}
        controlData={controlData}
        canEdit={canEdit}
        m365Ready={m365.ready}
      />
    );
  } catch (error) {
    return (
      <DatabaseErrorNotice
        message={
          error instanceof Error
            ? error.message
            : "Impossible de charger le contrôle des pièces."
        }
      />
    );
  }
}
