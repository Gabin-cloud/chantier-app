"use client";

import Link from "next/link";
import type { EnterpriseProjectAccess } from "@/lib/types/sous-traitance";

type EnterpriseProjectListProps = {
  accessList: EnterpriseProjectAccess[];
};

function formatLocation(access: EnterpriseProjectAccess) {
  const project = access.projects;
  const parts = [project.address, project.postal_code, project.city].filter(
    Boolean
  );
  return parts.length > 0 ? parts.join(", ") : "Localisation non renseignée";
}

export function EnterpriseProjectList({ accessList }: EnterpriseProjectListProps) {
  const companyName =
    accessList[0]?.enterprises.name ?? "Mon entreprise";

  return (
    <div className="mx-auto w-full max-w-2xl">
      <header className="mb-6 rounded-2xl bg-white px-6 py-5 shadow-sm ring-1 ring-amber-100">
        <p className="text-sm font-medium uppercase tracking-wider text-amber-600">
          Espace entreprise
        </p>
        <h1 className="mt-1 text-2xl font-bold text-zinc-900 sm:text-3xl">
          {companyName}
        </h1>
        <p className="mt-2 text-zinc-500">
          Consultez vos chantiers partagés et déposez vos demandes de
          sous-traitance.
        </p>
      </header>

      <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-400">
        Chantiers partagés
      </h2>

      {accessList.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-amber-200 bg-white px-6 py-12 text-center shadow-sm">
          <p className="text-lg font-medium text-zinc-700">Aucun chantier</p>
          <p className="mt-2 text-zinc-500">
            Votre maître d&apos;œuvre doit créer un accès entreprise depuis
            l&apos;interface PC (paramètres du projet).
          </p>
        </div>
      ) : (
        <ul className="space-y-3">
          {accessList.map((access) => (
            <li key={`${access.project_id}-${access.enterprise_id}`}>
              <Link
                href={`/entreprise/projets/${access.project_id}`}
                className="block rounded-2xl bg-white p-5 shadow-sm ring-1 ring-amber-50 transition-shadow hover:shadow-md hover:ring-amber-200 active:scale-[0.99]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-semibold text-zinc-900">
                      {access.projects.name}
                    </h3>
                    <p className="mt-1 text-sm text-zinc-500">
                      {formatLocation(access)}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {access.enterprises.lot_number && (
                        <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600">
                          Lot {access.enterprises.lot_number}
                        </span>
                      )}
                      {access.enterprises.trade && (
                        <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600">
                          {access.enterprises.trade}
                        </span>
                      )}
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                    Accéder
                  </span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
