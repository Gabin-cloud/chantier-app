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

export default async function PcParametresPage({ params }: PageProps) {
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
      <main className="min-h-full bg-slate-50 px-6 py-8">
        <div className="mx-auto w-full max-w-2xl">
          <Link
            href={`/pc/projets/${id}`}
            className="text-sm font-medium text-slate-400 hover:text-slate-600"
          >
            ← Retour au projet
          </Link>
          <header className="mb-6 mt-4 rounded-xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
            <h1 className="text-2xl font-semibold text-slate-900">Paramètres</h1>
            <p className="mt-2 text-slate-500">{project.name}</p>
          </header>
          <ProjectSettings
            project={project}
            enterprises={project.enterprises}
            plans={plans}
            basePath="pc"
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
