"use client";

import type { ReactNode } from "react";
import { openDocument, isPdfUrl } from "@/lib/documents/open-document";

type DocumentLinkProps = {
  url: string;
  title?: string;
  className?: string;
  children: ReactNode;
};

/** Lien hypertexte : ouvre les PDF dans la visionneuse intégrée. */
export function DocumentLink({ url, title, className, children }: DocumentLinkProps) {
  if (isPdfUrl(url)) {
    return (
      <button
        type="button"
        onClick={() => openDocument(url, title)}
        className={className ?? "font-medium text-blue-600 hover:underline"}
      >
        {children}
      </button>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className={className ?? "font-medium text-blue-600 hover:underline"}
    >
      {children}
    </a>
  );
}

/** Bouton ou handler pour ouvrir un document (PDF → visionneuse). */
export function useOpenDocument() {
  return { openDocument, isPdfUrl };
}
