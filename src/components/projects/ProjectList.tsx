import Link from "next/link";
import type { Project } from "@/lib/types/database";
import { NewProjectButton } from "@/components/projects/NewProjectButton";

type ProjectListProps = {
  projects: Project[];
  basePath: "tablette" | "pc";
};

function formatLocation(project: Project) {
  const parts = [project.address, project.postal_code, project.city].filter(
    Boolean
  );
  return parts.length > 0 ? parts.join(", ") : "Localisation non renseignée";
}

export function ProjectList({ projects, basePath }: ProjectListProps) {
  const isTablette = basePath === "tablette";

  const buttonClass = `shrink-0 rounded-xl px-4 py-3 text-sm font-semibold text-white transition-colors disabled:opacity-50 ${
    isTablette
      ? "bg-emerald-600 hover:bg-emerald-500"
      : "bg-slate-800 hover:bg-slate-700"
  }`;

  const emptyButtonClass = `mt-6 inline-block rounded-xl px-6 py-3 font-semibold text-white disabled:opacity-50 ${
    isTablette ? "bg-emerald-600 hover:bg-emerald-500" : "bg-slate-800 hover:bg-slate-700"
  }`;

  return (
    <div className="mx-auto w-full max-w-2xl">
      <header className="mb-6 flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium uppercase tracking-wider text-zinc-400">
            {isTablette ? "Terrain" : "Bureau"}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-zinc-900 sm:text-3xl">
            Mes projets
          </h1>
          <p className="mt-2 text-zinc-500">
            Choisissez un chantier ou créez-en un nouveau.
          </p>
        </div>
        <NewProjectButton basePath={basePath} className={buttonClass}>
          + Nouveau
        </NewProjectButton>
      </header>

      {projects.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-zinc-200 bg-white px-6 py-12 text-center shadow-sm">
          <p className="text-lg font-medium text-zinc-700">Aucun projet</p>
          <p className="mt-2 text-zinc-500">
            Créez votre premier chantier pour commencer.
          </p>
          <NewProjectButton basePath={basePath} className={emptyButtonClass}>
            Créer un projet
          </NewProjectButton>
        </div>
      ) : (
        <ul className="space-y-3">
          {projects.map((project) => (
            <li key={project.id}>
              <Link
                href={`/${basePath}/projets/${project.id}`}
                className="block rounded-2xl bg-white p-5 shadow-sm transition-shadow hover:shadow-md active:scale-[0.99]"
              >
                <h2 className="text-lg font-semibold text-zinc-900">
                  {project.name}
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  {formatLocation(project)}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
