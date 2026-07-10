import Link from "next/link";
import { SecurityChecklist } from "@/components/tablette/SecurityChecklist";

export default function ChecklistPage() {
  return (
    <main className="min-h-full bg-zinc-100 px-4 py-6 sm:px-6">
      <div className="mx-auto mb-4 w-full max-w-2xl">
        <Link
          href="/tablette"
          className="text-sm font-medium text-zinc-400 hover:text-zinc-600"
        >
          ← Mes projets
        </Link>
      </div>
      <SecurityChecklist />
    </main>
  );
}
