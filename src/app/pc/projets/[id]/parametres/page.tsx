import Link from "next/link";
import { ProjectSettings } from "@/components/projects/ProjectSettings";
import {
  DatabaseErrorNotice,
  SupabaseSetupNotice,
} from "@/components/SupabaseSetupNotice";
import {
  canAccessField,
  canEditProject,
  canManageMembers,
  getProjectRole,
} from "@/lib/auth/permissions";
import { getProjectMembers } from "@/lib/actions/members";
import { getProjectLocations } from "@/lib/actions/locations";
import { getPlansWithUrls } from "@/lib/actions/plans";
import { getProject } from "@/lib/actions/projects";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type PageProps = {
  params: Promise<{ id: string }>;
};

export default async function PcParametresPage({ params }: PageProps) {
  if (!isSupabaseConfigured()) {
    return <SupabaseSetupNotice />;
  }

  const { id } = await params;

  try {
    const [project, plans, members, locations, projectRole] = await Promise.all([
      getProject(id),
      getPlansWithUrls(id),
      getProjectMembers(id),
      getProjectLocations(id).catch(() => []),
      getProjectRole(id),
    ]);

    if (!projectRole) {
      return <DatabaseErrorNotice message="Accès refusé à ce projet." />;
    }

    const canEdit = canEditProject(projectRole);
    const canManage = canManageMembers(projectRole);
    const canPlans = canAccessField(projectRole);

    if (!canEdit && !canManage && !canPlans) {
      return (
        <DatabaseErrorNotice message="Droits insuffisants pour accéder aux paramètres." />
      );
    }

    return (
      <main className="min-h-full bg-slate-50 px-6 py-8">
        <div className="mx-auto w-full max-w-2xl">
          <Link
            href={`/pc/projets/${id}`}
            className="text-sm font-medium text-slate-400 hover:text-slate-600"
          >
            ← Retour au projet
          </Link>
          <header className="mb-6 mt-4 rounded-xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
            <h1 className="text-2xl font-semibold text-slate-900">Paramètres</h1>
            <p className="mt-2 text-slate-500">{project.name}</p>
          </header>
          <ProjectSettings
            project={project}
            enterprises={project.enterprises}
            plans={plans}
            locations={locations}
            members={members}
            basePath="pc"
            canEdit={canEdit}
            canManageMembers={canManage}
            canEditPlans={canPlans}
          />
        </div>
      </main>
    );
  } catch (error) {
    return (
      <DatabaseErrorNotice
        message={
          error instanceof Error ? error.message : "Projet introuvable."
        }
      />
    );
  }
}
