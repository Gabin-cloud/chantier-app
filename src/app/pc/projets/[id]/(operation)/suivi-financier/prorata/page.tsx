import { ProrataPanel } from "@/components/finance/ProrataPanel";
import {
  DatabaseErrorNotice,
  SupabaseSetupNotice,
} from "@/components/SupabaseSetupNotice";
import { getProjectFinancialData } from "@/lib/actions/finance";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function FinanceProrataPage({ params }: PageProps) {
  if (!isSupabaseConfigured()) {
    return <SupabaseSetupNotice />;
  }

  const { id } = await params;

  try {
    const project = await getProjectFinancialData(id);
    return (
      <ProrataPanel project={project} lots={project.enterprises ?? []} />
    );
  } catch (error) {
    return (
      <DatabaseErrorNotice
        message={
          error instanceof Error ? error.message : "Impossible de charger le suivi prorata."
        }
      />
    );
  }
}
