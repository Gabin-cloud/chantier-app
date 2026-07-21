import { PdfDocumentViewer } from "@/components/documents/PdfDocumentViewer";
import Link from "next/link";

type PageProps = {
  searchParams: Promise<{ url?: string; title?: string }>;
};

export default async function DocumentViewerPage({ searchParams }: PageProps) {
  const { url, title } = await searchParams;

  if (!url) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-slate-50 p-8">
        <p className="text-slate-600">Aucun document à afficher.</p>
        <Link href="/pc" className="text-sm text-blue-600 hover:underline">
          Retour à l&apos;accueil
        </Link>
      </div>
    );
  }

  return <PdfDocumentViewer url={url} title={title} backHref="/pc" />;
}
