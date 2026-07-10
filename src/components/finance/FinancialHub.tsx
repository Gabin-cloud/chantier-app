import Link from "next/link";
import type { Project } from "@/lib/types/database";

type FinancialHubProps = {
  project: Project;
};

const sections = [
  {
    href: "lots",
    label: "Lots & marchés",
    description: "Référentiel BDD, montants HT, prorata et avenants",
    color: "bg-white border border-slate-200 text-slate-900",
  },
  {
    href: "recap",
    label: "Récap marchés",
    description: "Synthèse des marchés et avenants par lot",
    color: "bg-white border border-slate-200 text-slate-900",
  },
  {
    href: "situations",
    label: "Situations de travaux",
    description: "Saisie mensuelle, cumuls HT et attestations PDF",
    color: "bg-blue-600 text-white",
  },
  {
    href: "recap-situations",
    label: "Récap situations",
    description: "Vue consolidée des situations par entreprise",
    color: "bg-white border border-slate-200 text-slate-900",
  },
  {
    href: "#",
    label: "Sous-traitance",
    description: "Bientôt disponible",
    color: "bg-slate-200 text-slate-500 cursor-not-allowed",
    disabled: true,
  },
  {
    href: "#",
    label: "Suivi devis",
    description: "Bientôt disponible",
    color: "bg-slate-200 text-slate-500 cursor-not-allowed",
    disabled: true,
  },
  {
    href: "#",
    label: "Suivi DGD",
    description: "Bientôt disponible",
    color: "bg-slate-200 text-slate-500 cursor-not-allowed",
    disabled: true,
  },
];

export function FinancialHub({ project }: FinancialHubProps) {
  const base = `/pc/projets/${project.id}/finance`;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <header className="mb-6 rounded-2xl bg-white px-6 py-5 shadow-sm">
        <Link
          href={`/pc/projets/${project.id}`}
          className="text-sm font-medium text-slate-400 hover:text-slate-600"
        >
          ← Retour au projet
        </Link>
        <h1 className="mt-3 text-2xl font-bold text-slate-900 sm:text-3xl">
          Suivi financier
        </h1>
        <p className="mt-2 text-slate-500">{project.name}</p>
        {project.client_name && (
          <p className="mt-1 text-sm text-slate-400">
            Maître d&apos;ouvrage : {project.client_name}
          </p>
        )}
      </header>

      <div className="grid gap-3 sm:grid-cols-2">
        {sections.map((section) =>
          section.disabled ? (
            <div
              key={section.label}
              className={`rounded-2xl p-5 shadow-sm ${section.color}`}
            >
              <p className="text-lg font-semibold">{section.label}</p>
              <p className="mt-1 text-sm opacity-80">{section.description}</p>
            </div>
          ) : (
            <Link
              key={section.label}
              href={`${base}/${section.href}`}
              className={`rounded-2xl p-5 shadow-sm transition-shadow hover:shadow-md active:scale-[0.99] ${section.color}`}
            >
              <p className="text-lg font-semibold">{section.label}</p>
              <p
                className={`mt-1 text-sm ${
                  section.color.includes("blue") ? "text-white/80" : "text-slate-500"
                }`}
              >
                {section.description}
              </p>
            </Link>
          )
        )}
      </div>
    </div>
  );
}
