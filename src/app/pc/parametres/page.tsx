import { PcAppNav } from "@/components/pc/PcAppNav";
import { EmailTemplatesSettings } from "@/components/settings/EmailTemplatesSettings";
import {
  DatabaseErrorNotice,
  SupabaseSetupNotice,
} from "@/components/SupabaseSetupNotice";
import { getEmailTemplatesSettings } from "@/lib/actions/email-templates";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default async function PcParametresPage() {
  if (!isSupabaseConfigured()) {
    return <SupabaseSetupNotice />;
  }

  try {
    const settings = await getEmailTemplatesSettings();

    return (
      <main className="min-h-full bg-slate-50 px-6 py-8">
        <div className="mx-auto w-full max-w-5xl">
          <PcAppNav />
        <header className="mb-6 rounded-xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-900">Paramètres</h1>
          <p className="mt-2 text-slate-500">
            Mails type et étiquettes dynamiques pour les brouillons Outlook.
          </p>
        </header>
        <EmailTemplatesSettings data={settings} />
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
