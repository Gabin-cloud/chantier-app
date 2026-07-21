import { computeContractTtc, computeVat, formatCurrency } from "@/lib/finance/calculations";
import type {
  Enterprise,
  FinancialAmendmentLine,
  LotWithFinancials,
  Project,
} from "@/lib/types/database";

export type AmendmentLineInput = {
  designation: string;
  amount_ht: number;
  quote_id?: string | null;
};

export function buildAmendmentDocumentHtml({
  project,
  lot,
  amendmentNumber,
  amendmentType,
  lines,
  danobatComment,
}: {
  project: Project;
  lot: LotWithFinancials;
  amendmentNumber: number;
  amendmentType: "ts" | "tma";
  lines: AmendmentLineInput[];
  danobatComment?: string | null;
}): string {
  const contractHt = Number(lot.contract_amount_ht);
  const amendmentTotalHt = lines.reduce((sum, line) => sum + line.amount_ht, 0);
  const newMarketHt = contractHt + amendmentTotalHt;
  const vatRate = Number(lot.vat_rate);
  const vatAmount = computeVat(amendmentTotalHt, vatRate);
  const amendmentTtc = computeContractTtc(amendmentTotalHt, vatRate);

  const projectAddress = [project.address, project.postal_code, project.city]
    .filter(Boolean)
    .join(" — ");

  const ownerBlock = [
    project.client_name ?? project.owner_name ?? "Maître d'ouvrage",
    project.client_address ?? project.owner_address ?? "",
    [project.owner_postal_code, project.owner_city].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join("<br/>");

  const enterpriseBlock = [
    lot.name,
    lot.enterprise_address ?? "",
    [lot.enterprise_postal_code, lot.enterprise_city].filter(Boolean).join(" "),
  ]
    .filter(Boolean)
    .join("<br/>");

  const lineRows = lines
    .map(
      (line) => `
      <tr>
        <td style="padding:8px;border:1px solid #000;">${escapeHtml(line.designation)}</td>
        <td style="padding:8px;border:1px solid #000;text-align:right;white-space:nowrap;">${formatCurrency(line.amount_ht)}</td>
      </tr>`
    )
    .join("");

  const today = new Date().toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });

  const city = project.city ?? project.moe_city ?? "Toulouse";

  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="utf-8"/>
  <title>Avenant n°${amendmentNumber} - ${amendmentType.toUpperCase()}</title>
  <style>
    body { font-family: Arial, sans-serif; font-size: 12px; color: #000; margin: 24px; }
    h1 { text-align: center; font-size: 18px; margin: 16px 0; }
    .box { border: 1px solid #000; padding: 12px; margin: 12px 0; }
    table { width: 100%; border-collapse: collapse; }
    .summary td { padding: 6px 8px; border: 1px solid #000; }
    .summary .label { width: 70%; }
    .summary .value { text-align: right; font-weight: bold; }
    .footer { margin-top: 24px; font-size: 11px; line-height: 1.5; }
  </style>
</head>
<body>
  <p><strong>${escapeHtml(project.name)}</strong></p>
  <p>${escapeHtml(project.description ?? projectAddress)}</p>
  <h1>AVENANT N°${String(amendmentNumber).padStart(2, "0")} - ${amendmentType.toUpperCase()}</h1>
  <p><strong>LOT : ${escapeHtml(lot.lot_number ?? "")} - ${escapeHtml(lot.designation ?? "")}</strong></p>

  <div class="box">
    <p><strong>Maître d'ouvrage :</strong><br/>${ownerBlock}</p>
    <p style="margin-top:12px;"><strong>Entreprise :</strong><br/>${enterpriseBlock}</p>
  </div>

  <table class="summary" style="margin:16px 0;">
    <tr>
      <td class="label">Montant marché de base H.T.</td>
      <td class="value">${formatCurrency(contractHt)}</td>
    </tr>
    <tr>
      <td class="label">Montant avenant n°${String(amendmentNumber).padStart(2, "0")} H.T.</td>
      <td class="value">${formatCurrency(amendmentTotalHt)}</td>
    </tr>
    <tr>
      <td class="label">Nouveau montant du marché H.T.</td>
      <td class="value">${formatCurrency(newMarketHt)}</td>
    </tr>
  </table>

  <p><strong>Détail du présent avenant :</strong></p>
  <table>
    ${lineRows}
    <tr>
      <td style="padding:8px;border:1px solid #000;font-weight:bold;">Total avenant n°${String(amendmentNumber).padStart(2, "0")} H.T.</td>
      <td style="padding:8px;border:1px solid #000;text-align:right;font-weight:bold;">${formatCurrency(amendmentTotalHt)}</td>
    </tr>
    <tr>
      <td style="padding:8px;border:1px solid #000;">TVA ${vatRate} %</td>
      <td style="padding:8px;border:1px solid #000;text-align:right;">${formatCurrency(vatAmount)}</td>
    </tr>
    <tr>
      <td style="padding:8px;border:1px solid #000;font-weight:bold;">Total TTC</td>
      <td style="padding:8px;border:1px solid #000;text-align:right;font-weight:bold;">${formatCurrency(amendmentTtc)}</td>
    </tr>
  </table>

  ${
    danobatComment?.trim()
      ? `<p style="margin-top:16px;"><strong>Commentaire suivie DANOBAT :</strong> ${escapeHtml(danobatComment.trim())}</p>`
      : ""
  }

  <p class="footer">
    Les conditions générales et particulières du marché initial restent applicables
    sauf dispositions contraires du présent avenant.
  </p>
  <p><strong>${escapeHtml(city)}, le ${today}</strong></p>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function buildAmendmentEmailDraft({
  project,
  lot,
  amendmentNumber,
  amendmentType,
  totalHt,
}: {
  project: Pick<Project, "name">;
  lot: Pick<LotWithFinancials, "name" | "lot_number" | "designation">;
  amendmentNumber: number;
  amendmentType: "ts" | "tma";
  totalHt: number;
}): { subject: string; body: string } {
  const subject = `${project.name} — Avenant n°${String(amendmentNumber).padStart(2, "0")} ${amendmentType.toUpperCase()} — Lot ${lot.lot_number ?? ""}`;
  const body = `Bonjour,

Veuillez trouver ci-joint l'avenant n°${String(amendmentNumber).padStart(2, "0")} (${amendmentType.toUpperCase()}) relatif au lot ${lot.lot_number ?? ""} — ${lot.designation ?? ""} pour un montant de ${formatCurrency(totalHt)} H.T.

Les devis cités dans l'avenant sont joints à ce mail.

Merci de nous retourner l'avenant signé pour validation.

Cordialement,
DANOBAT`;

  return { subject, body };
}

export function linesFromAmendment(
  lines: FinancialAmendmentLine[]
): AmendmentLineInput[] {
  return lines.map((line) => ({
    designation: line.designation,
    amount_ht: Number(line.amount_ht),
    quote_id: line.quote_id,
  }));
}
