import Link from "next/link";
import { PcAppNav } from "@/components/pc/PcAppNav";
import {
  DatabaseErrorNotice,
  SupabaseSetupNotice,
} from "@/components/SupabaseSetupNotice";
import { getCompanyDirectory } from "@/lib/actions/operation-sheet";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type PageProps = {
  params: Promise<{ id: string }>;
};

function FieldRow({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="grid gap-1 border-b border-slate-100 py-3 sm:grid-cols-[12rem_1fr]">
      <dt className="text-sm font-semibold text-slate-500">{label}</dt>
      <dd className="text-sm text-slate-900">{value?.trim() ? value : "—"}</dd>
    </div>
  );
}

export default async function CompanyDetailPage({ params }: PageProps) {
  if (!isSupabaseConfigured()) {
    return <SupabaseSetupNotice />;
  }

  const { id } = await params;

  try {
    const companies = await getCompanyDirectory();
    const company = companies.find((entry) => entry.id === id);

    if (!company) {
      return <DatabaseErrorNotice message="Entreprise introuvable dans le référentiel." />;
    }

    return (
      <main className="min-h-full bg-slate-50 px-4 py-6 sm:px-6">
        <div className="mx-auto w-full max-w-4xl">
          <PcAppNav />
          <Link href="/pc/referentiels" className="text-sm font-medium text-slate-400 hover:text-slate-600">
            ← Référentiels
          </Link>
          <header className="mb-6 mt-4 rounded-xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
            <h1 className="text-2xl font-semibold text-slate-900">{company.name}</h1>
            <p className="mt-2 text-sm text-slate-500">Fiche brute — toutes les informations référentiel.</p>
          </header>

          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-2 text-lg font-semibold text-slate-900">Informations enregistrées</h2>
            <dl>
              <FieldRow label="Nom" value={company.name} />
              <FieldRow label="SIRET" value={company.siret} />
              <FieldRow label="Adresse" value={company.address} />
              <FieldRow label="Code postal" value={company.postal_code} />
              <FieldRow label="Ville" value={company.city} />
              <FieldRow label="Mail administratif" value={company.email_administratif} />
              <FieldRow label="Mail comptabilité" value={company.email_comptabilite} />
              <FieldRow label="Mail travaux" value={company.email_travaux} />
              <FieldRow label="Mail bureau d'études" value={company.email_bureau_etudes} />
              <FieldRow label="Mail signataire" value={company.email_signataire} />
              <FieldRow label="Signataire" value={company.signataire_name} />
              <FieldRow label="Mail SAV" value={company.email_sav} />
              <FieldRow label="Tél. accueil" value={company.phone_accueil} />
              <FieldRow label="Tél. travaux" value={company.phone_travaux} />
              <FieldRow label="Logo" value={company.logo_path} />
              <FieldRow label="Créé le" value={new Date(company.created_at).toLocaleString("fr-FR")} />
              <FieldRow label="Mis à jour le" value={new Date(company.updated_at).toLocaleString("fr-FR")} />
            </dl>
          </section>

          <section className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Fichiers liés</h2>
            <p className="mt-2 text-sm text-slate-500">
              Vue brute à compléter — les documents liés à cette entreprise seront listés ici
              (logos, pièces marché, dossiers SharePoint, etc.).
            </p>
            {company.logo_path ? (
              <p className="mt-3 font-mono text-xs text-slate-600">{company.logo_path}</p>
            ) : (
              <p className="mt-3 text-sm text-slate-400">Aucun fichier référencé pour le moment.</p>
            )}
          </section>
        </div>
      </main>
    );
  } catch (error) {
    return (
      <DatabaseErrorNotice
        message={error instanceof Error ? error.message : "Impossible de charger l'entreprise."}
      />
    );
  }
}
