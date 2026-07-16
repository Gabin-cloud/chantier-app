"use client";

import Link from "next/link";
import { useDeferredValue, useMemo, useState, useTransition } from "react";
import { toggleProjectFavorite } from "@/lib/actions/favorites";
import { NewProjectButton } from "@/components/projects/NewProjectButton";
import type { Project } from "@/lib/types/database";

type PcHomeBrowserProps = {
  projects: Project[];
  favoriteIds: string[];
};

type OwnerGroup = {
  key: string;
  label: string;
  projects: Project[];
};

function ownerLabel(project: Project) {
  const name = (project.owner_name || project.client_name || "").trim();
  return name || "Sans maître d'ouvrage";
}

function formatLocation(project: Project) {
  const parts = [project.address, project.postal_code, project.city].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

function groupByOwner(projects: Project[]): OwnerGroup[] {
  const map = new Map<string, OwnerGroup>();
  for (const project of projects) {
    const label = ownerLabel(project);
    const key = label.toLocaleLowerCase("fr-FR");
    const group = map.get(key);
    if (group) {
      group.projects.push(project);
    } else {
      map.set(key, { key, label, projects: [project] });
    }
  }

  return Array.from(map.values())
    .map((group) => ({
      ...group,
      projects: [...group.projects].sort((a, b) =>
        a.name.localeCompare(b.name, "fr", { sensitivity: "base" })
      ),
    }))
    .sort((a, b) => {
      if (a.label === "Sans maître d'ouvrage") return 1;
      if (b.label === "Sans maître d'ouvrage") return -1;
      return a.label.localeCompare(b.label, "fr", { sensitivity: "base" });
    });
}

function FolderIcon({ open }: { open: boolean }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-5 w-5 shrink-0 text-amber-500"
      fill="currentColor"
      aria-hidden
    >
      {open ? (
        <path d="M2 6.5A2.5 2.5 0 0 1 4.5 4H9l2 2h8.5A2.5 2.5 0 0 1 22 8.5V11H4.2L2.4 17.2A2.5 2.5 0 0 1 2 16.5v-10Z" />
      ) : (
        <path d="M10 4H4.5A2.5 2.5 0 0 0 2 6.5v11A2.5 2.5 0 0 0 4.5 20h15a2.5 2.5 0 0 0 2.5-2.5v-9A2.5 2.5 0 0 0 19.5 6H12l-2-2Z" />
      )}
    </svg>
  );
}

function FileIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-4 w-4 shrink-0 text-slate-400"
      fill="currentColor"
      aria-hidden
    >
      <path d="M6 2h8l4 4v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm7 1.5V7h3.5L13 3.5Z" />
    </svg>
  );
}

function StarButton({
  active,
  disabled,
  onClick,
}: {
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick();
      }}
      disabled={disabled}
      title={active ? "Retirer des favoris" : "Ajouter aux favoris"}
      aria-label={active ? "Retirer des favoris" : "Ajouter aux favoris"}
      className={`rounded-md p-1.5 transition-colors disabled:opacity-50 ${
        active
          ? "text-amber-500 hover:bg-amber-50"
          : "text-slate-300 hover:bg-slate-100 hover:text-amber-500"
      }`}
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill={active ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.8" aria-hidden>
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M12 3.5l2.7 5.47 6.04.88-4.37 4.26 1.03 6.01L12 17.77l-5.4 2.85 1.03-6.01L3.26 9.85l6.04-.88L12 3.5z"
        />
      </svg>
    </button>
  );
}

export function PcHomeBrowser({ projects, favoriteIds }: PcHomeBrowserProps) {
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query.trim().toLocaleLowerCase("fr-FR"));
  const [favorites, setFavorites] = useState(() => new Set(favoriteIds));
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set());
  const [isPending, startTransition] = useTransition();

  const favoriteProjects = useMemo(
    () => projects.filter((p) => favorites.has(p.id)),
    [projects, favorites]
  );

  const filteredProjects = useMemo(() => {
    if (!deferredQuery) return projects;
    return projects.filter((project) => {
      const haystack = [
        project.name,
        project.owner_name,
        project.client_name,
        project.city,
        project.address,
        project.postal_code,
      ]
        .filter(Boolean)
        .join(" ")
        .toLocaleLowerCase("fr-FR");
      return haystack.includes(deferredQuery);
    });
  }, [projects, deferredQuery]);

  const groups = useMemo(() => groupByOwner(filteredProjects), [filteredProjects]);

  // En recherche : tout déplier ; sinon respecter l'état utilisateur
  const isSearching = deferredQuery.length > 0;

  function toggleFolder(key: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

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
    <div className="space-y-5">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-400">
            Bureau
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Explorateur d&apos;opérations
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Parcourez les chantiers par maître d&apos;ouvrage, comme des dossiers.
          </p>
        </div>
        <NewProjectButton
          basePath="pc"
          className="shrink-0 rounded-xl bg-slate-800 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-700 disabled:opacity-50"
        >
          + Nouvelle opération
        </NewProjectButton>
      </header>

      <div className="relative">
        <svg
          viewBox="0 0 24 24"
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          aria-hidden
        >
          <circle cx="11" cy="11" r="7" />
          <path strokeLinecap="round" d="M20 20l-3.5-3.5" />
        </svg>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Rechercher une opération, un maître d'ouvrage, une ville…"
          className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-10 pr-4 text-sm text-slate-800 shadow-sm placeholder:text-slate-400 focus:border-slate-400 focus:outline-none"
          aria-label="Rechercher une opération"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)]">
        {/* Favoris */}
        <aside className="rounded-xl border border-slate-200 bg-[#f7f5f0] p-3 lg:min-h-[420px]">
          <div className="mb-3 flex items-center gap-2 px-1">
            <svg viewBox="0 0 24 24" className="h-4 w-4 text-amber-500" fill="currentColor" aria-hidden>
              <path d="M12 3.5l2.7 5.47 6.04.88-4.37 4.26 1.03 6.01L12 17.77l-5.4 2.85 1.03-6.01L3.26 9.85l6.04-.88L12 3.5z" />
            </svg>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600">
              Favoris
            </h2>
          </div>
          {favoriteProjects.length === 0 ? (
            <p className="px-1 text-xs leading-relaxed text-slate-500">
              Cliquez sur l&apos;étoile d&apos;une opération pour l&apos;épingler ici.
            </p>
          ) : (
            <ul className="space-y-1">
              {favoriteProjects.map((project) => (
                <li key={project.id}>
                  <Link
                    href={`/pc/projets/${project.id}`}
                    className="group flex items-start gap-2 rounded-lg px-2 py-2 text-sm transition-colors hover:bg-white"
                  >
                    <FileIcon />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-slate-800 group-hover:text-slate-950">
                        {project.name}
                      </span>
                      <span className="block truncate text-[11px] text-slate-500">
                        {ownerLabel(project)}
                      </span>
                    </span>
                    <StarButton
                      active
                      disabled={isPending}
                      onClick={() => handleToggleFavorite(project.id)}
                    />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </aside>

        {/* Explorateur fichiers */}
        <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Ce PC
            </span>
            <span className="text-slate-300">/</span>
            <span className="text-xs font-medium text-slate-600">Opérations</span>
            <span className="ml-auto text-xs text-slate-400">
              {filteredProjects.length} site{filteredProjects.length === 1 ? "" : "s"}
            </span>
          </div>

          {projects.length === 0 ? (
            <div className="px-6 py-14 text-center">
              <p className="text-base font-medium text-slate-700">Aucun dossier</p>
              <p className="mt-1 text-sm text-slate-500">
                Créez une opération pour commencer l&apos;arborescence.
              </p>
              <NewProjectButton
                basePath="pc"
                className="mt-5 inline-block rounded-xl bg-slate-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-slate-700"
              >
                Créer une opération
              </NewProjectButton>
            </div>
          ) : groups.length === 0 ? (
            <div className="px-6 py-14 text-center text-sm text-slate-500">
              Aucun résultat pour « {query} ».
            </div>
          ) : (
            <ul className="divide-y divide-slate-100">
              {groups.map((group) => {
                const open = isSearching || expanded.has(group.key);
                return (
                  <li key={group.key}>
                    <button
                      type="button"
                      onClick={() => toggleFolder(group.key)}
                      className="flex w-full items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-slate-50"
                      aria-expanded={open}
                    >
                      <svg
                        viewBox="0 0 20 20"
                        className={`h-3.5 w-3.5 shrink-0 text-slate-400 transition-transform ${
                          open ? "rotate-90" : ""
                        }`}
                        fill="currentColor"
                        aria-hidden
                      >
                        <path d="M7 5.5 12.5 10 7 14.5V5.5Z" />
                      </svg>
                      <FolderIcon open={open} />
                      <span className="min-w-0 flex-1 truncate font-semibold text-slate-800">
                        {group.label}
                      </span>
                      <span className="rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                        {group.projects.length}
                      </span>
                    </button>

                    {open && (
                      <ul className="border-t border-slate-50 bg-[#fafaf8] pb-1">
                        {group.projects.map((project) => {
                          const location = formatLocation(project);
                          const isFavorite = favorites.has(project.id);
                          return (
                            <li key={project.id} className="flex items-stretch">
                              <Link
                                href={`/pc/projets/${project.id}`}
                                className="flex min-w-0 flex-1 items-center gap-2.5 py-2.5 pl-12 pr-2 transition-colors hover:bg-white"
                              >
                                <FileIcon />
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate text-sm font-medium text-slate-800">
                                    {project.name}
                                  </span>
                                  {location && (
                                    <span className="block truncate text-xs text-slate-500">
                                      {location}
                                    </span>
                                  )}
                                </span>
                              </Link>
                              <div className="flex items-center pr-3">
                                <StarButton
                                  active={isFavorite}
                                  disabled={isPending}
                                  onClick={() => handleToggleFavorite(project.id)}
                                />
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
