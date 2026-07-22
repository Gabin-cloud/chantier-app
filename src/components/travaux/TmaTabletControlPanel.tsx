"use client";

import { useMemo, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { updateTmaControleChantier } from "@/lib/actions/tma";
import { formatCurrency } from "@/lib/finance/calculations";
import type { WorkTmaEntry } from "@/lib/types/database";

type TmaTabletControlPanelProps = {
  projectId: string;
  projectName: string;
  entries: WorkTmaEntry[];
};

function formatDate(value: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("fr-FR");
}

export function TmaTabletControlPanel({
  projectId,
  projectName,
  entries,
}: TmaTabletControlPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const controlEntries = useMemo(
    () =>
      entries.filter(
        (entry) =>
          entry.status !== "to_analyze" &&
          entry.quote_validation_status === "yes"
      ),
    [entries]
  );

  const pendingControl = controlEntries.filter((entry) => !entry.controle_chantier);
  const controlled = controlEntries.filter((entry) => Boolean(entry.controle_chantier));

  function markControlled(entryId: string) {
    const today = new Date().toISOString().slice(0, 10);
    startTransition(async () => {
      await updateTmaControleChantier(projectId, entryId, today);
      router.refresh();
    });
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-4">
      <header className="rounded-2xl bg-white px-5 py-4 shadow-sm">
        <Link
          href={`/tablette/projets/${projectId}`}
          className="text-sm font-medium text-zinc-400 hover:text-zinc-600"
        >
          ← {projectName}
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-zinc-900">Contrôle TMA chantier</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Vérifiez les TMA acceptées par le MOU et validez le contrôle sur le terrain.
        </p>
      </header>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-amber-900">
          À contrôler ({pendingControl.length})
        </h2>
        {pendingControl.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">Aucune TMA en attente de contrôle.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {pendingControl.map((entry) => (
              <li
                key={entry.id}
                className="rounded-xl border border-amber-200 bg-amber-50 p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-zinc-900">
                      Logt {entry.logement_number || "—"} — {entry.enterprise_name}
                    </p>
                    <p className="mt-1 text-sm text-zinc-600">{entry.nature_travaux}</p>
                    <p className="mt-1 text-xs text-zinc-500">
                      Devis {entry.devis_number || "—"} · Retour MOU{" "}
                      {formatDate(entry.mou_acceptation)} · {formatCurrency(entry.montant_ht)} H.T.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => markControlled(entry.id)}
                    disabled={isPending}
                    className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
                  >
                    Contrôlé aujourd&apos;hui
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-emerald-900">
          Déjà contrôlées ({controlled.length})
        </h2>
        {controlled.length === 0 ? (
          <p className="mt-3 text-sm text-zinc-500">Aucun contrôle enregistré.</p>
        ) : (
          <ul className="mt-4 divide-y divide-zinc-100">
            {controlled.map((entry) => (
              <li key={entry.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                <div>
                  <p className="font-medium text-zinc-900">
                    Logt {entry.logement_number || "—"} — {entry.localisation}
                  </p>
                  <p className="text-sm text-zinc-500">{entry.nature_travaux}</p>
                </div>
                <p className="text-sm font-semibold text-emerald-700">
                  {formatDate(entry.controle_chantier)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
