import Link from "next/link";

/**
 * Page d'accueil pour visiteurs non connectés.
 * Les utilisateurs authentifiés sont redirigés par le middleware
 * (DANOBAT → /pc ou /tablette, entreprise → /entreprise).
 */
export default function Home() {
  return (
    <main className="flex min-h-full flex-col items-center justify-center gap-6 bg-zinc-100 px-6 py-12">
      <h1 className="text-2xl font-semibold text-zinc-900">
        Application de contrôle de chantier
      </h1>
      <p className="max-w-md text-center text-zinc-600">
        Sur ordinateur, un compte DANOBAT ouvre l&apos;interface PC. Les comptes
        entreprise restent sur le portail entreprise.
      </p>
      <Link
        href="/login?redirect=/pc"
        className="rounded-lg bg-slate-800 px-6 py-3 text-center font-medium text-white hover:bg-slate-700"
      >
        Se connecter — Interface PC
      </Link>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
        <Link
          href="/login?redirect=/tablette"
          className="rounded-lg bg-white px-5 py-2.5 text-center text-sm font-medium text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-50"
        >
          Connexion tablette
        </Link>
        <Link
          href="/login?redirect=/entreprise"
          className="rounded-lg bg-white px-5 py-2.5 text-center text-sm font-medium text-amber-700 ring-1 ring-amber-200 hover:bg-amber-50"
        >
          Connexion entreprise
        </Link>
      </div>
    </main>
  );
}
