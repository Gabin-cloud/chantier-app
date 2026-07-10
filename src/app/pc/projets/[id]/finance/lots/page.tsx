import { BankGuaranteesManager } from "@/components/finance/BankGuaranteesManager";
import { FinanceLayout } from "@/components/finance/FinanceLayout";
import { FinancialProjectInfo } from "@/components/finance/FinancialProjectInfo";
import { LotsManager } from "@/components/finance/LotsManager";
import {
  DatabaseErrorNotice,
  SupabaseSetupNotice,
} from "@/components/SupabaseSetupNotice";
import {
  getFinancialFileUrl,
  getProjectFinancialData,
} from "@/lib/actions/finance";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function FinanceLotsPage({ params }: PageProps) {
  if (!isSupabaseConfigured()) {
    return <SupabaseSetupNotice />;
  }

  const { id } = await params;

  try {
    const project = await getProjectFinancialData(id);
    const photoUrl = project.operation_photo_path
      ? await getFinancialFileUrl(id, project.operation_photo_path)
      : null;

    return (
      <FinanceLayout title="Lots & marchés" subtitle={project.name}>
        <div className="space-y-6">
          <FinancialProjectInfo project={project} photoUrl={photoUrl} />
          <BankGuaranteesManager
            projectId={id}
            guarantees={project.bank_guarantees ?? []}
          />
          <LotsManager project={project} lots={project.enterprises ?? []} />
        </div>
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
