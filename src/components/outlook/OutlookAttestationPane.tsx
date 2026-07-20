"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import {
  getOpenNcExecutionsForOutlook,
  uploadWorkControlAttestation,
} from "@/lib/actions/work-control";
import { useOutlookMailItem } from "@/components/outlook/useOutlookMailItem";
import type { FinanceProjectOption } from "@/lib/actions/incoming-files";

type OutlookAttestationPaneProps = {
  projects: FinanceProjectOption[];
};

type OpenNcRow = Awaited<ReturnType<typeof getOpenNcExecutionsForOutlook>>[number];

function rowKey(r: OpenNcRow) {
  return `${r.checklistItemId}::${r.planLevelId}`;
}

export function OutlookAttestationPane({ projects }: OutlookAttestationPaneProps) {
  const { ready, outsideOutlook, mail, error, loadAttachmentFile } =
    useOutlookMailItem();
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [rows, setRows] = useState<OpenNcRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [enterpriseFilter, setEnterpriseFilter] = useState("");
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [selectedAttachmentId, setSelectedAttachmentId] = useState<string | null>(
    null
  );
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const enterprises = useMemo(() => {
    const map = new Map<string, string>();
    for (const r of rows) {
      if (r.enterpriseId && r.enterpriseName) {
        map.set(r.enterpriseId, r.enterpriseName);
      }
    }
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1], "fr"));
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (!enterpriseFilter) return rows;
    return rows.filter((r) => r.enterpriseId === enterpriseFilter);
  }, [rows, enterpriseFilter]);

  useEffect(() => {
    if (!projectId) return;
    setLoadingRows(true);
    setMessage(null);
    setLoadError(null);
    setSelectedKeys([]);
    setEnterpriseFilter("");
    getOpenNcExecutionsForOutlook(projectId)
      .then(setRows)
      .catch((err) =>
        setLoadError(err instanceof Error ? err.message : "Erreur chargement.")
      )
      .finally(() => setLoadingRows(false));
  }, [projectId]);

  function toggleKey(key: string) {
    setSelectedKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  async function handleClassify() {
    if (!selectedAttachmentId || selectedKeys.length === 0) {
      setMessage("Choisissez un PDF et au moins un point NC.");
      return;
    }

    setMessage(null);
    startTransition(async () => {
      try {
        const file = await loadAttachmentFile(selectedAttachmentId);
        let done = 0;
        for (const key of selectedKeys) {
          const [checklistItemId, planLevelId] = key.split("::");
          if (!checklistItemId || !planLevelId) continue;
          const formData = new FormData();
          formData.set("file", file);
            await uploadWorkControlAttestation(
              projectId,
              checklistItemId,
              planLevelId,
              formData,
              { skipRevalidate: true }
            );
          done++;
        }
        setMessage(
          `${done} point(s) levé(s) avec « ${file.name} » (Levée point de contrôle).`
        );
        setRows(await getOpenNcExecutionsForOutlook(projectId));
        setSelectedKeys([]);
      } catch (err) {
        setMessage(err instanceof Error ? err.message : "Erreur.");
      }
    });
  }

  if (outsideOutlook) {
    return (
      <div className="p-4 text-sm text-amber-800">
        Ouvrez ce volet depuis Outlook sur un mail contenant l&apos;attestation PDF.
      </div>
    );
  }

  if (!ready) {
    return <div className="p-4 text-sm text-slate-500">Connexion à Outlook…</div>;
  }

  if (error) return <div className="p-4 text-sm text-red-700">{error}</div>;
  if (!mail) {
    return <div className="p-4 text-sm text-slate-500">Aucun mail détecté.</div>;
  }

  const pdfAttachments = (mail.attachments ?? []).filter(
    (a) =>
      a.name.toLowerCase().endsWith(".pdf") ||
      (a.contentType ?? "").includes("pdf")
  );

  return (
    <div className="space-y-3 p-4">
      <header className="rounded-xl bg-teal-50 px-3 py-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-teal-700">
          Levée point de contrôle
        </p>
        <p className="mt-1 text-sm font-medium text-slate-900 line-clamp-2">
          {mail.subject || "(sans objet)"}
        </p>
        <p className="mt-0.5 text-xs text-slate-500">
          Sélectionnez un ou plusieurs points NC de l&apos;entreprise, puis déposez
          l&apos;attestation PDF.
        </p>
      </header>

      <label className="block text-xs font-semibold text-slate-700">
        Opération
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
        >
          {projects.length === 0 && <option value="">Aucun projet</option>}
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-xs font-semibold text-slate-700">
        Entreprise (filtre)
        <select
          value={enterpriseFilter}
          onChange={(e) => {
            setEnterpriseFilter(e.target.value);
            setSelectedKeys([]);
          }}
          className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
        >
          <option value="">Toutes</option>
          {enterprises.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
      </label>

      <div>
        <p className="mb-1 text-xs font-semibold text-slate-700">Pièce jointe PDF</p>
        <ul className="max-h-28 space-y-1 overflow-y-auto">
          {pdfAttachments.map((att) => (
            <li key={att.id}>
              <button
                type="button"
                onClick={() => setSelectedAttachmentId(att.id)}
                className={`w-full rounded-lg px-2 py-1.5 text-left text-xs ${
                  selectedAttachmentId === att.id
                    ? "bg-teal-100 font-semibold text-teal-900"
                    : "bg-slate-50 text-slate-700"
                }`}
              >
                {att.name}
              </button>
            </li>
          ))}
        </ul>
        {pdfAttachments.length === 0 && (
          <p className="text-xs text-slate-500">Aucun PDF en pièce jointe.</p>
        )}
      </div>

      <div>
        <div className="mb-1 flex items-center justify-between gap-2">
          <p className="text-xs font-semibold text-slate-700">
            Points NC à lever ({filteredRows.length})
          </p>
          {filteredRows.length > 0 && (
            <button
              type="button"
              onClick={() =>
                setSelectedKeys(
                  selectedKeys.length === filteredRows.length
                    ? []
                    : filteredRows.map(rowKey)
                )
              }
              className="text-[10px] font-semibold text-teal-700 hover:underline"
            >
              {selectedKeys.length === filteredRows.length
                ? "Tout désélectionner"
                : "Tout sélectionner"}
            </button>
          )}
        </div>
        {loadingRows ? (
          <p className="text-xs text-slate-500">Chargement…</p>
        ) : filteredRows.length === 0 ? (
          <p className="text-xs text-emerald-700">
            Aucune non-conformité ouverte
            {enterpriseFilter ? " pour cette entreprise" : ""}.
          </p>
        ) : (
          <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-slate-200 p-1">
            {filteredRows.map((r) => {
              const key = rowKey(r);
              const checked = selectedKeys.includes(key);
              return (
                <li key={key}>
                  <label
                    className={`flex cursor-pointer items-start gap-2 rounded-lg px-2 py-1.5 text-xs ${
                      checked ? "bg-teal-50" : "hover:bg-slate-50"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleKey(key)}
                      className="mt-0.5"
                    />
                    <span>
                      <span className="font-semibold text-slate-900">{r.itemLabel}</span>
                      <span className="block text-[10px] text-slate-500">
                        {r.planName} / {r.levelName}
                        {r.enterpriseName ? ` · ${r.enterpriseName}` : ""}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      <button
        type="button"
        disabled={isPending || !selectedAttachmentId || selectedKeys.length === 0}
        onClick={handleClassify}
        className="w-full rounded-xl bg-teal-600 py-2.5 text-sm font-bold text-white disabled:opacity-40"
      >
        {isPending
          ? "Dépôt…"
          : `Déposer et lever (${selectedKeys.length})`}
      </button>

      {(message || loadError) && (
        <p className="text-xs text-slate-700">{message ?? loadError}</p>
      )}
    </div>
  );
}
