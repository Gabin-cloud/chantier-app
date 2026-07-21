import { SituationsTravauxPanel } from "@/components/finance/SituationsTravauxPanel";
import {
  DatabaseErrorNotice,
  SupabaseSetupNotice,
} from "@/components/SupabaseSetupNotice";
import { getProjectFinancialData } from "@/lib/actions/finance";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function SituationTravauxPage({ params }: PageProps) {
  if (!isSupabaseConfigured()) {
    return <SupabaseSetupNotice />;
  }

  const { id } = await params;

  try {
    const project = await getProjectFinancialData(id);
    return (
      <SituationsTravauxPanel
        project={project}
        projectId={id}
        lots={project.enterprises ?? []}
      />
    );
  } catch (error) {
    return (
      <DatabaseErrorNotice
        message={
          error instanceof Error
            ? error.message
            : "Impossible de charger les situations de travaux."
        }
      />
    );
  }
}
