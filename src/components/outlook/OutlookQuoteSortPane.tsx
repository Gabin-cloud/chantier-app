"use client";

import { useEffect, useState, useTransition } from "react";
import { AppFormField } from "@/components/ui/AppFormField";
import { getQuickSortData } from "@/lib/actions/incoming-files";
import { upsertQuoteFromOutlook } from "@/lib/actions/quotes";
import { formatLotLabel } from "@/components/finance/FileSortForm";
import { useOutlookMailItem } from "@/components/outlook/useOutlookMailItem";
import type { FinanceProjectOption } from "@/lib/actions/incoming-files";
import type { QuickSortLot } from "@/lib/actions/incoming-files";

type OutlookQuoteSortPaneProps = {
  projects: FinanceProjectOption[];
};

function mailDateToInput(): string {
  return new Date().toISOString().slice(0, 10);
}

export function OutlookQuoteSortPane({ projects }: OutlookQuoteSortPaneProps) {
  const { ready, outsideOutlook, mail, error, loadAttachmentFile } =
    useOutlookMailItem();
  const [isPending, startTransition] = useTransition();
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [lots, setLots] = useState<QuickSortLot[]>([]);
  const [enterpriseId, setEnterpriseId] = useState("");
  const [mode, setMode] = useState<"new" | "signed">("new");
  const [existingQuotes, setExistingQuotes] = useState<
    Awaited<ReturnType<typeof import("@/lib/actions/quotes").getProjectQuotes>>
  >([]);
  const [selectedQuoteId, setSelectedQuoteId] = useState("");
  const [selectedAttachmentId, setSelectedAttachmentId] = useState<string | null>(null);
  const [loadedFile, setLoadedFile] = useState<File | null>(null);
  const [loadingFile, setLoadingFile] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [quoteNumber, setQuoteNumber] = useState("");
  const [quoteDate, setQuoteDate] = useState(mailDateToInput());
  const [designation, setDesignation] = useState("");
  const [amountHt, setAmountHt] = useState("");
  const [isCie, setIsCie] = useState(false);
  const [isTs, setIsTs] = useState(false);
  const [isTma, setIsTma] = useState(false);
  const [validatedAt, setValidatedAt] = useState("");
  const [markRejected, setMarkRejected] = useState(false);
  const [comment, setComment] = useState("");

  useEffect(() => {
    if (!projectId) return;
    getQuickSortData(projectId).then((data) => {
      setLots(data);
      setEnterpriseId(data[0]?.id ?? "");
    });
    import("@/lib/actions/quotes").then(({ getProjectQuotes }) =>
      getProjectQuotes(projectId).then(setExistingQuotes)
    );
  }, [projectId]);

  useEffect(() => {
    if (mail?.subject) {
      setDesignation(mail.subject);
    }
    setQuoteDate(mailDateToInput());
  }, [mail?.subject]);

  async function handleSelectAttachment(attachmentId: string) {
    setSelectedAttachmentId(attachmentId);
    setLoadError(null);
    setLoadedFile(null);
    setLoadingFile(true);
    try {
      const file = await loadAttachmentFile(attachmentId);
      setLoadedFile(file);
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : "Erreur de chargement du fichier."
      );
    } finally {
      setLoadingFile(false);
    }
  }

  function handleSubmit() {
    setFormError(null);
    setSuccess(null);

    startTransition(async () => {
      const formData = new FormData();
      formData.set("mode", mode);
      formData.set("enterpriseId", enterpriseId);
      if (mode === "signed") {
        formData.set("quoteId", selectedQuoteId);
        if (validatedAt) formData.set("validatedAt", validatedAt);
        formData.set("markRejected", String(markRejected));
      } else {
        formData.set("quoteNumber", quoteNumber);
        formData.set("quoteDate", quoteDate);
        formData.set("designation", designation);
        formData.set("amount_ht", amountHt);
        if (isCie) formData.set("is_cie", "true");
        if (isTs) formData.set("is_ts", "true");
        if (isTma) formData.set("is_tma", "true");
        formData.set("comment", comment);
        if (markRejected) formData.set("markRejected", "true");
        if (validatedAt) formData.set("validatedAt", validatedAt);
      }
      if (loadedFile) formData.set("file", loadedFile);

      const result = await upsertQuoteFromOutlook(projectId, formData);
      if (!result.ok) {
        setFormError(result.error);
        return;
      }
      setSuccess(
        mode === "signed"
          ? "Devis signé enregistré et lien mis à jour."
          : "Devis enregistré dans le suivi."
      );
      const { getProjectQuotes } = await import("@/lib/actions/quotes");
      setExistingQuotes(await getProjectQuotes(projectId));
    });
  }

  if (outsideOutlook) {
    return (
      <div className="p-4 text-sm text-amber-800">
        Ce volet doit être ouvert depuis Outlook pour le suivi des devis.
      </div>
    );
  }

  if (!ready) {
    return <div className="p-4 text-sm text-slate-500">Connexion à Outlook…</div>;
  }

  if (error) {
    return <div className="p-4 text-sm text-red-700">{error}</div>;
  }

  if (!mail) {
    return <div className="p-4 text-sm text-slate-500">Aucun mail détecté.</div>;
  }

  const enterpriseQuotes = existingQuotes.filter(
    (q) => q.enterprise_id === enterpriseId && !q.is_rejected
  );

  return (
    <div className="space-y-4 p-4">
      <header className="rounded-xl bg-slate-50 px-3 py-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
          Suivi devis — mail ouvert
        </p>
        <p className="mt-1 text-sm font-medium text-slate-900 line-clamp-2">
          {mail.subject || "(sans objet)"}
        </p>
      </header>

      <section>
        <label className="mb-1 block text-xs font-semibold text-slate-600">
          Projet
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

      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setMode("new")}
          className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold ${
            mode === "new"
              ? "bg-amber-100 text-amber-900"
              : "bg-slate-100 text-slate-600"
          }`}
        >
          Nouveau devis
        </button>
        <button
          type="button"
          onClick={() => setMode("signed")}
          className={`flex-1 rounded-lg px-3 py-2 text-xs font-semibold ${
            mode === "signed"
              ? "bg-emerald-100 text-emerald-900"
              : "bg-slate-100 text-slate-600"
          }`}
        >
          Devis signé
        </button>
      </div>

      <section>
        <label className="mb-1 block text-xs font-semibold text-slate-600">
          Lot / Entreprise
        </label>
        <select
          value={enterpriseId}
          onChange={(e) => setEnterpriseId(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
        >
          {lots.map((lot) => (
            <option key={lot.id} value={lot.id}>
              {formatLotLabel(lot)}
            </option>
          ))}
        </select>
      </section>

      {mode === "signed" ? (
        <section className="space-y-2">
          <label className="block text-xs font-semibold text-slate-600">
            Devis existant
          </label>
          <select
            value={selectedQuoteId}
            onChange={(e) => setSelectedQuoteId(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          >
            <option value="">— Choisir —</option>
            {enterpriseQuotes.map((quote) => (
              <option key={quote.id} value={quote.id}>
                {quote.quote_number || "Devis"} — {quote.designation ?? ""}
              </option>
            ))}
          </select>
          <label className="block text-xs font-semibold text-slate-600">
            Date de validation
          </label>
          <input
            type="date"
            value={validatedAt}
            onChange={(e) => setValidatedAt(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
        </section>
      ) : (
        <section className="space-y-2">
          <AppFormField
            label="N° devis"
            name="quoteNumber"
            value={quoteNumber}
            onChange={setQuoteNumber}
          />
          <label className="block text-xs font-semibold text-slate-600">
            Date (mail)
          </label>
          <input
            type="date"
            value={quoteDate}
            onChange={(e) => setQuoteDate(e.target.value)}
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
          />
          <div className="flex gap-3 text-sm">
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={isCie} onChange={(e) => setIsCie(e.target.checked)} />
              CIE
            </label>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={isTs} onChange={(e) => setIsTs(e.target.checked)} />
              TS
            </label>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={isTma} onChange={(e) => setIsTma(e.target.checked)} />
              TMA
            </label>
          </div>
          <AppFormField
            label="Désignation"
            name="designation"
            value={designation}
            onChange={setDesignation}
          />
          <AppFormField
            label="Montant H.T."
            name="amount_ht"
            format="money"
            value={amountHt}
            onChange={setAmountHt}
          />
          <AppFormField
            label="Commentaire"
            name="comment"
            value={comment}
            onChange={setComment}
          />
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={markRejected}
              onChange={(e) => setMarkRejected(e.target.checked)}
            />
            Non validé (non)
          </label>
        </section>
      )}

      <section>
        <p className="mb-2 text-sm font-semibold text-slate-700">
          Pièce jointe ({mail.attachments.length})
        </p>
        <div className="space-y-2">
          {mail.attachments.map((att) => (
            <button
              key={att.id}
              type="button"
              onClick={() => handleSelectAttachment(att.id)}
              className={`w-full rounded-lg border px-3 py-2 text-left text-sm ${
                selectedAttachmentId === att.id
                  ? "border-blue-400 bg-blue-50"
                  : "border-slate-200 bg-white"
              }`}
            >
              {att.name}
            </button>
          ))}
        </div>
        {loadingFile && <p className="text-sm text-slate-500">Chargement…</p>}
        {loadError && <p className="text-sm text-red-700">{loadError}</p>}
      </section>

      {formError && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{formError}</p>
      )}
      {success && (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          {success}
        </p>
      )}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={isPending || !enterpriseId || (mode === "signed" && !selectedQuoteId)}
        className="w-full rounded-xl bg-violet-600 px-4 py-3 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
      >
        {isPending ? "Enregistrement…" : "Enregistrer dans le suivi devis"}
      </button>
    </div>
  );
}
