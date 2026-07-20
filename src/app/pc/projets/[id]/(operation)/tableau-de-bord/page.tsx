import { OperationDashboardTable } from "@/components/pc/dashboard/OperationDashboardTable";
import { DatabaseErrorNotice } from "@/components/SupabaseSetupNotice";
import { getEnterpriseAdminStatuses } from "@/lib/actions/admin-pieces";
import { getOperationLots } from "@/lib/actions/dashboard";
import { getWorkControlSynthesis } from "@/lib/actions/work-control";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function TableauDeBordPage({ params }: PageProps) {
  const { id } = await params;

  try {
    const lots = await getOperationLots(id);
    const [adminStatuses, workControl] = await Promise.all([
      getEnterpriseAdminStatuses(
        id,
        lots.map((l) => l.id)
      ),
      getWorkControlSynthesis(id).catch(() => null),
    ]);

    const workControlByEnterprise: Record<
      string,
      { conformCount: number; nonConformCount: number; nonConformRatio: number | null }
    > = {};

    if (workControl) {
      for (const row of workControl.rows) {
        const { conformCount, nonConformCount, totalControls } = row.total;
        workControlByEnterprise[row.enterprise.id] = {
          conformCount,
          nonConformCount,
          nonConformRatio:
            totalControls > 0
              ? Math.round((nonConformCount / totalControls) * 100)
              : null,
        };
      }
    }

    return (
      <OperationDashboardTable
        lots={lots}
        adminStatuses={adminStatuses}
        workControlByEnterprise={workControlByEnterprise}
      />
    );
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
