import { OperationDashboardTable } from "@/components/pc/dashboard/OperationDashboardTable";
import { DatabaseErrorNotice } from "@/components/SupabaseSetupNotice";
import { getOperationLots } from "@/lib/actions/dashboard";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function TableauDeBordPage({ params }: PageProps) {
  const { id } = await params;

  try {
    const lots = await getOperationLots(id);
    return <OperationDashboardTable lots={lots} />;
  } catch (error) {
    return (
      <DatabaseErrorNotice
        message={
          error instanceof Error
            ? error.message
            : "Impossible de charger le tableau de bord."
        }
      />
    );
  }
}
