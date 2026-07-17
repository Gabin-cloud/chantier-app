"use server";

import { requireProjectAccess } from "@/lib/auth/permissions";
import { normalizeAmendment } from "@/lib/finance/amendment-workflow";
import { createClient } from "@/lib/supabase/server";
import type {
  Enterprise,
  FinancialAmendment,
  FinancialSituation,
  LotWithFinancials,
} from "@/lib/types/database";

type EnterpriseWithNested = Enterprise & {
  financial_amendments: FinancialAmendment[] | null;
  financial_situations: FinancialSituation[] | null;
};

/**
 * Lots + données financières pour le tableau de bord général de l'opération.
 * N'exige qu'un accès projet (lecture) — contrairement aux actions finance
 * réservées aux rôles admin/gestionnaire/financier.
 */
export async function getOperationLots(
  projectId: string
): Promise<LotWithFinancials[]> {
  await requireProjectAccess(projectId);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("enterprises")
    .select("*, financial_amendments(*), financial_situations(*)")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(error.message);

  const rows = (data ?? []) as unknown as EnterpriseWithNested[];

  return rows.map((row) => {
    const { financial_amendments, financial_situations, ...enterprise } = row;
    return {
      ...enterprise,
      amendments: [...(financial_amendments ?? [])]
        .map(normalizeAmendment)
        .sort((a, b) => a.amendment_number - b.amendment_number),
      situations: [...(financial_situations ?? [])].sort(
        (a, b) => a.situation_number - b.situation_number
      ),
    };
  });
}
