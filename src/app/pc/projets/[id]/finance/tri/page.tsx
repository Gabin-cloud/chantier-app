import { FinanceLayout } from "@/components/finance/FinanceLayout";
import { IncomingFilesTable } from "@/components/finance/IncomingFilesTable";
import {
  DatabaseErrorNotice,
  SupabaseSetupNotice,
} from "@/components/SupabaseSetupNotice";
import {
  getIncomingFileUrl,
  getIncomingFiles,
} from "@/lib/actions/incoming-files";
import { getProject } from "@/lib/actions/projects";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function TriFichiersPage({ params }: PageProps) {
  if (!isSupabaseConfigured()) {
    return <SupabaseSetupNotice />;
  }

  const { id } = await params;

  try {
    const [project, files] = await Promise.all([
      getProject(id),
      getIncomingFiles(id),
    ]);

    const fileUrls: Record<string, string> = {};
    for (const file of files) {
      fileUrls[file.id] = await getIncomingFileUrl(file.file_path);
    }

    return (
      <FinanceLayout
        title="Boîte de tri"
        subtitle={`${project.name} — fichiers classés depuis les mails`}
      >
        <IncomingFilesTable files={files} fileUrls={fileUrls} />
      </FinanceLayout>
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
