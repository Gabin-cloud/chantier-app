import { UserMenu } from "@/components/auth/UserMenu";
import { ProjectList } from "@/components/projects/ProjectList";
import {
  DatabaseErrorNotice,
  SupabaseSetupNotice,
} from "@/components/SupabaseSetupNotice";
import { getFavoriteProjectIds } from "@/lib/actions/favorites";
import { getProjects } from "@/lib/actions/projects";
import { getProfile } from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default async function TabletteHomePage() {
  if (!isSupabaseConfigured()) {
    return <SupabaseSetupNotice />;
  }

  let projects;
  let profile;
  let favoriteIds: string[];

  try {
    [projects, profile, favoriteIds] = await Promise.all([
      getProjects(),
      getProfile(),
      getFavoriteProjectIds(),
    ]);
  } catch (error) {
    return (
      <DatabaseErrorNotice
        message={
          error instanceof Error ? error.message : "Impossible de charger les projets."
        }
      />
    );
  }

  return (
    <main className="tablette-page px-4 py-5 sm:px-6">
      <div className="mx-auto mb-5 max-w-2xl">
        <UserMenu
          email={profile.email}
          fullName={profile.full_name}
          basePath="tablette"
        />
      </div>
      <ProjectList
        projects={projects}
        basePath="tablette"
        favoriteIds={favoriteIds}
      />
    </main>
  );
}
