import {
  computeAmendmentsTotals,
  computeContractTtc,
  computeSituation,
  formatCurrency,
  formatDateFr,
  formatPercent,
} from "@/lib/finance/calculations";
import type {
  FinancialSituation,
  FinancialSituationDelegation,
  LotWithFinancials,
} from "@/lib/types/database";

export const DEFAULT_SITUATION_COLUMNS = 4;

export type SubcontractorSummary = {
  name: string;
  delegationAmount: number;
};

export type SubcontractorSituationPayment = {
  name: string;
  periodTtc: number;
  cumulativeTtc: number;
};

export type SituationColumnData = {
  number: number;
  situation: FinancialSituation | null;
  periodTtc: number | null;
  cumulativeTtc: number | null;
  advancementPercent: number | null;
  prorataCumulativeHt: number | null;
  dateLabel: string | null;
  subcontractorPayments: SubcontractorSituationPayment[];
};

export type LotSituationsSynthesis = {
  lot: LotWithFinancials;
  contractBaseTtc: number;
  amendmentsTtc: number;
  totalMarketTtc: number;
  prorataPercent: number;
  prorataAmountTtc: number;
  subcontractors: SubcontractorSummary[];
  columns: SituationColumnData[];
};

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function getSituationDelegations(
  situation: FinancialSituation
): FinancialSituationDelegation[] {
  return [...(situation.delegations ?? [])].sort(
    (a, b) => a.sort_order - b.sort_order
  );
}

export function collectLotSubcontractors(
  situations: FinancialSituation[]
): SubcontractorSummary[] {
  const byName = new Map<string, number>();

  for (const situation of situations) {
    for (const delegation of getSituationDelegations(situation)) {
      if (delegation.delegation_type !== "subcontractor") continue;
      const amount = Number(delegation.delegation_amount);
      if (!byName.has(delegation.company_name)) {
        byName.set(delegation.company_name, amount);
      }
    }
  }

  return [...byName.entries()].map(([name, delegationAmount]) => ({
    name,
    delegationAmount,
  }));
}

export function computeSituationColumnCount(maxSituationNumber: number): number {
  return Math.max(DEFAULT_SITUATION_COLUMNS, maxSituationNumber);
}

export function buildLotSituationsSynthesis(
  lot: LotWithFinancials,
  columnCount: number
): LotSituationsSynthesis {
  const situations = [...(lot.situations ?? [])].sort(
    (a, b) => a.situation_number - b.situation_number
  );
  const contractHt = Number(lot.contract_amount_ht);
  const vatRate = Number(lot.vat_rate);
  const prorataPercent = Number(lot.prorata_percent);
  const amendments = lot.amendments ?? [];

  const contractBaseTtc = computeContractTtc(contractHt, vatRate);
  const { totalTtc: amendmentsTtc } = computeAmendmentsTotals(amendments);
  const totalMarketTtc = round2(contractBaseTtc + amendmentsTtc);
  const prorataAmountTtc = round2(totalMarketTtc * prorataPercent);
  const subcontractors = collectLotSubcontractors(situations);

  const columns: SituationColumnData[] = Array.from(
    { length: columnCount },
    (_, index) => {
      const number = index + 1;
      const situation =
        situations.find((item) => item.situation_number === number) ?? null;

      if (!situation) {
        return {
          number,
          situation: null,
          periodTtc: null,
          cumulativeTtc: null,
          advancementPercent: null,
          prorataCumulativeHt: null,
          dateLabel: null,
          subcontractorPayments: subcontractors.map((sub) => ({
            name: sub.name,
            periodTtc: 0,
            cumulativeTtc: 0,
          })),
        };
      }

      const previous =
        situations.find((item) => item.situation_number === number - 1) ??
        null;
      const computed = computeSituation({
        contractAmountHt: contractHt,
        vatRate,
        prorataPercent,
        amendments,
        situation,
        previousSituation: previous,
        hasBankGuarantee: Boolean(lot.has_bank_guarantee),
      });

      const delegations = getSituationDelegations(situation);
      const subcontractorPayments = subcontractors.map((sub) => {
        const delegation = delegations.find(
          (item) =>
            item.company_name === sub.name &&
            item.delegation_type === "subcontractor"
        );
        const cumulativeTtc = delegation ? Number(delegation.cumulative_ttc) : 0;
        const previousCumulative = delegation
          ? Number(delegation.previous_cumulative_ttc)
          : 0;

        return {
          name: sub.name,
          periodTtc: round2(cumulativeTtc - previousCumulative),
          cumulativeTtc,
        };
      });

      return {
        number,
        situation,
        periodTtc: computed.totalPeriodTtc,
        cumulativeTtc: computed.totalTtc,
        advancementPercent: computed.advancementPercent,
        prorataCumulativeHt: Number(situation.prorata_cumulative_ht),
        dateLabel: formatDateFr(situation.situation_date),
        subcontractorPayments,
      };
    }
  );

  return {
    lot,
    contractBaseTtc,
    amendmentsTtc,
    totalMarketTtc,
    prorataPercent,
    prorataAmountTtc,
    subcontractors,
    columns,
  };
}

export function buildSituationsSynthesis(lots: LotWithFinancials[]) {
  const maxSituationNumber = lots.reduce((max, lot) => {
    const lotMax = (lot.situations ?? []).reduce(
      (inner, situation) => Math.max(inner, situation.situation_number),
      0
    );
    return Math.max(max, lotMax);
  }, 0);

  const columnCount = computeSituationColumnCount(maxSituationNumber);

  return {
    columnCount,
    blocks: lots.map((lot) => buildLotSituationsSynthesis(lot, columnCount)),
  };
}
