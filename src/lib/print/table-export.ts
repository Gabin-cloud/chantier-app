import type { Project } from "@/lib/types/database";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

export function storagePublicUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  return `${SUPABASE_URL}/storage/v1/object/public/financial-files/${path}`;
}

export type PrintReportBannerProps = {
  title: string;
  project: Pick<Project, "name" | "client_name" | "owner_name" | "owner_logo_path">;
  logoUrl?: string | null;
  updatedAt?: Date;
};

export function formatPrintUpdateDate(date: Date = new Date()): string {
  const d = date.getDate().toString().padStart(2, "0");
  const m = (date.getMonth() + 1).toString().padStart(2, "0");
  const y = String(date.getFullYear()).slice(-2);
  return `${d}/${m}/${y}`;
}

export function printReportProjectLine(project: PrintReportBannerProps["project"]): string {
  const client = project.client_name ?? project.owner_name ?? "";
  if (client && project.name) {
    return `${client} - ${project.name}`;
  }
  return project.name ?? client ?? "";
}

export function printStyles(): string {
  return `
    @media print {
      body * { visibility: hidden; }
      .print-root, .print-root * { visibility: visible; }
      .print-root {
        position: absolute;
        left: 0;
        top: 0;
        width: 100%;
        padding: 12mm;
        background: white;
      }
      .no-print { display: none !important; }
      .print-report-banner img { max-height: 56px; }
      table { page-break-inside: auto; }
      tr { page-break-inside: avoid; page-break-after: auto; }
    }
  `;
}

export function triggerBrowserPrint(printRootId: string) {
  const existing = document.getElementById("dynamic-print-styles");
  if (!existing) {
    const style = document.createElement("style");
    style.id = "dynamic-print-styles";
    style.textContent = printStyles();
    document.head.appendChild(style);
  }

  const root = document.getElementById(printRootId);
  if (!root) {
    window.print();
    return;
  }

  root.classList.add("print-root");
  window.print();
  root.classList.remove("print-root");
}

export type ExcelColumn = { header: string; value: string | number };

export function downloadExcelCsv(
  filename: string,
  columns: ExcelColumn[],
  rows: ExcelColumn[][]
) {
  const escape = (v: string | number) => {
    const s = String(v ?? "");
    if (s.includes(";") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const headerLine = columns.map((c) => escape(c.header)).join(";");
  const bodyLines = rows.map((row) => row.map((cell) => escape(cell.value)).join(";"));
  const csv = "\uFEFF" + [headerLine, ...bodyLines].join("\r\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
