import { PrevisionnelPanel } from "@/components/finance/PrevisionnelPanel";
import {
  DatabaseErrorNotice,
  SupabaseSetupNotice,
} from "@/components/SupabaseSetupNotice";
import { getProjectFinancialData } from "@/lib/actions/finance";
import { getPrevisionnelData } from "@/lib/actions/previsionnel";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function FinancePrevisionnelPage({ params }: PageProps) {
  if (!isSupabaseConfigured()) {
    return <SupabaseSetupNotice />;
  }

  const { id } = await params;

  try {
    const [project, previsionnel] = await Promise.all([
      getProjectFinancialData(id),
      getPrevisionnelData(id),
    ]);

    return (
      <PrevisionnelPanel
        project={project}
        lots={project.enterprises ?? []}
        columns={previsionnel.columns}
        cells={previsionnel.cells}
        comments={previsionnel.comments}
      />
    );
  } catch (error) {
    return (
      <DatabaseErrorNotice
        message={
          error instanceof Error ? error.message : "Impossible de charger le prévisionnel."
        }
      />
    );
  }
}
