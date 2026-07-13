import { UserMenu } from "@/components/auth/UserMenu";
import { EntrepriseAppNav } from "@/components/entreprise/EntrepriseAppNav";
import {
  DatabaseErrorNotice,
  SupabaseSetupNotice,
} from "@/components/SupabaseSetupNotice";
import { UserProfileSettings } from "@/components/auth/UserProfileSettings";
import { getProfile } from "@/lib/auth/permissions";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default async function EntrepriseProfilPage() {
  if (!isSupabaseConfigured()) {
    return <SupabaseSetupNotice />;
  }

  try {
    const profile = await getProfile();

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
          <header className="mb-6">
            <h1 className="text-2xl font-bold text-zinc-900">Profil entreprise</h1>
            <p className="mt-2 text-zinc-500">
              Coordonnées du contact et informations de connexion.
            </p>
          </header>
          <UserProfileSettings profile={profile} basePath="entreprise" />
        </div>
      </main>
    );
  } catch (error) {
    return (
      <DatabaseErrorNotice
        message={
          error instanceof Error ? error.message : "Impossible de charger le profil."
        }
      />
    );
  }
}
