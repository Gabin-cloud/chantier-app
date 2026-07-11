import Link from "next/link";
import { ControlBoardTable } from "@/components/controls/ControlBoardTable";
import {
  DatabaseErrorNotice,
  SupabaseSetupNotice,
} from "@/components/SupabaseSetupNotice";
import { getProjectControlBoard } from "@/lib/actions/checklist";
import { getProject } from "@/lib/actions/projects";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function ControlesPage({ params }: PageProps) {
  if (!isSupabaseConfigured()) {
    return <SupabaseSetupNotice />;
  }

  const { id } = await params;

  try {
    const [project, rows] = await Promise.all([
      getProject(id),
      getProjectControlBoard(id).catch(() => []),
    ]);

    return (
      <main className="min-h-full bg-slate-50 px-6 py-8">
        <div className="mx-auto w-full max-w-7xl">
          <Link
            href={`/pc/projets/${id}`}
            className="text-sm font-medium text-slate-400 hover:text-slate-600"
          >
            ← Retour au projet
          </Link>
          <header className="mb-6 mt-4 rounded-xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
            <h1 className="text-2xl font-semibold text-slate-900">
              Tableau de contrôle
            </h1>
            <p className="mt-2 text-slate-500">
              {project.name} — synthèse par phase et zone
            </p>
          </header>

          <ControlBoardTable rows={rows} projectId={id} />
        </div>
      </main>
    );
  } catch (error) {
    return (
      <DatabaseErrorNotice
        message={
          error instanceof Error ? error.message : "Impossible de charger les contrôles."
        }
      />
    );
  }
}
