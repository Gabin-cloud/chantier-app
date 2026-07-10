import Link from "next/link";
import { CreateVisitForm } from "@/components/visits/CreateVisitForm";
import { SupabaseSetupNotice } from "@/components/SupabaseSetupNotice";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function NouvelleVisitePage({ params }: PageProps) {
  if (!isSupabaseConfigured()) {
    return <SupabaseSetupNotice />;
  }

  const { id } = await params;

  return (
    <main className="min-h-full bg-zinc-100 px-4 py-6 sm:px-6">
      <div className="mx-auto w-full max-w-2xl">
        <Link
          href={`/tablette/projets/${id}/visites`}
          className="text-sm font-medium text-zinc-400 hover:text-zinc-600"
        >
          ← Visites
        </Link>
        <header className="mb-6 mt-4 rounded-2xl bg-white px-6 py-5 shadow-sm">
          <h1 className="text-2xl font-bold text-zinc-900">Nouvelle visite</h1>
          <p className="mt-2 text-zinc-500">
            Créez une visite du jour pour annoter les plans et poser des pastilles.
          </p>
        </header>
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <CreateVisitForm projectId={id} />
        </div>
      </div>
    </main>
  );
}
