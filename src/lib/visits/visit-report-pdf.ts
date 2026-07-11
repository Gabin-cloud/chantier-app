import { jsPDF } from "jspdf";
import type {
  ControlResult,
  Enterprise,
  MarkerWithLinks,
  PhaseChecklistItem,
  PhaseZone,
  Project,
  Visit,
  VisitControlSummary,
} from "@/lib/types/database";
import {
  CONTROL_RESULT_LABELS,
  MARKER_STATUS_LABELS,
  VISIT_CONTROL_SUMMARY_LABELS,
} from "@/lib/types/database";

type ReportInput = {
  project: Pick<Project, "name" | "address" | "city">;
  visit: Visit;
  phaseName: string | null;
  zoneName: string | null;
  controlLabel: string | null;
  checklistItems: PhaseChecklistItem[];
  zones: PhaseZone[];
  markers: MarkerWithLinks[];
  enterprises: Enterprise[];
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function zoneLabel(
  item: PhaseChecklistItem,
  zones: PhaseZone[]
): string {
  if (item.zone_id) {
    return zones.find((z) => z.id === item.zone_id)?.name ?? item.zone_name ?? "Général";
  }
  return item.zone_name ?? "Général";
}

export function buildVisitReportPdf(input: ReportInput): Uint8Array {
  const pdf = new jsPDF("p", "mm", "a4");
  const margin = 14;
  const pageWidth = pdf.internal.pageSize.getWidth();
  const maxWidth = pageWidth - margin * 2;
  let y = margin;

  function line(text: string, size = 10, bold = false) {
    pdf.setFontSize(size);
    pdf.setFont("helvetica", bold ? "bold" : "normal");
    const lines = pdf.splitTextToSize(text, maxWidth) as string[];
    for (const l of lines) {
      if (y > 280) {
        pdf.addPage();
        y = margin;
      }
      pdf.text(l, margin, y);
      y += size * 0.45 + 2;
    }
  }

  function gap(mm = 4) {
    y += mm;
  }

  const enterpriseMap = new Map(input.enterprises.map((e) => [e.id, e.name]));
  const itemMap = new Map(input.checklistItems.map((i) => [i.id, i]));
  const summary: VisitControlSummary = input.visit.control_summary ?? "pending";

  line("RAPPORT DE VISITE DE CHANTIER", 16, true);
  gap(2);
  line(`Projet : ${input.project.name}`, 11, true);
  if (input.project.address || input.project.city) {
    line(
      [input.project.address, input.project.city].filter(Boolean).join(", "),
      9
    );
  }
  gap(4);
  line(`Visite : ${input.visit.title ?? "Sans titre"}`, 11, true);
  line(`Date : ${formatDate(input.visit.visit_date)}`, 10);
  if (input.phaseName) line(`Phase : ${input.phaseName}`, 10);
  if (input.zoneName) line(`Zone de chantier : ${input.zoneName}`, 10);
  if (input.controlLabel) line(`Contrôle ciblé : ${input.controlLabel}`, 10);
  line(`Synthèse : ${VISIT_CONTROL_SUMMARY_LABELS[summary]}`, 10, true);
  if (input.visit.notes) {
    gap(2);
    line(`Notes : ${input.visit.notes}`, 9);
  }

  gap(6);
  line("POINTS DE CONTRÔLE", 12, true);
  gap(2);

  const controlMarkers = input.markers.filter((m) => m.checklist_item_id);
  if (controlMarkers.length === 0) {
    line("Aucun point de contrôle renseigné sur cette visite.", 9);
  } else {
    for (const marker of controlMarkers) {
      const item = itemMap.get(marker.checklist_item_id!);
      const result = marker.control_result as ControlResult | null;
      const resultLabel = result ? CONTROL_RESULT_LABELS[result] : "Non renseigné";
      const zone = item ? zoneLabel(item, input.zones) : "—";
      line(
        `• ${item?.label ?? "Contrôle"} — ${zone} — ${resultLabel}`,
        9,
        true
      );
      if (marker.remark) line(`  Observation : ${marker.remark}`, 8);
      if (marker.enterprise_id) {
        line(`  Entreprise : ${enterpriseMap.get(marker.enterprise_id) ?? "—"}`, 8);
      }
      gap(2);
    }
  }

  gap(4);
  line("RÉSERVES / PASTILLES", 12, true);
  gap(2);

  const reserveMarkers = input.markers.filter((m) => !m.checklist_item_id || m.remark);
  const allReserves = input.markers.length ? input.markers : [];

  if (allReserves.length === 0) {
    line("Aucune réserve sur cette visite.", 9);
  } else {
    for (const marker of allReserves) {
      line(
        `#${marker.marker_number} — ${MARKER_STATUS_LABELS[marker.status]}`,
        9,
        true
      );
      if (marker.remark) line(`  ${marker.remark}`, 8);
      if (marker.enterprise_id) {
        line(`  Entreprise : ${enterpriseMap.get(marker.enterprise_id) ?? "—"}`, 8);
      }
      if (marker.location_label) line(`  Localisation : ${marker.location_label}`, 8);
      const item = marker.checklist_item_id
        ? itemMap.get(marker.checklist_item_id)
        : null;
      if (item) {
        const result = marker.control_result
          ? CONTROL_RESULT_LABELS[marker.control_result]
          : "—";
        line(`  Contrôle : ${item.label} — ${result}`, 8);
      }
      gap(2);
    }
  }

  gap(6);
  line(
    `Document généré le ${new Date().toLocaleDateString("fr-FR")} — Chantier App`,
    8
  );

  return new Uint8Array(pdf.output("arraybuffer"));
}
