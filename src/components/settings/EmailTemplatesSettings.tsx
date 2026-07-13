"use client";

import { useRef, useState, useTransition } from "react";
import type { EmailTemplatesSettingsData } from "@/lib/actions/email-templates";
import { updateVisitReportEmailTemplate } from "@/lib/actions/email-templates";
import { RichTextEditor, type RichTextEditorHandle } from "@/components/ui/RichTextEditor";

const inputClass =
  "w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200";

export function EmailTemplatesSettings({ data }: { data: EmailTemplatesSettingsData }) {
  const [subjectTemplate, setSubjectTemplate] = useState(data.visitReport.subjectTemplate);
  const [bodyTemplate, setBodyTemplate] = useState(data.visitReport.bodyTemplate);
  const [defaultCc, setDefaultCc] = useState(data.visitReport.defaultCc);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyEditorRef = useRef<RichTextEditorHandle>(null);

  function insertTag(field: "subject" | "body", tagKey: string) {
    const token = `{{${tagKey}}}`;
    if (field === "subject") {
      const input = subjectRef.current;
      if (!input) {
        setSubjectTemplate((prev) => `${prev}${token}`);
        return;
      }
      const start = input.selectionStart ?? subjectTemplate.length;
      const end = input.selectionEnd ?? subjectTemplate.length;
      const next = `${subjectTemplate.slice(0, start)}${token}${subjectTemplate.slice(end)}`;
      setSubjectTemplate(next);
      requestAnimationFrame(() => {
        input.focus();
        const caret = start + token.length;
        input.setSelectionRange(caret, caret);
      });
      return;
    }

    bodyEditorRef.current?.insertToken(token);
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      const result = await updateVisitReportEmailTemplate({
        subjectTemplate,
        bodyTemplate,
        defaultCc,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setSuccess("Modèle enregistré.");
    });
  }

  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Mails type — visite de chantier</h2>
        <p className="mt-1 text-sm text-slate-500">
          Rédigez le mail comme dans un traitement de texte. Les étiquettes se remplissent
          automatiquement lors de la préparation du brouillon.
        </p>

        {!data.canEdit && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Lecture seule. Seul un super administrateur peut modifier les mails type.
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-5 space-y-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Objet du mail
            </label>
            <input
              ref={subjectRef}
              type="text"
              value={subjectTemplate}
              onChange={(e) => setSubjectTemplate(e.target.value)}
              disabled={!data.canEdit || isPending}
              className={inputClass}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Copie carbone par défaut (Cc)
            </label>
            <input
              type="text"
              value={defaultCc}
              onChange={(e) => setDefaultCc(e.target.value)}
              disabled={!data.canEdit || isPending}
              placeholder="email1@entreprise.fr, email2@entreprise.fr"
              className={inputClass}
            />
          </div>

          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Corps du mail
            </label>
            <RichTextEditor
              ref={bodyEditorRef}
              value={bodyTemplate}
              onChange={setBodyTemplate}
              disabled={!data.canEdit || isPending}
              minHeight="260px"
              placeholder="Rédigez le contenu du mail type…"
            />
          </div>

          {data.canEdit && (
            <button
              type="submit"
              disabled={isPending}
              className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              Enregistrer le modèle
            </button>
          )}
        </form>

        {success && (
          <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {success}
          </p>
        )}
        {error && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        )}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-base font-semibold text-slate-900">Étiquettes disponibles</h3>
        <p className="mt-1 text-sm text-slate-500">
          Cliquez sur une étiquette pour l&apos;insérer dans l&apos;objet ou le corps du mail.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="self-center text-xs font-semibold uppercase tracking-wide text-slate-400">
            Objet
          </span>
          {data.mergeTags.map((tag) => (
            <button
              key={`subject-${tag.key}`}
              type="button"
              disabled={!data.canEdit}
              onClick={() => insertTag("subject", tag.key)}
              className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-40"
              title={`${tag.description} — ex. ${tag.example}`}
            >
              {tag.label}
            </button>
          ))}
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <span className="self-center text-xs font-semibold uppercase tracking-wide text-slate-400">
            Corps
          </span>
          {data.mergeTags.map((tag) => (
            <button
              key={`body-${tag.key}`}
              type="button"
              disabled={!data.canEdit}
              onClick={() => insertTag("body", tag.key)}
              className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-40"
              title={`${tag.description} — ex. ${tag.example}`}
            >
              {`{{${tag.key}}}`}
            </button>
          ))}
        </div>

        <div className="mt-5 overflow-x-auto rounded-xl border border-slate-100">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-2 font-semibold">Étiquette</th>
                <th className="px-3 py-2 font-semibold">Libellé</th>
                <th className="px-3 py-2 font-semibold">Exemple</th>
              </tr>
            </thead>
            <tbody>
              {data.mergeTags.map((tag) => (
                <tr key={tag.key} className="border-t border-slate-100">
                  <td className="px-3 py-2 font-mono text-xs text-emerald-700">{`{{${tag.key}}}`}</td>
                  <td className="px-3 py-2 text-slate-700">{tag.label}</td>
                  <td className="px-3 py-2 text-slate-500">{tag.example}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
