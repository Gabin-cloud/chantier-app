import Link from "next/link";
import {
  canAccessFinance,
  canAccessField,
  canEditProject,
  canManageMembers,
} from "@/lib/auth/permissions";
import type { Project, ProjectRole } from "@/lib/types/database";

type ProjectHubProps = {
  project: Project;
  basePath: "tablette" | "pc";
  projectRole: ProjectRole;
};

function formatLocation(project: Project) {
  const parts = [project.address, project.postal_code, project.city].filter(
    Boolean
  );
  return parts.length > 0 ? parts.join(", ") : null;
}

export function ProjectHub({ project, basePath, projectRole }: ProjectHubProps) {
  const isTablette = basePath === "tablette";
  const location = formatLocation(project);

  const canOpenSettings =
    canEditProject(projectRole) ||
    canManageMembers(projectRole) ||
    canAccessField(projectRole);

  const allTabletteActions = [
    {
      href: `/tablette/projets/${project.id}/parametres`,
      label: "Paramètres du projet",
      description: "Entreprises, plans, accès",
      color: "bg-white border border-zinc-200 text-zinc-900",
      visible: canOpenSettings,
    },
    {
      href: `/tablette/projets/${project.id}/plans`,
      label: "Bibliothèque de plans",
      description: "Parcourir les plans par dossiers",
      color: "bg-violet-600 text-white",
      visible: canAccessField(projectRole),
    },
    {
      href: `/tablette/projets/${project.id}/visites`,
      label: "Visites de chantier",
      description: "Nouvelle visite, plans et pastilles",
      color: "bg-blue-600 text-white",
      visible: canAccessField(projectRole),
    },
    {
      href: `/tablette/checklist`,
      label: "Checklist sécurité",
      description: "Contrôle de sécurité terrain",
      color: "bg-emerald-600 text-white",
      visible: canAccessField(projectRole),
    },
  ];

  const allPcActions = [
    {
      href: `/pc/projets/${project.id}/parametres`,
      label: "Paramètres du projet",
      description: "Entreprises, plans, accès",
      color: "bg-white border border-zinc-200 text-zinc-900",
      visible: canOpenSettings,
    },
    {
      href: `/pc/projets/${project.id}/finance`,
      label: "Suivi financier",
      description: "Lots, situations mensuelles et attestations PDF",
      color: "bg-emerald-600 text-white",
      visible: canAccessFinance(projectRole),
    },
  ];

  const actions = (isTablette ? allTabletteActions : allPcActions).filter(
    (action) => action.visible
  );

  return (
    <div className="mx-auto w-full max-w-2xl">
      <header className="mb-6 rounded-2xl bg-white px-6 py-5 shadow-sm">
        <Link
          href={`/${basePath}`}
          className="text-sm font-medium text-zinc-400 hover:text-zinc-600"
        >
          ← Mes projets
        </Link>
        <h1 className="mt-3 text-2xl font-bold text-zinc-900 sm:text-3xl">
          {project.name}
        </h1>
        {location && <p className="mt-2 text-zinc-500">{location}</p>}
        {project.description && (
          <p className="mt-3 text-sm text-zinc-600">{project.description}</p>
        )}
      </header>

      <div className="space-y-3">
        {actions.length === 0 ? (
          <div className="rounded-2xl bg-white p-5 text-center text-zinc-500 shadow-sm">
            Accès en lecture seule — aucune action disponible pour votre rôle.
          </div>
        ) : (
          actions.map((action) => (
            <Link
              key={action.label}
              href={action.href}
              className={`block rounded-2xl p-5 shadow-sm transition-shadow hover:shadow-md active:scale-[0.99] ${action.color}`}
            >
              <p className="text-lg font-semibold">{action.label}</p>
              <p
                className={`mt-1 text-sm ${
                  action.color.includes("emerald") || action.color.includes("blue")
                    ? "text-white/80"
                    : "text-zinc-500"
                }`}
              >
                {action.description}
              </p>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
