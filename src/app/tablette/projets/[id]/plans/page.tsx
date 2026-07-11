import Link from "next/link";
import { PlanBrowser } from "@/components/plans/PlanBrowser";
import {
  DatabaseErrorNotice,
  SupabaseSetupNotice,
} from "@/components/SupabaseSetupNotice";
import { getPlanLibrary } from "@/lib/actions/plans";
import { getProject } from "@/lib/actions/projects";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function PlansPage({ params }: PageProps) {
  if (!isSupabaseConfigured()) {
    return <SupabaseSetupNotice />;
  }

  const { id } = await params;

  try {
    const [project, library] = await Promise.all([
      getProject(id),
      getPlanLibrary(id),
    ]);

    return (
      <main className="min-h-full bg-zinc-100 px-4 py-6 sm:px-6">
        <div className="mx-auto w-full max-w-6xl">
          <Link
            href={`/tablette/projets/${id}`}
            className="text-sm font-medium text-zinc-400 hover:text-zinc-600"
          >
            ← Retour au projet
          </Link>
          <header className="mb-6 mt-4 rounded-2xl bg-white px-6 py-5 shadow-sm">
            <h1 className="text-2xl font-bold text-zinc-900">Bibliothèque de plans</h1>
            <p className="mt-2 text-zinc-500">{project.name}</p>
          </header>

          {library.plans.length === 0 ? (
            <div className="rounded-2xl bg-white px-6 py-10 text-center shadow-sm">
              <p className="text-zinc-600">Aucun plan importé.</p>
              <Link
                href={`/tablette/projets/${id}/parametres`}
                className="mt-4 inline-block rounded-xl bg-zinc-900 px-6 py-3 font-semibold text-white"
              >
                Importer des plans
              </Link>
            </div>
          ) : (
            <PlanBrowser
              projectId={id}
              folders={library.folders}
              plans={library.plans}
            />
          )}
        </div>
      </main>
    );
  } catch (error) {
    return (
      <DatabaseErrorNotice
        message={error instanceof Error ? error.message : "Impossible de charger les plans."}
      />
    );
  }
}
