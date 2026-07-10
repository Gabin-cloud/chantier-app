import { AuthForm } from "@/components/auth/AuthForm";
import { SupabaseSetupNotice } from "@/components/SupabaseSetupNotice";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type LoginPageProps = {
  searchParams: Promise<{ redirect?: string }>;
};

export default async function LoginPage({ searchParams }: LoginPageProps) {
  if (!isSupabaseConfigured()) {
    return <SupabaseSetupNotice />;
  }

  const params = await searchParams;
  const redirectTo = params.redirect ?? "/";

  return (
    <main className="flex min-h-full items-center justify-center bg-zinc-100 px-4 py-12">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-zinc-900">Contrôle de chantier</h1>
        <p className="mt-2 text-zinc-500">
          Connectez-vous pour accéder à vos projets.
        </p>
        <div className="mt-8">
          <AuthForm redirectTo={redirectTo} />
        </div>
      </div>
    </main>
  );
}
