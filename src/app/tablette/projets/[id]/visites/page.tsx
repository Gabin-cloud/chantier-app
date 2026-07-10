import Link from "next/link";
import {
  DatabaseErrorNotice,
  SupabaseSetupNotice,
} from "@/components/SupabaseSetupNotice";
import { getVisits } from "@/lib/actions/visits";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function VisitesPage({ params }: PageProps) {
  if (!isSupabaseConfigured()) {
    return <SupabaseSetupNotice />;
  }

  const { id } = await params;

  try {
    const visits = await getVisits(id);

    return (
      <main className="min-h-full bg-zinc-100 px-4 py-6 sm:px-6">
        <div className="mx-auto w-full max-w-2xl">
          <Link
            href={`/tablette/projets/${id}`}
            className="text-sm font-medium text-zinc-400 hover:text-zinc-600"
          >
            ← Retour au projet
          </Link>

          <header className="mb-6 mt-4 flex items-start justify-between gap-4 rounded-2xl bg-white px-6 py-5 shadow-sm">
            <div>
              <h1 className="text-2xl font-bold text-zinc-900">Visites de chantier</h1>
              <p className="mt-2 text-zinc-500">
                Historique des visites et annotations sur plans.
              </p>
            </div>
            <Link
              href={`/tablette/projets/${id}/visites/nouvelle`}
              className="shrink-0 rounded-xl bg-emerald-600 px-4 py-3 text-sm font-bold text-white hover:bg-emerald-500"
            >
              + Nouvelle
            </Link>
          </header>

          {visits.length === 0 ? (
            <div className="rounded-2xl bg-white px-6 py-10 text-center shadow-sm">
              <p className="text-zinc-600">Aucune visite pour l&apos;instant.</p>
              <Link
                href={`/tablette/projets/${id}/visites/nouvelle`}
                className="mt-4 inline-block rounded-xl bg-zinc-900 px-6 py-3 font-semibold text-white"
              >
                Créer une visite
              </Link>
            </div>
          ) : (
            <ul className="space-y-3">
              {visits.map((visit) => (
                <li key={visit.id}>
                  <Link
                    href={`/tablette/projets/${id}/visites/${visit.id}`}
                    className="block rounded-2xl bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-lg font-semibold text-zinc-900">
                          {visit.title}
                        </p>
                        <p className="mt-1 text-sm text-zinc-500">
                          {new Date(visit.visit_date).toLocaleDateString("fr-FR", {
                            weekday: "long",
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-3 py-1 text-xs font-semibold ${
                          visit.status === "completed"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {visit.status === "completed" ? "Terminée" : "En cours"}
                      </span>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>
    );
  } catch (error) {
    return (
      <DatabaseErrorNotice
        message={
          error instanceof Error ? error.message : "Impossible de charger les visites."
        }
      />
    );
  }
}
