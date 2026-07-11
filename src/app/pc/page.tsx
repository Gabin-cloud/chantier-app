import { UserMenu } from "@/components/auth/UserMenu";
import { ProjectList } from "@/components/projects/ProjectList";
import {
  DatabaseErrorNotice,
  SupabaseSetupNotice,
} from "@/components/SupabaseSetupNotice";
import { getProfile } from "@/lib/auth/permissions";
import { getProjects } from "@/lib/actions/projects";
import { isSupabaseConfigured } from "@/lib/supabase/config";
export default async function PcHomePage() {
  if (!isSupabaseConfigured()) {
    return <SupabaseSetupNotice />;
  }

  try {
    const [projects, profile] = await Promise.all([getProjects(), getProfile()]);

    return (
      <main className="min-h-full bg-slate-50 px-6 py-8">
        <div className="mx-auto mb-6 max-w-2xl">
          <UserMenu
            email={profile.email}
            fullName={profile.full_name}
            basePath="pc"
          />
        </div>
        <ProjectList projects={projects} basePath="pc" />
      </main>
    );
  } catch (error) {
    return (
      <DatabaseErrorNotice
        message={
          error instanceof Error ? error.message : "Impossible de charger les projets."
        }
      />
    );
  }
}
