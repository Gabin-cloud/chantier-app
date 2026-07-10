import Link from "next/link";
import { CreateProjectForm } from "@/components/projects/CreateProjectForm";
import { SupabaseSetupNotice } from "@/components/SupabaseSetupNotice";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default function NouveauProjetPage() {
  if (!isSupabaseConfigured()) {
    return <SupabaseSetupNotice />;
  }

  return (
    <main className="min-h-full bg-zinc-100 px-4 py-6 sm:px-6">
      <div className="mx-auto w-full max-w-2xl">
        <Link
          href="/tablette"
          className="text-sm font-medium text-zinc-400 hover:text-zinc-600"
        >
          ← Mes projets
        </Link>
        <header className="mb-6 mt-4 rounded-2xl bg-white px-6 py-5 shadow-sm">
          <h1 className="text-2xl font-bold text-zinc-900">Nouveau projet</h1>
          <p className="mt-2 text-zinc-500">
            Créez un chantier. Vous pourrez ensuite configurer les entreprises
            et la localisation.
          </p>
        </header>
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <CreateProjectForm basePath="tablette" />
        </div>
      </div>
    </main>
  );
}
