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
        Connectez-vous : votre compte DANOBAT ouvre l&apos;interface PC ou tablette ;
        un compte entreprise ouvre directement le portail entreprise.
      </p>
      <Link
        href="/login"
        className="rounded-lg bg-slate-800 px-6 py-3 text-center font-medium text-white hover:bg-slate-700"
      >
        Se connecter
      </Link>
      <p className="text-sm text-zinc-400">Accès rapide (compte DANOBAT) :</p>
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center">
        <Link
          href="/pc"
          className="rounded-lg bg-white px-5 py-2.5 text-center text-sm font-medium text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
        >
          Interface PC
        </Link>
        <Link
          href="/tablette"
          className="rounded-lg bg-white px-5 py-2.5 text-center text-sm font-medium text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-50"
        >
          Interface Tablette
        </Link>
      </div>
    </main>
  );
}
