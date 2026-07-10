import Link from "next/link";
import { ProjectSettings } from "@/components/projects/ProjectSettings";
import {
  DatabaseErrorNotice,
  SupabaseSetupNotice,
} from "@/components/SupabaseSetupNotice";
import { getPlansWithUrls } from "@/lib/actions/plans";
import { getProject } from "@/lib/actions/projects";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ParametresPage({ params }: PageProps) {
  if (!isSupabaseConfigured()) {
    return <SupabaseSetupNotice />;
  }

  const { id } = await params;

  try {
    const [project, plans] = await Promise.all([
      getProject(id),
      getPlansWithUrls(id),
    ]);

    return (
      <main className="min-h-full bg-zinc-100 px-4 py-6 sm:px-6">
        <div className="mx-auto w-full max-w-2xl">
          <Link
            href={`/tablette/projets/${id}`}
            className="text-sm font-medium text-zinc-400 hover:text-zinc-600"
          >
            ← Retour au projet
          </Link>
          <header className="mb-6 mt-4 rounded-2xl bg-white px-6 py-5 shadow-sm">
            <h1 className="text-2xl font-bold text-zinc-900">Paramètres</h1>
            <p className="mt-2 text-zinc-500">{project.name}</p>
          </header>
          <ProjectSettings
            project={project}
            enterprises={project.enterprises}
            plans={plans}
            basePath="tablette"
          />
        </div>
      </main>
    );
  } catch (error) {
    return (
      <DatabaseErrorNotice
        message={
          error instanceof Error ? error.message : "Projet introuvable."
        }
      />
    );
  }
}
