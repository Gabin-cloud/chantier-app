import { PcAppNav } from "@/components/pc/PcAppNav";
import { PcGlobalSettings } from "@/components/settings/PcGlobalSettings";
import {
  DatabaseErrorNotice,
  SupabaseSetupNotice,
} from "@/components/SupabaseSetupNotice";
import { getEmailTemplatesSettings } from "@/lib/actions/email-templates";
import { getProjects } from "@/lib/actions/projects";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default async function PcParametresPage() {
  if (!isSupabaseConfigured()) {
    return <SupabaseSetupNotice />;
  }

  try {
    const [settings, projects] = await Promise.all([
      getEmailTemplatesSettings(),
      getProjects(),
    ]);

    return (
      <main className="min-h-full bg-slate-50 px-6 py-8">
        <div className="mx-auto w-full max-w-5xl">
          <PcAppNav />
          <header className="mb-6 rounded-xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
            <h1 className="text-2xl font-semibold text-slate-900">Paramètres généraux</h1>
            <p className="mt-2 text-slate-500">
              Mails type, invitations et configuration avancée des opérations.
            </p>
          </header>
          <PcGlobalSettings emailSettings={settings} projects={projects} />
        </div>
      </main>
    );
  } catch (error) {
    return (
      <DatabaseErrorNotice
        message={
          error instanceof Error
            ? error.message
            : "Impossible de charger les paramètres."
        }
      />
    );
  }
}
