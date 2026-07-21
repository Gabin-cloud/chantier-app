"use client";

import {
  formatPrintUpdateDate,
  printReportProjectLine,
  storagePublicUrl,
  type PrintReportBannerProps,
} from "@/lib/print/table-export";

export function PrintReportBanner({
  title,
  project,
  logoUrl,
  updatedAt = new Date(),
}: PrintReportBannerProps) {
  const projectLine = printReportProjectLine(project);
  const logo =
    logoUrl ?? storagePublicUrl(project.owner_logo_path) ?? "/icons/octobat-logo.svg";

  return (
    <header className="print-report-banner mb-4">
      <div className="flex items-start justify-between gap-4 border-b border-black pb-3">
        <div className="flex min-w-0 items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={logo}
            alt="Logo"
            className="h-14 max-w-[160px] shrink-0 object-contain object-left"
            crossOrigin="anonymous"
          />
        </div>
        <div className="flex-1 px-2 text-center">
          <p className="text-base font-bold uppercase tracking-wide text-black">
            {projectLine}
          </p>
        </div>
        <div className="shrink-0 text-right text-sm text-black">
          mise à jour le {formatPrintUpdateDate(updatedAt)}
        </div>
      </div>
      <div className="mt-0 border border-black bg-[#4472C4] py-2 text-center">
        <h1 className="text-sm font-bold uppercase tracking-wider text-white">{title}</h1>
      </div>
    </header>
  );
}
