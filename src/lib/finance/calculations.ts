import type {
  ComputedSituation,
  FinancialAmendment,
  FinancialSituation,
  SituationLine,
} from "@/lib/types/database";

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function periodAmount(cumulative: number, previous: number): number {
  return round2(cumulative - previous);
}

function buildLine(
  label: string,
  cumulative: number,
  previous: number
): SituationLine {
  return {
    label,
    cumulative: round2(cumulative),
    previous: round2(previous),
    period: periodAmount(cumulative, previous),
  };
}

export function computeAmendmentsTotals(amendments: FinancialAmendment[]) {
  const totalHt = amendments.reduce((sum, a) => sum + Number(a.amount_ht), 0);
  const totalTtc = amendments.reduce((sum, a) => sum + Number(a.amount_ttc), 0);
  return { totalHt: round2(totalHt), totalTtc: round2(totalTtc) };
}

export function computeAmendmentsSplit(amendments: FinancialAmendment[]) {
  let tsHt = 0;
  let tmaHt = 0;

  for (const amendment of amendments) {
    const amount = Number(amendment.amount_ht);
    if (amendment.amendment_type === "tma") {
      tmaHt += amount;
    } else {
      tsHt += amount;
    }
  }

  const totalHt = tsHt + tmaHt;
  return { tsHt: round2(tsHt), tmaHt: round2(tmaHt), totalHt: round2(totalHt) };
}

export function computeAmendmentTtc(amountHt: number, vatRate: number): number {
  return round2(amountHt * (1 + vatRate / 100));
}

export function computeContractTtc(amountHt: number, vatRate: number): number {
  return round2(amountHt * (1 + vatRate / 100));
}

export function computeVat(amountHt: number, vatRate: number): number {
  return round2(amountHt * (vatRate / 100));
}

export function computeBankGuarantee(
  totalMarketHt: number,
  prorataPercent: number,
  vatRate: number
) {
  const ht = round2(totalMarketHt * prorataPercent * 0.05);
  const ttc = round2(ht * (1 + vatRate / 100));
  return { ht, ttc };
}

export function computeAutoProrataCumulative(
  worksCumulativeHt: number,
  prorataPercent: number
): number {
  if (prorataPercent <= 0) return 0;
  return round2(worksCumulativeHt * prorataPercent);
}

export function computeAutoRetentionGuarantee(
  worksCumulativeHt: number,
  amendmentWorksCumulativeHt: number,
  hasBankGuarantee: boolean
): number {
  if (hasBankGuarantee) return 0;
  return round2((worksCumulativeHt + amendmentWorksCumulativeHt) * 0.05);
}

export function getDefaultSituationDate(referenceDate = new Date()): string {
  const year = referenceDate.getFullYear();
  const month = referenceDate.getMonth();
  const lastDay = new Date(year, month + 1, 0);
  return lastDay.toISOString().slice(0, 10);
}

export function getEndOfMonthLabel(dateStr: string): string {
  const date = new Date(dateStr);
  return new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
  }).format(date);
}

export function parseMoneyInput(value: string): number {
  let cleaned = value.replace(/\s/g, "").replace(/€/g, "").trim();
  if (!cleaned) return 0;

  const lastComma = cleaned.lastIndexOf(",");
  const lastDot = cleaned.lastIndexOf(".");

  if (lastComma >= 0 && lastComma > lastDot) {
    cleaned = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (lastDot >= 0 && lastComma >= 0) {
    cleaned = cleaned.replace(/,/g, "");
  } else if (lastComma >= 0) {
    cleaned = cleaned.replace(",", ".");
  }

  const parsed = Number.parseFloat(cleaned);
  return Number.isFinite(parsed) ? round2(parsed) : 0;
}

export function formatMoneyDisplay(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

type ComputeSituationInput = {
  contractAmountHt: number;
  vatRate: number;
  prorataPercent: number;
  amendments: FinancialAmendment[];
  situation: FinancialSituation;
  previousSituation: FinancialSituation | null;
  autoProrata?: boolean;
  hasBankGuarantee?: boolean;
  autoRetention?: boolean;
};

export function computeSituation({
  contractAmountHt,
  vatRate,
  prorataPercent,
  amendments,
  situation,
  previousSituation,
  autoProrata = true,
  hasBankGuarantee = false,
  autoRetention = true,
}: ComputeSituationInput): ComputedSituation {
  const { totalHt: amendmentsTotalHt, totalTtc: amendmentsTotalTtc } =
    computeAmendmentsTotals(amendments);

  const contractAmountTtc = computeContractTtc(contractAmountHt, vatRate);
  const totalMarketHt = round2(contractAmountHt + amendmentsTotalHt);
  const totalMarketTtc = round2(contractAmountTtc + amendmentsTotalTtc);

  const prev = previousSituation ?? {
    works_cumulative_ht: 0,
    amendment_works_cumulative_ht: 0,
    prorata_cumulative_ht: 0,
    retention_guarantee_cumulative_ht: 0,
    retention_finition_cumulative_ht: 0,
    retention_diverse_cumulative_ht: 0,
    penalties_cumulative_ht: 0,
    cie_cumulative_ht: 0,
  };

  const worksCumulative = Number(situation.works_cumulative_ht);
  const amendmentWorksCumulative = Number(situation.amendment_works_cumulative_ht);

  const prorataCumulative = autoProrata
    ? computeAutoProrataCumulative(worksCumulative, prorataPercent)
    : Number(situation.prorata_cumulative_ht);

  const retentionGuaranteeCumulative = autoRetention
    ? computeAutoRetentionGuarantee(
        worksCumulative,
        amendmentWorksCumulative,
        hasBankGuarantee
      )
    : Number(situation.retention_guarantee_cumulative_ht);
  const retentionFinitionCumulative = Number(
    situation.retention_finition_cumulative_ht
  );
  const retentionDiverseCumulative = Number(
    situation.retention_diverse_cumulative_ht
  );
  const penaltiesCumulative = Number(situation.penalties_cumulative_ht);
  const cieCumulative = Number(situation.cie_cumulative_ht);

  const advancementPercent =
    totalMarketHt > 0 ? round2(worksCumulative / totalMarketHt) : 0;

  const lines: SituationLine[] = [
    buildLine("Avancement de la situation", advancementPercent, 0),
    buildLine(
      "Travaux marché",
      worksCumulative,
      Number(prev.works_cumulative_ht)
    ),
    buildLine(
      "Travaux sur avenants",
      amendmentWorksCumulative,
      Number(prev.amendment_works_cumulative_ht)
    ),
    buildLine(
      "Compte prorata",
      prorataCumulative,
      autoProrata
        ? computeAutoProrataCumulative(
            Number(prev.works_cumulative_ht),
            prorataPercent
          )
        : Number(prev.prorata_cumulative_ht)
    ),
    buildLine(
      "Retenue de garantie 5 %",
      retentionGuaranteeCumulative,
      autoRetention
        ? computeAutoRetentionGuarantee(
            Number(prev.works_cumulative_ht),
            Number(prev.amendment_works_cumulative_ht),
            hasBankGuarantee
          )
        : Number(prev.retention_guarantee_cumulative_ht)
    ),
  ];

  const subtotalCumulative = round2(
    worksCumulative +
      amendmentWorksCumulative -
      prorataCumulative -
      retentionGuaranteeCumulative
  );
  const subtotalPrevious = round2(
    Number(prev.works_cumulative_ht) +
      Number(prev.amendment_works_cumulative_ht) -
      (autoProrata
        ? computeAutoProrataCumulative(
            Number(prev.works_cumulative_ht),
            prorataPercent
          )
        : Number(prev.prorata_cumulative_ht)) -
      (autoRetention
        ? computeAutoRetentionGuarantee(
            Number(prev.works_cumulative_ht),
            Number(prev.amendment_works_cumulative_ht),
            hasBankGuarantee
          )
        : Number(prev.retention_guarantee_cumulative_ht))
  );

  lines.push(
    buildLine("Sous-total H.T.", subtotalCumulative, subtotalPrevious),
    buildLine(
      "Retenue pour finition",
      retentionFinitionCumulative,
      Number(prev.retention_finition_cumulative_ht)
    ),
    buildLine(
      "Retenues diverses",
      retentionDiverseCumulative,
      Number(prev.retention_diverse_cumulative_ht)
    ),
    buildLine(
      "Pénalités de retard",
      penaltiesCumulative,
      Number(prev.penalties_cumulative_ht)
    ),
    buildLine(
      "Compte inter-entreprises",
      cieCumulative,
      Number(prev.cie_cumulative_ht)
    )
  );

  const totalHt = round2(
    subtotalCumulative -
      retentionFinitionCumulative -
      retentionDiverseCumulative -
      penaltiesCumulative -
      cieCumulative
  );
  const totalPreviousHt = round2(
    subtotalPrevious -
      Number(prev.retention_finition_cumulative_ht) -
      Number(prev.retention_diverse_cumulative_ht) -
      Number(prev.penalties_cumulative_ht) -
      Number(prev.cie_cumulative_ht)
  );

  const vatAmount = computeVat(totalHt, vatRate);
  const vatPreviousAmount = computeVat(totalPreviousHt, vatRate);
  const totalTtc = round2(totalHt + vatAmount);
  const totalPreviousTtc = round2(totalPreviousHt + vatPreviousAmount);

  const bankGuarantee = computeBankGuarantee(
    totalMarketHt,
    prorataPercent,
    vatRate
  );

  return {
    advancementPercent,
    contractAmountHt: round2(contractAmountHt),
    contractAmountTtc,
    amendmentsTotalHt,
    amendmentsTotalTtc,
    totalMarketHt,
    totalMarketTtc,
    lines,
    subtotalHt: subtotalCumulative,
    subtotalPreviousHt: subtotalPrevious,
    subtotalPeriodHt: periodAmount(subtotalCumulative, subtotalPrevious),
    totalHt,
    totalPreviousHt,
    totalPeriodHt: periodAmount(totalHt, totalPreviousHt),
    vatAmount,
    vatPreviousAmount,
    vatPeriodAmount: periodAmount(vatAmount, vatPreviousAmount),
    totalTtc,
    totalPreviousTtc,
    totalPeriodTtc: periodAmount(totalTtc, totalPreviousTtc),
    bankGuaranteeHt: bankGuarantee.ht,
    bankGuaranteeTtc: bankGuarantee.ttc,
  };
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatPercent(value: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "percent",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatDateFr(date: string): string {
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(date));
}
