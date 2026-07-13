import { SousTraitanceListPanel } from "@/components/entreprise/SousTraitanceListPanel";
import {
  DatabaseErrorNotice,
  SupabaseSetupNotice,
} from "@/components/SupabaseSetupNotice";
import { getEnterpriseMembership } from "@/lib/actions/enterprise-access";
import { getSousTraitanceRequests } from "@/lib/actions/sous-traitance";
import { getProject } from "@/lib/actions/projects";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EntrepriseSousTraitancePage({ params }: PageProps) {
  if (!isSupabaseConfigured()) {
    return <SupabaseSetupNotice />;
  }

  const { id } = await params;

  try {
    const membership = await getEnterpriseMembership(id);
    if (!membership) {
      return (
        <DatabaseErrorNotice message="Accès refusé — aucun accès entreprise sur ce chantier." />
      );
    }

    const [project, requests] = await Promise.all([
      getProject(id),
      getSousTraitanceRequests(id, membership.enterprise_id),
    ]);

    return (
      <main className="min-h-full px-6 py-8">
        <SousTraitanceListPanel
          projectId={id}
          projectName={project.name}
          requests={requests}
        />
      </main>
    );
  } catch (error) {
    return (
      <DatabaseErrorNotice
        message={
          error instanceof Error
            ? error.message
            : "Impossible de charger les demandes de sous-traitance."
        }
      />
    );
  }
}
