import Link from "next/link";

export default function Home() {
  return (
    <main className="flex min-h-full flex-col items-center justify-center gap-6 bg-zinc-100 px-6 py-12">
      <h1 className="text-2xl font-semibold text-zinc-900">
        Application de contrôle de chantier
      </h1>
      <p className="text-zinc-600">Choisissez une interface :</p>
      <div className="flex flex-col gap-4 sm:flex-row">
        <Link
          href="/pc"
          className="rounded-lg bg-slate-800 px-6 py-3 text-center font-medium text-white hover:bg-slate-700"
        >
          Interface PC
        </Link>
        <Link
          href="/tablette"
          className="rounded-lg bg-emerald-600 px-6 py-3 text-center font-medium text-white hover:bg-emerald-500"
        >
          Interface Tablette
        </Link>
      </div>
    </main>
  );
}
