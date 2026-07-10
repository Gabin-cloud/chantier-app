export function SupabaseSetupNotice() {
  return (
    <main className="flex min-h-full items-center justify-center bg-zinc-100 px-6 py-12">
      <div className="max-w-lg rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="text-xl font-bold text-zinc-900">
          Configuration Supabase requise
        </h1>
        <p className="mt-3 text-zinc-600">
          Créez un fichier <code className="rounded bg-zinc-100 px-1">.env.local</code>{" "}
          à la racine du projet avec vos identifiants Supabase :
        </p>
        <pre className="mt-4 overflow-x-auto rounded-xl bg-zinc-900 p-4 text-sm text-zinc-100">
{`NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=votre_cle_anon`}
        </pre>
        <p className="mt-4 text-sm text-zinc-500">
          Puis exécutez les scripts SQL dans{" "}
          <code className="rounded bg-zinc-100 px-1">supabase/migrations/</code>
          (001 puis 002 pour les plans et visites, 003 pour le suivi financier).
        </p>
      </div>
    </main>
  );
}

export function DatabaseErrorNotice({ message }: { message: string }) {
  return (
    <main className="flex min-h-full items-center justify-center bg-zinc-100 px-6 py-12">
      <div className="max-w-lg rounded-2xl bg-white p-8 shadow-sm">
        <h1 className="text-xl font-bold text-red-700">Erreur base de données</h1>
        <p className="mt-3 text-zinc-600">{message}</p>
        <p className="mt-4 text-sm text-zinc-500">
          Vérifiez que les tables ont bien été créées dans Supabase (script SQL
          fourni).
        </p>
      </div>
    </main>
  );
}
