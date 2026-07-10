import Link from "next/link";
import { CreateProjectForm } from "@/components/projects/CreateProjectForm";
import { SupabaseSetupNotice } from "@/components/SupabaseSetupNotice";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default function NouveauProjetPcPage() {
  if (!isSupabaseConfigured()) {
    return <SupabaseSetupNotice />;
  }

  return (
    <main className="min-h-full bg-slate-50 px-6 py-8">
      <div className="mx-auto w-full max-w-2xl">
        <Link
          href="/pc"
          className="text-sm font-medium text-slate-400 hover:text-slate-600"
        >
          ← Mes projets
        </Link>
        <header className="mb-6 mt-4 rounded-xl border border-slate-200 bg-white px-6 py-5 shadow-sm">
          <h1 className="text-2xl font-semibold text-slate-900">Nouveau projet</h1>
          <p className="mt-2 text-slate-500">
            Le projet sera visible sur tablette et PC.
          </p>
        </header>
        <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <CreateProjectForm basePath="pc" />
        </div>
      </div>
    </main>
  );
}
