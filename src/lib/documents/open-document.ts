/** Détecte si une URL pointe vers un document PDF. */
export function isPdfUrl(url: string): boolean {
  try {
    const pathname = new URL(url, "http://local").pathname.toLowerCase();
    return pathname.endsWith(".pdf");
  } catch {
    return url.toLowerCase().includes(".pdf");
  }
}

/** Ouvre un document PDF dans la visionneuse intégrée, sinon dans un nouvel onglet. */
export function openDocument(url: string, title?: string): void {
  if (isPdfUrl(url)) {
    const params = new URLSearchParams({ url });
    if (title) params.set("title", title);
    window.location.href = `/pc/document?${params.toString()}`;
    return;
  }
  window.open(url, "_blank", "noopener,noreferrer");
}
