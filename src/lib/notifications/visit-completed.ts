import {
  VISIT_CONTROL_SUMMARY_LABELS,
} from "@/lib/types/database";
import type { VisitControlSummary } from "@/lib/types/database";

export type VisitDraftInput = {
  projectName: string;
  visitTitle: string;
  visitDate: string;
  phaseName: string | null;
  zoneName: string | null;
  controlLabel: string | null;
  controlSummary: VisitControlSummary;
  recipients: { email: string; name: string }[];
  markerCount: number;
  nonConformCount: number;
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function buildVisitEmailSubject(input: VisitDraftInput) {
  const dateLabel = formatDate(input.visitDate);
  const summaryLabel = VISIT_CONTROL_SUMMARY_LABELS[input.controlSummary];
  return `[${input.projectName}] Visite du ${dateLabel} — ${summaryLabel}`;
}

export function buildVisitEmailHtml(input: VisitDraftInput) {
  const dateLabel = formatDate(input.visitDate);
  const summaryLabel = VISIT_CONTROL_SUMMARY_LABELS[input.controlSummary];
  const recipientNames = input.recipients.map((r) => r.name).join(", ");

  return `
    <div style="font-family:Segoe UI,Arial,sans-serif;color:#1f2937;line-height:1.5;max-width:640px">
      <h2 style="color:#111827;margin-bottom:8px">Compte-rendu de visite de chantier</h2>
      <p>Bonjour${recipientNames ? ` ${recipientNames}` : ""},</p>
      <p>
        Une visite a été réalisée sur le chantier <strong>${input.projectName}</strong>
        le <strong>${dateLabel}</strong>.
      </p>
      <table style="border-collapse:collapse;margin:16px 0;width:100%">
        <tr><td style="padding:6px 0;color:#6b7280">Visite</td><td><strong>${input.visitTitle}</strong></td></tr>
        ${input.phaseName ? `<tr><td style="padding:6px 0;color:#6b7280">Phase</td><td>${input.phaseName}</td></tr>` : ""}
        ${input.zoneName ? `<tr><td style="padding:6px 0;color:#6b7280">Zone</td><td>${input.zoneName}</td></tr>` : ""}
        ${input.controlLabel ? `<tr><td style="padding:6px 0;color:#6b7280">Contrôle</td><td>${input.controlLabel}</td></tr>` : ""}
        <tr><td style="padding:6px 0;color:#6b7280">Synthèse</td><td><strong>${summaryLabel}</strong></td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Réserves</td><td>${input.markerCount}</td></tr>
        <tr><td style="padding:6px 0;color:#6b7280">Non-conformités</td><td>${input.nonConformCount}</td></tr>
      </table>
      ${
        input.nonConformCount > 0
          ? `<p style="background:#fef3c7;padding:12px;border-radius:8px">
              <strong>Action requise :</strong> des non-conformités ont été constatées.
              Merci de nous faire parvenir vos éléments de réponse avant la date convenue.
            </p>`
          : `<p style="background:#ecfdf5;padding:12px;border-radius:8px">
              Aucune non-conformité majeure signalée sur cette visite.
            </p>`
      }
      <p style="color:#6b7280;font-size:13px;margin-top:24px">
        Le rapport PDF est joint à ce message.
      </p>
    </div>
  `;
}
