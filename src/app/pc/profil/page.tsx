import { Suspense } from "react";
import { PcAppNav } from "@/components/pc/PcAppNav";
import { UserProfileSettings } from "@/components/auth/UserProfileSettings";
import {
  DatabaseErrorNotice,
  SupabaseSetupNotice,
} from "@/components/SupabaseSetupNotice";
import { getProfileSettings } from "@/lib/actions/profile";
import { getAppBaseUrl } from "@/lib/outlook/app-url";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default async function PcProfilPage() {
  if (!isSupabaseConfigured()) {
    return <SupabaseSetupNotice />;
  }

  try {
    const profile = await getProfileSettings();

    return (
      <main className="min-h-full bg-slate-50 px-6 py-8">
        <div className="mx-auto w-full max-w-2xl">
          <PcAppNav />
          <header className="mb-6 rounded-xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
            <h1 className="text-2xl font-semibold text-slate-900">Mon profil</h1>
            <p className="mt-2 text-slate-500">
              Informations personnelles, notifications et connexion Microsoft 365.
            </p>
          </header>
          <Suspense fallback={<p className="text-sm text-slate-500">Chargement…</p>}>
            <UserProfileSettings
              profile={profile}
              basePath="pc"
              outlookManifestUrl={`${getAppBaseUrl()}/api/outlook/manifest`}
            />
          </Suspense>
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
