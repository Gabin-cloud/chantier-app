import { UserMenu } from "@/components/auth/UserMenu";
import { ProjectList } from "@/components/projects/ProjectList";
import {
  DatabaseErrorNotice,
  SupabaseSetupNotice,
} from "@/components/SupabaseSetupNotice";
import { getProfile } from "@/lib/auth/permissions";
import { getProjects } from "@/lib/actions/projects";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default async function TabletteHomePage() {
  if (!isSupabaseConfigured()) {
    return <SupabaseSetupNotice />;
  }

  try {
    const [projects, profile] = await Promise.all([getProjects(), getProfile()]);

    return (
      <main className="tablette-page px-4 py-5 sm:px-6">
        <div className="mx-auto mb-5 max-w-2xl">
          <UserMenu
            email={profile.email}
            fullName={profile.full_name}
            basePath="tablette"
          />
        </div>
        <ProjectList projects={projects} basePath="tablette" />
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
