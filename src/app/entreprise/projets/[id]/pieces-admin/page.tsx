import { EntrepriseAdminPiecesPanel } from "@/components/entreprise/EntrepriseAdminPiecesPanel";
import { DatabaseErrorNotice } from "@/components/SupabaseSetupNotice";
import { getEnterpriseAdminControlData } from "@/lib/actions/admin-pieces";
import { requireUser } from "@/lib/auth/permissions";
import { getProject } from "@/lib/actions/projects";
import { createClient } from "@/lib/supabase/server";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function EntreprisePiecesAdminPage({ params }: PageProps) {
  const { id } = await params;
  const user = await requireUser();
  const supabase = await createClient();

  const { data: membership } = await supabase
    .from("project_members")
    .select("enterprise_id, role")
    .eq("project_id", id)
    .eq("user_id", user.id)
    .maybeSingle();

  if (membership?.role !== "entreprise" || !membership.enterprise_id) {
    return <DatabaseErrorNotice message="Accès réservé aux entreprises invitées." />;
  }

  try {
    const [project, controlData] = await Promise.all([
      getProject(id),
      getEnterpriseAdminControlData(id, membership.enterprise_id),
    ]);

    return (
      <main className="min-h-full bg-amber-50/40 px-4 py-6">
        <EntrepriseAdminPiecesPanel project={project} controlData={controlData} />
      </main>
    );
  } catch (error) {
    return (
      <DatabaseErrorNotice
        message={
          error instanceof Error
            ? error.message
            : "Impossible de charger les pièces administratives."
        }
      />
    );
  }
}
