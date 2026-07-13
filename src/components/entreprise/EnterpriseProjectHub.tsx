import Link from "next/link";
import type { Enterprise } from "@/lib/types/database";
import type { Project } from "@/lib/types/database";

type EnterpriseProjectHubProps = {
  project: Project;
  enterprise: Enterprise;
  pendingCount?: number;
};

function formatLocation(project: Project) {
  const parts = [project.address, project.postal_code, project.city].filter(
    Boolean
  );
  return parts.length > 0 ? parts.join(", ") : null;
}

export function EnterpriseProjectHub({
  project,
  enterprise,
  pendingCount = 0,
}: EnterpriseProjectHubProps) {
  const location = formatLocation(project);
  const lotLabel = enterprise.lot_number ? `Lot ${enterprise.lot_number}` : null;

  const actions = [
    {
      href: `/entreprise/projets/${project.id}/sous-traitance`,
      label: "Sous-traitance",
      description: "Suivi des demandes déposées et de leur statut",
      color: "bg-white border border-amber-200 text-zinc-900",
      badge: pendingCount > 0 ? `${pendingCount} en cours` : null,
    },
    {
      href: `/entreprise/projets/${project.id}/sous-traitance/nouvelle`,
      label: "Nouvelle demande de sous-traitance",
      description: "Devis, variantes, travaux supplémentaires",
      color: "bg-amber-600 text-white",
      badge: null,
    },
    {
      href: `/entreprise/projets/${project.id}/choix-travaux`,
      label: "Choix de travaux",
      description: "Sélections d'appareillages, finitions, options",
      color: "bg-orange-600 text-white",
      badge: null,
    },
  ];

  return (
    <div className="mx-auto w-full max-w-2xl">
      <header className="mb-6 rounded-2xl bg-white px-6 py-5 shadow-sm ring-1 ring-amber-100">
        <Link
          href="/entreprise"
          className="text-sm font-medium text-amber-600 hover:text-amber-700"
        >
          ← Mes chantiers
        </Link>
        <h1 className="mt-3 text-2xl font-bold text-zinc-900 sm:text-3xl">
          {project.name}
        </h1>
        {location && <p className="mt-2 text-zinc-500">{location}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full bg-amber-100 px-3 py-1 text-sm font-semibold text-amber-900">
            {enterprise.name}
          </span>
          {lotLabel && (
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-sm font-medium text-zinc-700">
              {lotLabel}
            </span>
          )}
          {enterprise.trade && (
            <span className="rounded-full bg-zinc-100 px-3 py-1 text-sm font-medium text-zinc-700">
              {enterprise.trade}
            </span>
          )}
        </div>
      </header>

      <div className="space-y-3">
        {actions.map((action) => (
          <Link
            key={action.label}
            href={action.href}
            className={`block rounded-2xl p-5 shadow-sm transition-shadow hover:shadow-md active:scale-[0.99] ${action.color}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-lg font-semibold">{action.label}</p>
                <p
                  className={`mt-1 text-sm ${
                    action.color.includes("text-white")
                      ? "text-white/80"
                      : "text-zinc-500"
                  }`}
                >
                  {action.description}
                </p>
              </div>
              {action.badge && (
                <span className="shrink-0 rounded-full bg-amber-100 px-2.5 py-1 text-xs font-bold text-amber-800">
                  {action.badge}
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
