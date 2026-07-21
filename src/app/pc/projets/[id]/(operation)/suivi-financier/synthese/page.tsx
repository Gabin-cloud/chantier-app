import { FinancialSynthesisShell } from "@/components/finance/FinancialSynthesisShell";
import {
  DatabaseErrorNotice,
  SupabaseSetupNotice,
} from "@/components/SupabaseSetupNotice";
import { getM365DraftReadiness } from "@/lib/actions/control-board";
import { getProjectFinancialData } from "@/lib/actions/finance";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function FinanceSynthesePage({ params }: PageProps) {
  if (!isSupabaseConfigured()) {
    return <SupabaseSetupNotice />;
  }

  const { id } = await params;

  try {
    const [project, m365] = await Promise.all([
      getProjectFinancialData(id),
      getM365DraftReadiness(),
    ]);

    return (
      <FinancialSynthesisShell
        project={project}
        lots={project.enterprises ?? []}
        m365Ready={m365.ready}
      />
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
