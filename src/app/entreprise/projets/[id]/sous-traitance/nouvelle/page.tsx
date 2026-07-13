import { NewSousTraitanceForm } from "@/components/entreprise/NewSousTraitanceForm";
import {
  DatabaseErrorNotice,
  SupabaseSetupNotice,
} from "@/components/SupabaseSetupNotice";
import { getEnterpriseMembership } from "@/lib/actions/enterprise-access";
import { getProject } from "@/lib/actions/projects";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function NouvelleSousTraitancePage({ params }: PageProps) {
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

    const project = await getProject(id);

    return (
      <main className="min-h-full px-6 py-8">
        <NewSousTraitanceForm
          projectId={id}
          projectName={project.name}
          enterprise={membership.enterprises}
        />
      </main>
    );
  } catch (error) {
    return (
      <DatabaseErrorNotice
        message={
          error instanceof Error
            ? error.message
            : "Impossible d'ouvrir le formulaire."
        }
      />
    );
  }
}
