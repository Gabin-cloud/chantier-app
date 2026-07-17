import { OperationDashboardTable } from "@/components/pc/dashboard/OperationDashboardTable";
import { DatabaseErrorNotice } from "@/components/SupabaseSetupNotice";
import { getEnterpriseAdminStatuses } from "@/lib/actions/admin-pieces";
import { getOperationLots } from "@/lib/actions/dashboard";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function TableauDeBordPage({ params }: PageProps) {
  const { id } = await params;

  try {
    const lots = await getOperationLots(id);
    const adminStatuses = await getEnterpriseAdminStatuses(
      id,
      lots.map((l) => l.id)
    );
    return <OperationDashboardTable lots={lots} adminStatuses={adminStatuses} />;
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
