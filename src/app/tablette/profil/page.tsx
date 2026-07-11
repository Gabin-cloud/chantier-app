import { Suspense } from "react";
import Link from "next/link";
import { UserProfileSettings } from "@/components/auth/UserProfileSettings";
import {
  DatabaseErrorNotice,
  SupabaseSetupNotice,
} from "@/components/SupabaseSetupNotice";
import { getProfileSettings } from "@/lib/actions/profile";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default async function TabletteProfilPage() {
  if (!isSupabaseConfigured()) {
    return <SupabaseSetupNotice />;
  }

  try {
    const profile = await getProfileSettings();

    return (
      <main className="min-h-full bg-zinc-100 px-4 py-6 sm:px-6">
        <div className="mx-auto w-full max-w-2xl">
          <Link
            href="/tablette"
            className="text-sm font-medium text-zinc-500 hover:text-zinc-700"
          >
            ← Retour
          </Link>
          <header className="mb-6 mt-4 rounded-xl border border-zinc-200 bg-white px-6 py-5 shadow-sm">
            <h1 className="text-2xl font-semibold text-zinc-900">Mon profil</h1>
            <p className="mt-2 text-zinc-500">
              Informations personnelles, notifications et connexion Microsoft 365.
            </p>
          </header>
          <Suspense fallback={<p className="text-sm text-zinc-500">Chargement…</p>}>
            <UserProfileSettings profile={profile} basePath="tablette" />
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
