import Link from "next/link";
import { PcAppNav } from "@/components/pc/PcAppNav";
import { OwnerDocumentTemplates } from "@/components/referentiels/OwnerDocumentTemplates";
import {
  DatabaseErrorNotice,
  SupabaseSetupNotice,
} from "@/components/SupabaseSetupNotice";
import { getOwnerDocumentTemplatesPage } from "@/lib/actions/owner-document-templates";
import { getOwnerDirectory } from "@/lib/actions/operation-sheet";
import type { OwnerDirectoryEntry } from "@/lib/types/database";
import type { OwnerDocumentTemplatesPageData } from "@/lib/actions/owner-document-templates";
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

function OwnerInfosPanel({ owner }: { owner: OwnerDirectoryEntry }) {
  const docs = [
    owner.doc_marche && "Marché",
    owner.doc_os && "OS",
    owner.doc_ae && "AE",
    owner.doc_avenant && "Avenant",
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="mb-2 text-lg font-semibold text-slate-900">Informations enregistrées</h2>
        <dl>
          <FieldRow label="Nom" value={owner.name} />
          <FieldRow label="Adresse" value={owner.address} />
          <FieldRow label="Code postal" value={owner.postal_code} />
          <FieldRow label="Ville" value={owner.city} />
          <FieldRow label="Mail administratif" value={owner.email_admin} />
          <FieldRow label="Mail suivi travaux" value={owner.email_works} />
          <FieldRow label="Signataire" value={owner.signatory_name} />
          <FieldRow label="Mail signataire" value={owner.signatory_email} />
          <FieldRow label="Documents types" value={docs || null} />
          <FieldRow label="Logo" value={owner.logo_path} />
          <FieldRow label="Créé le" value={new Date(owner.created_at).toLocaleString("fr-FR")} />
          <FieldRow
            label="Mis à jour le"
            value={new Date(owner.updated_at).toLocaleString("fr-FR")}
          />
        </dl>
      </section>

      <section className="rounded-2xl border border-dashed border-slate-300 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Documents métier</h2>
        <p className="mt-2 text-sm text-slate-500">
          Configurez les modèles <strong>OS</strong> et <strong>Acte d&apos;engagement</strong> dans
          les onglets ci-dessus : import Word, choix des étiquettes et prévisualisation.
        </p>
        {owner.logo_path ? (
          <p className="mt-3 font-mono text-xs text-slate-600">{owner.logo_path}</p>
        ) : null}
      </section>
    </div>
  );
}

export default async function OwnerDetailPage({ params }: PageProps) {
  if (!isSupabaseConfigured()) {
    return <SupabaseSetupNotice />;
  }

  const { id } = await params;

  let owner: OwnerDirectoryEntry | undefined;
  let templatesPage: OwnerDocumentTemplatesPageData | null = null;
  let loadError: string | null = null;

  try {
    const [owners, page] = await Promise.all([
      getOwnerDirectory(),
      getOwnerDocumentTemplatesPage(id),
    ]);
    owner = owners.find((entry) => entry.id === id);
    templatesPage = page;
  } catch (error) {
    loadError =
      error instanceof Error ? error.message : "Impossible de charger le maître d'ouvrage.";
  }

  if (loadError) {
    return <DatabaseErrorNotice message={loadError} />;
  }

  if (!owner || !templatesPage) {
    return <DatabaseErrorNotice message="Maître d'ouvrage introuvable dans le référentiel." />;
  }

  return (
    <main className="min-h-full bg-slate-50 px-4 py-6 sm:px-6">
      <div className="mx-auto w-full max-w-6xl">
        <PcAppNav />
        <Link
          href="/pc/referentiels"
          className="text-sm font-medium text-slate-400 hover:text-slate-600"
        >
          ← Référentiels
        </Link>
        <header className="mb-6 mt-4 rounded-xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-900">{owner.name}</h1>
          <p className="mt-2 text-sm text-slate-500">
            Référentiel maître d&apos;ouvrage — informations et modèles de documents (OS, acte
            d&apos;engagement).
          </p>
        </header>

        <OwnerDocumentTemplates
          data={templatesPage}
          infos={<OwnerInfosPanel owner={owner} />}
        />
      </div>
    </main>
  );
}
