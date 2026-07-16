"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toggleProjectFavorite } from "@/lib/actions/favorites";
import type { Project } from "@/lib/types/database";
import { NewProjectButton } from "@/components/projects/NewProjectButton";

type ProjectListProps = {
  projects: Project[];
  basePath: "tablette" | "pc";
  favoriteIds?: string[];
};

function formatLocation(project: Project) {
  const parts = [project.address, project.postal_code, project.city].filter(
    Boolean
  );
  return parts.length > 0 ? parts.join(", ") : "Localisation non renseignée";
}

export function ProjectList({
  projects,
  basePath,
  favoriteIds = [],
}: ProjectListProps) {
  const isTablette = basePath === "tablette";
  const [favorites, setFavorites] = useState(() => new Set(favoriteIds));
  const [isPending, startTransition] = useTransition();

  const buttonClass = `shrink-0 rounded-xl px-4 py-3 text-sm font-semibold text-white transition-colors disabled:opacity-50 ${
    isTablette
      ? "bg-emerald-600 hover:bg-emerald-500"
      : "bg-slate-800 hover:bg-slate-700"
  }`;

  const emptyButtonClass = `mt-6 inline-block rounded-xl px-6 py-3 font-semibold text-white disabled:opacity-50 ${
    isTablette ? "bg-emerald-600 hover:bg-emerald-500" : "bg-slate-800 hover:bg-slate-700"
  }`;

  const favoriteProjects = projects.filter((p) => favorites.has(p.id));

  function handleToggleFavorite(projectId: string) {
    const wasFavorite = favorites.has(projectId);
    setFavorites((prev) => {
      const next = new Set(prev);
      if (wasFavorite) next.delete(projectId);
      else next.add(projectId);
      return next;
    });

    startTransition(async () => {
      try {
        const result = await toggleProjectFavorite(projectId);
        setFavorites((prev) => {
          const next = new Set(prev);
          if (result.favorited) next.add(projectId);
          else next.delete(projectId);
          return next;
        });
      } catch {
        setFavorites((prev) => {
          const next = new Set(prev);
          if (wasFavorite) next.add(projectId);
          else next.delete(projectId);
          return next;
        });
      }
    });
  }

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

      {favoriteProjects.length > 0 && (
        <section className="mb-5">
          <h2 className="mb-2 flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-zinc-500">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5 text-amber-500" fill="currentColor" aria-hidden>
              <path d="M12 3.5l2.7 5.47 6.04.88-4.37 4.26 1.03 6.01L12 17.77l-5.4 2.85 1.03-6.01L3.26 9.85l6.04-.88L12 3.5z" />
            </svg>
            Favoris
          </h2>
          <ul className="flex flex-wrap gap-2">
            {favoriteProjects.map((project) => (
              <li key={`fav-${project.id}`}>
                <Link
                  href={`/${basePath}/projets/${project.id}`}
                  className={`inline-flex max-w-full items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium shadow-sm ${
                    isTablette
                      ? "bg-emerald-50 text-emerald-900 ring-1 ring-emerald-100"
                      : "bg-slate-100 text-slate-800"
                  }`}
                >
                  <span className="truncate">{project.name}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

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
          {projects.map((project) => {
            const isFavorite = favorites.has(project.id);
            return (
              <li key={project.id} className="flex items-stretch gap-2">
                <Link
                  href={`/${basePath}/projets/${project.id}`}
                  className="block min-w-0 flex-1 rounded-2xl bg-white p-5 shadow-sm transition-shadow hover:shadow-md active:scale-[0.99]"
                >
                  <h2 className="text-lg font-semibold text-zinc-900">
                    {project.name}
                  </h2>
                  <p className="mt-1 text-sm text-zinc-500">
                    {formatLocation(project)}
                  </p>
                </Link>
                <button
                  type="button"
                  onClick={() => handleToggleFavorite(project.id)}
                  disabled={isPending}
                  title={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
                  aria-label={isFavorite ? "Retirer des favoris" : "Ajouter aux favoris"}
                  className={`shrink-0 self-center rounded-xl px-3 py-3 shadow-sm transition-colors disabled:opacity-50 ${
                    isFavorite
                      ? "bg-amber-50 text-amber-500"
                      : "bg-white text-zinc-300 hover:text-amber-500"
                  }`}
                >
                  <svg
                    viewBox="0 0 24 24"
                    className="h-5 w-5"
                    fill={isFavorite ? "currentColor" : "none"}
                    stroke="currentColor"
                    strokeWidth="1.8"
                    aria-hidden
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 3.5l2.7 5.47 6.04.88-4.37 4.26 1.03 6.01L12 17.77l-5.4 2.85 1.03-6.01L3.26 9.85l6.04-.88L12 3.5z"
                    />
                  </svg>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
