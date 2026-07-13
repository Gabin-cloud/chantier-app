import { UserMenu } from "@/components/auth/UserMenu";
import { EntrepriseAppNav } from "@/components/entreprise/EntrepriseAppNav";
import { EnterpriseProjectList } from "@/components/entreprise/EnterpriseProjectList";
import {
  DatabaseErrorNotice,
  SupabaseSetupNotice,
} from "@/components/SupabaseSetupNotice";
import { getEnterpriseProjectAccess } from "@/lib/actions/enterprise-access";
import { getProfile } from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default async function EntrepriseHomePage() {
  if (!isSupabaseConfigured()) {
    return <SupabaseSetupNotice />;
  }

  try {
    const [accessList, profile] = await Promise.all([
      getEnterpriseProjectAccess(),
      getProfile(),
    ]);

    return (
      <main className="min-h-full px-6 py-8">
        <div className="mx-auto max-w-2xl">
          <EntrepriseAppNav />
          <div className="mb-6">
            <UserMenu
              email={profile.email}
              fullName={profile.full_name}
              basePath="entreprise"
            />
          </div>
          <EnterpriseProjectList accessList={accessList} />
        </div>
      </main>
    );
  } catch (error) {
    return (
      <DatabaseErrorNotice
        message={
          error instanceof Error
            ? error.message
            : "Impossible de charger l'espace entreprise."
        }
      />
    );
  }
}
