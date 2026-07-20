import Link from "next/link";
import { PcAppNav } from "@/components/pc/PcAppNav";
import {
  DatabaseErrorNotice,
  SupabaseSetupNotice,
} from "@/components/SupabaseSetupNotice";
import {
  getCompanyDirectory,
  getOwnerDirectory,
} from "@/lib/actions/operation-sheet";
import { getAdminPieceTemplates } from "@/lib/actions/admin-pieces";
import { getControlLibrary } from "@/lib/actions/control-library";
import { AdminPieceTemplatesPanel } from "@/components/referentiels/AdminPieceTemplatesPanel";
import { ControlLibraryPanel } from "@/components/referentiels/ControlLibraryPanel";
import { getProfile } from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default async function ReferentielsPage() {
  if (!isSupabaseConfigured()) {
    return <SupabaseSetupNotice />;
  }

  try {
    const [companies, owners, adminTemplates, controlLibrary, profile] =
      await Promise.all([
      getCompanyDirectory().catch(() => []),
      getOwnerDirectory().catch(() => []),
      getAdminPieceTemplates().catch(() => []),
      getControlLibrary().catch(() => []),
      getProfile().catch(() => null),
    ]);

    const canEditTemplates = Boolean(profile);

    return (
      <main className="min-h-full bg-slate-50 px-4 py-6 sm:px-6">
        <div className="mx-auto w-full max-w-[110rem]">
          <PcAppNav />
          <header className="mb-6 rounded-xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
            <h1 className="text-2xl font-semibold text-slate-900">Référentiels</h1>
            <p className="mt-2 text-slate-500">
              Bases de données entreprises et maîtres d&apos;ouvrage (auto-remplissage des fiches opération).
            </p>
          </header>

          <div className="grid gap-6 xl:grid-cols-2">
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">
                Entreprises ({companies.length})
              </h2>
              {companies.length === 0 ? (
                <p className="text-sm text-slate-500">Aucune entreprise enregistrée.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs font-semibold uppercase text-slate-500">
                        <th className="px-2 py-2">Nom</th>
                        <th className="px-2 py-2">SIRET</th>
                        <th className="px-2 py-2">Ville</th>
                        <th className="px-2 py-2">Mail admin</th>
                      </tr>
                    </thead>
                    <tbody>
                      {companies.map((c) => (
                        <tr key={c.id} className="border-b border-slate-100">
                          <td className="px-2 py-2 font-medium">
                            <Link
                              href={`/pc/referentiels/entreprises/${c.id}`}
                              className="text-violet-700 hover:underline"
                            >
                              {c.name}
                            </Link>
                          </td>
                          <td className="px-2 py-2 text-slate-600">{c.siret ?? "—"}</td>
                          <td className="px-2 py-2 text-slate-600">{c.city ?? "—"}</td>
                          <td className="px-2 py-2 text-slate-600">{c.email_administratif ?? "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>

            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h2 className="mb-4 text-lg font-semibold text-slate-900">
                Maîtres d&apos;ouvrage ({owners.length})
              </h2>
              {owners.length === 0 ? (
                <p className="text-sm text-slate-500">Aucun maître d&apos;ouvrage enregistré.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 text-xs font-semibold uppercase text-slate-500">
                        <th className="px-2 py-2">Nom</th>
                        <th className="px-2 py-2">Ville</th>
                        <th className="px-2 py-2">Mail admin</th>
                        <th className="px-2 py-2">Docs</th>
                      </tr>
                    </thead>
                    <tbody>
                      {owners.map((o) => (
                        <tr key={o.id} className="border-b border-slate-100">
                          <td className="px-2 py-2 font-medium">
                            <Link
                              href={`/pc/referentiels/maitres-ouvrage/${o.id}`}
                              className="text-violet-700 hover:underline"
                            >
                              {o.name}
                            </Link>
                          </td>
                          <td className="px-2 py-2 text-slate-600">{o.city ?? "—"}</td>
                          <td className="px-2 py-2 text-slate-600">{o.email_admin ?? "—"}</td>
                          <td className="px-2 py-2 text-xs text-slate-500">
                            {[
                              o.doc_marche && "Marché",
                              o.doc_os && "OS",
                              o.doc_ae && "AE",
                              o.doc_avenant && "Avenant",
                            ]
                              .filter(Boolean)
                              .join(", ") || "—"}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>

          <div className="mt-6 space-y-6">
            <ControlLibraryPanel
              items={controlLibrary}
              canEdit={canEditTemplates}
            />
            <AdminPieceTemplatesPanel
              templates={adminTemplates}
              canEdit={canEditTemplates}
            />
          </div>
        </div>
      </main>
    );
  } catch (error) {
    return (
      <DatabaseErrorNotice
        message={
          error instanceof Error ? error.message : "Impossible de charger les référentiels."
        }
      />
    );
  }
}
