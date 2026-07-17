"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  getWordAddinEnterprises,
  getWordAddinLabelValues,
  type WordEnterpriseOption,
} from "@/lib/actions/word-addin";
import type { DocumentLabelDefinition } from "@/lib/documents/document-labels";
import { DOCUMENT_LABEL_CATEGORY_LABELS } from "@/lib/documents/document-labels";
import type { FinanceProjectOption } from "@/lib/actions/incoming-files";
import { useWordDocument } from "@/components/word/useWordDocument";

type WordLabelsPaneProps = {
  projects: FinanceProjectOption[];
  labels: DocumentLabelDefinition[];
};

export function WordLabelsPane({ projects, labels }: WordLabelsPaneProps) {
  const { ready, outsideWord, error, insertLabelAtSelection, fillDocumentLabels } =
    useWordDocument();
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [enterpriseId, setEnterpriseId] = useState("");
  const [enterprises, setEnterprises] = useState<WordEnterpriseOption[]>([]);
  const [status, setStatus] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!projectId) {
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const rows = await getWordAddinEnterprises(projectId);
        if (cancelled) return;
        setEnterprises(rows);
        setEnterpriseId(rows[0]?.id ?? "");
        setActionError(null);
      } catch (err) {
        if (cancelled) return;
        setEnterprises([]);
        setEnterpriseId("");
        setActionError(
          err instanceof Error ? err.message : "Impossible de charger les lots."
        );
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const labelsByCategory = useMemo(() => {
    const groups = new Map<string, DocumentLabelDefinition[]>();
    for (const item of labels) {
      const list = groups.get(item.category) ?? [];
      list.push(item);
      groups.set(item.category, list);
    }
    return Array.from(groups.entries());
  }, [labels]);

  async function handleInsert(key: string) {
    setActionError(null);
    setStatus(null);
    try {
      await insertLabelAtSelection(key);
      setStatus(`Étiquette « ${key} » insérée au curseur.`);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : "Insertion impossible dans Word."
      );
    }
  }

  function handleFillAll() {
    if (!projectId || !enterpriseId) {
      setActionError("Choisissez une opération et un lot / entreprise.");
      return;
    }

    setActionError(null);
    setStatus(null);

    startTransition(async () => {
      try {
        const values = await getWordAddinLabelValues(projectId, enterpriseId);
        await fillDocumentLabels(values);
        const count = Object.keys(values).filter((key) => values[key]?.trim()).length;
        setStatus(`${count} étiquette(s) remplie(s) dans le document.`);
      } catch (err) {
        setActionError(
          err instanceof Error ? err.message : "Remplissage impossible."
        );
      }
    });
  }

  if (outsideWord) {
    return (
      <div className="p-4 text-sm text-amber-800">
        Ce volet doit être ouvert depuis <strong>Word</strong> (bouton{" "}
        <strong>Étiquettes</strong> dans l&apos;onglet Accueil).
      </div>
    );
  }

  if (error) {
    return <div className="p-4 text-sm text-red-700">{error}</div>;
  }

  if (!ready) {
    return <div className="p-4 text-sm text-slate-500">Connexion à Word…</div>;
  }

  return (
    <div className="space-y-4 p-4">
      <header className="rounded-xl bg-slate-50 px-3 py-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Document ouvert
        </p>
        <p className="mt-1 text-sm text-slate-700">
          Cliquez sur une étiquette pour l&apos;insérer à l&apos;emplacement du curseur,
          puis remplissez tout le document depuis le chantier.
        </p>
      </header>

      {projects.length === 0 ? (
        <p className="text-sm text-amber-700">Aucune opération accessible.</p>
      ) : (
        <>
          <section>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              Opération
            </label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
            >
              {projects.map((project) => (
                <option key={project.id} value={project.id}>
                  {project.name}
                </option>
              ))}
            </select>
          </section>

          <section>
            <label className="mb-1 block text-xs font-semibold text-slate-600">
              Lot / entreprise
            </label>
            <select
              value={enterpriseId}
              onChange={(e) => setEnterpriseId(e.target.value)}
              disabled={enterprises.length === 0 || isPending}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm disabled:opacity-50"
            >
              {enterprises.length === 0 ? (
                <option value="">Aucun lot sur cette opération</option>
              ) : (
                enterprises.map((enterprise) => (
                  <option key={enterprise.id} value={enterprise.id}>
                    {enterprise.lot_number ? `Lot ${enterprise.lot_number} — ` : ""}
                    {enterprise.name}
                  </option>
                ))
              )}
            </select>
          </section>

          <button
            type="button"
            onClick={handleFillAll}
            disabled={isPending || !enterpriseId}
            className="w-full rounded-lg bg-slate-900 px-3 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-40"
          >
            {isPending ? "Remplissage…" : "Remplir tout le document"}
          </button>
        </>
      )}

      <section>
        <p className="mb-2 text-sm font-semibold text-slate-700">Étiquettes</p>
        <div className="max-h-[22rem] space-y-4 overflow-y-auto pr-1">
          {labelsByCategory.map(([category, items]) => (
            <div key={category}>
              <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                {DOCUMENT_LABEL_CATEGORY_LABELS[category] ?? category}
              </p>
              <div className="flex flex-wrap gap-2">
                {items.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    disabled={isPending}
                    onClick={() => handleInsert(item.key)}
                    className="rounded-full bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-800 hover:bg-violet-100 disabled:opacity-40"
                    title={`${item.description} — ex. ${item.example}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {actionError ? (
        <p className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{actionError}</p>
      ) : null}
      {status ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{status}</p>
      ) : null}
    </div>
  );
}
