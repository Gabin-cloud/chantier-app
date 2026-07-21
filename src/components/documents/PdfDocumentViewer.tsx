"use client";

import { useCallback, useRef } from "react";
import Link from "next/link";

type PdfDocumentViewerProps = {
  url: string;
  title?: string;
  backHref?: string;
};

function DownloadIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3v12m0 0l4-4m-4 4l-4-4M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
    </svg>
  );
}

function PrintIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2M6 14h12v7H6z" />
    </svg>
  );
}

export function PdfDocumentViewer({ url, title, backHref }: PdfDocumentViewerProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const handlePrint = useCallback(() => {
    const frame = iframeRef.current;
    if (frame?.contentWindow) {
      frame.contentWindow.focus();
      frame.contentWindow.print();
    } else {
      window.print();
    }
  }, []);

  const handleDownload = useCallback(() => {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = title ?? "document.pdf";
    anchor.target = "_blank";
    anchor.rel = "noopener noreferrer";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
  }, [url, title]);

  return (
    <div className="flex min-h-screen flex-col bg-slate-900">
      <header className="flex shrink-0 items-center justify-between gap-4 border-b border-slate-700 bg-slate-800 px-4 py-2">
        <div className="flex min-w-0 items-center gap-3">
          {backHref && (
            <Link
              href={backHref}
              className="rounded-md px-2 py-1 text-sm text-slate-300 hover:bg-slate-700 hover:text-white"
            >
              ← Retour
            </Link>
          )}
          <p className="truncate text-sm font-medium text-white">
            {title ?? "Document PDF"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={handleDownload}
            title="Télécharger"
            aria-label="Télécharger"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-200 hover:bg-slate-700 hover:text-white"
          >
            <DownloadIcon />
          </button>
          <button
            type="button"
            onClick={handlePrint}
            title="Imprimer"
            aria-label="Imprimer"
            className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-200 hover:bg-slate-700 hover:text-white"
          >
            <PrintIcon />
          </button>
        </div>
      </header>
      <div className="flex-1">
        <iframe
          ref={iframeRef}
          src={url}
          title={title ?? "Document PDF"}
          className="h-[calc(100vh-3rem)] w-full border-0 bg-white"
        />
      </div>
    </div>
  );
}
