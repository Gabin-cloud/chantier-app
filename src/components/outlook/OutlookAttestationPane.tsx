"use client";

import { useEffect, useState, useTransition } from "react";
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

export function OutlookAttestationPane({ projects }: OutlookAttestationPaneProps) {
  const { ready, outsideOutlook, mail, error, loadAttachmentFile } =
    useOutlookMailItem();
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [rows, setRows] = useState<OpenNcRow[]>([]);
  const [loadingRows, setLoadingRows] = useState(false);
  const [selectedKey, setSelectedKey] = useState("");
  const [selectedAttachmentId, setSelectedAttachmentId] = useState<string | null>(
    null
  );
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (!projectId) return;
    setLoadingRows(true);
    setMessage(null);
    setSelectedKey("");
    getOpenNcExecutionsForOutlook(projectId)
      .then(setRows)
      .catch((err) =>
        setLoadError(err instanceof Error ? err.message : "Erreur chargement.")
      )
      .finally(() => setLoadingRows(false));
  }, [projectId]);

  async function handleClassify() {
    if (!selectedAttachmentId || !selectedKey) {
      setMessage("Choisissez une pièce jointe et un point NC.");
      return;
    }
    const [checklistItemId, planLevelId] = selectedKey.split("::");
    if (!checklistItemId || !planLevelId) return;

    setMessage(null);
    startTransition(async () => {
      try {
        const file = await loadAttachmentFile(selectedAttachmentId);
        const formData = new FormData();
        formData.set("file", file);
        await uploadWorkControlAttestation(
          projectId,
          checklistItemId,
          planLevelId,
          formData
        );
        setMessage(`Attestation déposée : ${file.name} — NC levée.`);
        setRows(await getOpenNcExecutionsForOutlook(projectId));
        setSelectedKey("");
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
      <header className="rounded-xl bg-slate-50 px-3 py-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Attestation NC
        </p>
        <p className="mt-1 text-sm font-medium text-slate-900 line-clamp-2">
          {mail.subject || "(sans objet)"}
        </p>
        <p className="mt-0.5 text-xs text-slate-500">
          Déposez le PDF pour lever le point et renseigner la date.
        </p>
      </header>

      <label className="block text-xs font-semibold text-slate-700">
        Opération
        <select
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </label>

      <div>
        <p className="mb-1 text-xs font-semibold text-slate-700">Pièce jointe PDF</p>
        <ul className="max-h-32 space-y-1 overflow-y-auto">
          {pdfAttachments.map((att) => (
            <li key={att.id}>
              <button
                type="button"
                onClick={() => setSelectedAttachmentId(att.id)}
                className={`w-full rounded-lg px-2 py-1.5 text-left text-xs ${
                  selectedAttachmentId === att.id
                    ? "bg-violet-100 font-semibold text-violet-900"
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

      <label className="block text-xs font-semibold text-slate-700">
        Point NC à lever
        <select
          value={selectedKey}
          onChange={(e) => setSelectedKey(e.target.value)}
          disabled={loadingRows}
          className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
        >
          <option value="">— Choisir —</option>
          {rows.map((r) => (
            <option
              key={`${r.checklistItemId}::${r.planLevelId}`}
              value={`${r.checklistItemId}::${r.planLevelId}`}
            >
              {r.itemLabel} · {r.planName} / {r.levelName}
              {r.enterpriseName ? ` · ${r.enterpriseName}` : ""}
            </option>
          ))}
        </select>
      </label>

      {rows.length === 0 && !loadingRows && (
        <p className="text-xs text-emerald-700">Aucune NC ouverte sur cette opération.</p>
      )}

      <button
        type="button"
        disabled={isPending || !selectedAttachmentId || !selectedKey}
        onClick={handleClassify}
        className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white disabled:opacity-40"
      >
        {isPending ? "Dépôt…" : "Déposer l'attestation et lever"}
      </button>

      {(message || loadError) && (
        <p className="text-xs text-slate-700">{message ?? loadError}</p>
      )}
    </div>
  );
}
