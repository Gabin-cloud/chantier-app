import type { ReactNode } from "react";
import Link from "next/link";
import { NavTabs, type NavTabItem } from "@/components/pc/NavTabs";
import {
  DatabaseErrorNotice,
  SupabaseSetupNotice,
} from "@/components/SupabaseSetupNotice";
import { getProject } from "@/lib/actions/projects";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type OperationLayoutProps = {
  children: ReactNode;
  params: Promise<{ id: string }>;
};

export default async function OperationLayout({
  children,
  params,
}: OperationLayoutProps) {
  if (!isSupabaseConfigured()) {
    return <SupabaseSetupNotice />;
  }

  const { id } = await params;

  try {
    const project = await getProject(id);
    const base = `/pc/projets/${id}`;

    const tabs: NavTabItem[] = [
      { href: `${base}/tableau-de-bord`, label: "Tableau de bord" },
      { href: `${base}/marche`, label: "Marché / Administratif" },
      { href: `${base}/suivi-financier`, label: "Suivi financier" },
      { href: `${base}/suivi-travaux`, label: "Suivi des travaux" },
    ];

    return (
      <div className="min-h-full bg-slate-50">
        {/* Bandeau fin : chantier + maître d'œuvre + Dossier d'opération */}
        <div className="border-b border-slate-200 bg-white">
          <div className="mx-auto flex w-full max-w-[110rem] items-center gap-4 px-4 py-1.5">
            <Link
              href="/pc"
              className="shrink-0 text-xs text-slate-400 hover:text-slate-700"
            >
              ←
            </Link>
            <div className="flex min-w-0 flex-1 items-baseline gap-3">
              <span className="truncate text-sm font-semibold text-slate-900">
                {project.name}
              </span>
              <span className="hidden truncate text-xs text-slate-500 sm:inline">
                Maître d&apos;œuvre&nbsp;: —
              </span>
            </div>
            <Link
              href={`${base}/dossier`}
              className="shrink-0 rounded-md border border-slate-300 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Dossier d&apos;opération
            </Link>
          </div>
        </div>

        {/* Onglets niveau 1 */}
        <div className="border-b border-slate-200 bg-white">
          <div className="mx-auto w-full max-w-[110rem] px-4">
            <NavTabs items={tabs} variant="primary" />
          </div>
        </div>

        <div className="mx-auto w-full max-w-[110rem] px-4 py-4">{children}</div>
      </div>
    );
  } catch (error) {
    return (
      <DatabaseErrorNotice
        message={error instanceof Error ? error.message : "Projet introuvable."}
      />
    );
  }
}
