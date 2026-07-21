import type { ReactNode } from "react";
import { NavTabs, type NavTabItem } from "@/components/pc/NavTabs";
import { OperationBanner } from "@/components/pc/OperationBanner";
import {
  DatabaseErrorNotice,
  SupabaseSetupNotice,
} from "@/components/SupabaseSetupNotice";
import { getFavoriteProjects } from "@/lib/actions/favorites";
import { getFinancialFileUrl } from "@/lib/actions/finance";
import { getProject } from "@/lib/actions/projects";
import { storagePublicUrl } from "@/lib/print/table-export";
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
    const [project, favorites] = await Promise.all([
      getProject(id),
      getFavoriteProjects(),
    ]);
    const base = `/pc/projets/${id}`;

    const operationPhotoUrl = project.operation_photo_path
      ? await getFinancialFileUrl(id, project.operation_photo_path).catch(() => null)
      : storagePublicUrl(project.operation_photo_path);
    const ownerLogoUrl = storagePublicUrl(project.owner_logo_path);

    const tabs: NavTabItem[] = [
      { href: `${base}/tableau-de-bord`, label: "Tableau de bord" },
      { href: `${base}/marche`, label: "Marché / Administratif" },
      { href: `${base}/suivi-financier`, label: "Suivi financier" },
      { href: `${base}/suivi-travaux`, label: "Suivi des travaux" },
    ];

    return (
      <div className="min-h-full bg-slate-50">
        <OperationBanner
          project={project}
          favorites={favorites}
          operationPhotoUrl={operationPhotoUrl}
          ownerLogoUrl={ownerLogoUrl}
          parametresHref={`${base}/parametres`}
        />

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
