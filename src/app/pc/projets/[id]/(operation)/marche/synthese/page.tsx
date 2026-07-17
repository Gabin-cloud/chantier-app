import { AdminPiecesSyntheseTable } from "@/components/marche/AdminPiecesSyntheseTable";
import { ProjectAdminPiecesConfig } from "@/components/marche/ProjectAdminPiecesConfig";
import { DatabaseErrorNotice } from "@/components/SupabaseSetupNotice";
import {
  getAdminPieceTemplates,
  getAdminSyntheseData,
  getProjectAdminPieces,
} from "@/lib/actions/admin-pieces";
import { canEditProject, getProjectRole } from "@/lib/auth/permissions";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function MarcheSynthesePage({ params }: PageProps) {
  const { id } = await params;

  try {
    const [data, pieces, templates, projectRole] = await Promise.all([
      getAdminSyntheseData(id),
      getProjectAdminPieces(id),
      getAdminPieceTemplates(),
      getProjectRole(id),
    ]);

    const canEdit = projectRole ? canEditProject(projectRole) : false;

    return (
      <div className="space-y-4">
        <AdminPiecesSyntheseTable projectId={id} data={data} />
        <ProjectAdminPiecesConfig
          projectId={id}
          pieces={pieces}
          templates={templates}
          canEdit={canEdit}
        />
      </div>
    );
  } catch (error) {
    return (
      <DatabaseErrorNotice
        message={
          error instanceof Error
            ? error.message
            : "Impossible de charger la synthèse administrative."
        }
      />
    );
  }
}
