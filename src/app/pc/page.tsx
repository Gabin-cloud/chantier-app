import { UserMenu } from "@/components/auth/UserMenu";
import { PcAppNav } from "@/components/pc/PcAppNav";
import { PcHomeBrowser } from "@/components/pc/PcHomeBrowser";
import {
  DatabaseErrorNotice,
  SupabaseSetupNotice,
} from "@/components/SupabaseSetupNotice";
import { getFavoriteProjectIds } from "@/lib/actions/favorites";
import { getProjects } from "@/lib/actions/projects";
import { getProfile } from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default async function PcHomePage() {
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
    <main className="min-h-full bg-slate-50 px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-6xl">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <PcAppNav className="" />
          <div className="sm:min-w-[260px] sm:max-w-sm sm:flex-1">
            <UserMenu
              email={profile.email}
              fullName={profile.full_name}
              basePath="pc"
            />
          </div>
        </div>
        <PcHomeBrowser projects={projects} favoriteIds={favoriteIds} />
      </div>
    </main>
  );
}
