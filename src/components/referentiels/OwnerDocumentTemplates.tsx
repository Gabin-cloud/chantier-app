"use client";

import { useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import type { OwnerDocumentTemplatesPageData } from "@/lib/actions/owner-document-templates";
import {
  createDocumentLabel,
  importOwnerDocumentWord,
  saveOwnerDocumentTemplate,
} from "@/lib/actions/owner-document-templates";
import {
  DOCUMENT_DOC_TYPE_LABELS,
  DOCUMENT_LABEL_CATEGORY_LABELS,
  normalizeLabelKey,
  renderDocumentPreviewHtml,
  type DocumentDocType,
  type DocumentLabelDefinition,
} from "@/lib/documents/document-labels";
import { AppFormField } from "@/components/ui/AppFormField";
import { RichTextEditor, type RichTextEditorHandle } from "@/components/ui/RichTextEditor";

type TabId = "infos" | DocumentDocType;

type Props = {
  data: OwnerDocumentTemplatesPageData;
  infos: ReactNode;
};

export function OwnerDocumentTemplates({ data, infos }: Props) {
  const [tab, setTab] = useState<TabId>("infos");

  const tabs: { id: TabId; label: string }[] = [
    { id: "infos", label: "Informations" },
    { id: "os", label: "OS" },
    { id: "ae", label: "Acte d'engagement" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-3">
        {tabs.map((item) => {
          const active = tab === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className={`rounded-lg px-3.5 py-2 text-sm font-semibold transition ${
                active
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              {item.label}
            </button>
          );
        })}
      </div>

      {tab === "infos" ? (
        infos
      ) : (
        <DocumentTemplateEditor
          key={tab}
          ownerId={data.ownerId}
          docType={tab}
          canEdit={data.canEdit}
          initialTemplate={data.templates[tab]}
          initialLabels={data.labels}
        />
      )}
    </div>
  );
}

function DocumentTemplateEditor({
  ownerId,
  docType,
  canEdit,
  initialTemplate,
  initialLabels,
}: {
  ownerId: string;
  docType: DocumentDocType;
  canEdit: boolean;
  initialTemplate: OwnerDocumentTemplatesPageData["templates"]["os"];
  initialLabels: DocumentLabelDefinition[];
}) {
  const router = useRouter();
  const editorRef = useRef<RichTextEditorHandle>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [title, setTitle] = useState(initialTemplate.title);
  const [bodyHtml, setBodyHtml] = useState(initialTemplate.bodyHtml);
  const [enabledKeys, setEnabledKeys] = useState<string[]>(initialTemplate.enabledLabelKeys);
  const [labels, setLabels] = useState(initialLabels);
  const [sourceFileName, setSourceFileName] = useState(initialTemplate.sourceFileName);
  const [previewMode, setPreviewMode] = useState<"edit" | "labels" | "filled">("edit");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const [newLabel, setNewLabel] = useState("");
  const [newKey, setNewKey] = useState("");
  const [newExample, setNewExample] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newCategory, setNewCategory] = useState("general");

  const labelByKey = useMemo(
    () => new Map(labels.map((item) => [item.key, item])),
    [labels]
  );

  const enabledLabels = useMemo(
    () => enabledKeys.map((key) => labelByKey.get(key)).filter(Boolean) as DocumentLabelDefinition[],
    [enabledKeys, labelByKey]
  );

  const labelsByCategory = useMemo(() => {
    const groups = new Map<string, DocumentLabelDefinition[]>();
    for (const item of labels) {
      const list = groups.get(item.category) ?? [];
      list.push(item);
      groups.set(item.category, list);
    }
    return Array.from(groups.entries());
  }, [labels]);

  const previewHtml = useMemo(() => {
    if (previewMode === "edit") return "";
    return renderDocumentPreviewHtml(
      bodyHtml,
      labels,
      previewMode === "filled" ? "filled" : "labels"
    );
  }, [bodyHtml, labels, previewMode]);

  function toggleEnabled(key: string) {
    setEnabledKeys((current) =>
      current.includes(key) ? current.filter((item) => item !== key) : [...current, key]
    );
  }

  function insertLabel(key: string) {
    if (!canEdit) return;
    if (!enabledKeys.includes(key)) {
      setEnabledKeys((current) => [...current, key]);
    }
    const token = `{{${key}}}`;
    editorRef.current?.insertToken(token);
    const latest = editorRef.current?.getHtml();
    if (latest !== undefined) setBodyHtml(latest);
    setPreviewMode("edit");
  }

  function handleSave(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    const latestBody = editorRef.current?.getHtml() ?? bodyHtml;

    startTransition(async () => {
      const result = await saveOwnerDocumentTemplate({
        ownerId,
        docType,
        title,
        bodyHtml: latestBody,
        enabledLabelKeys: enabledKeys,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setBodyHtml(latestBody);
      setMessage("Modèle enregistré.");
      router.refresh();
    });
  }

  function handleImportWord(file: File | null) {
    if (!file || !canEdit) return;
    setError(null);
    setMessage(null);
    const formData = new FormData();
    formData.set("ownerId", ownerId);
    formData.set("docType", docType);
    formData.set("file", file);

    startTransition(async () => {
      const result = await importOwnerDocumentWord(formData);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setBodyHtml(result.bodyHtml);
      setSourceFileName(result.sourceFileName);
      setMessage(`Word « ${result.sourceFileName} » importé. Placez ensuite vos étiquettes.`);
      setPreviewMode("edit");
      router.refresh();
    });
  }

  function handleCreateLabel(event: React.FormEvent) {
    event.preventDefault();
    if (!canEdit) return;
    setError(null);
    setMessage(null);

    startTransition(async () => {
      const result = await createDocumentLabel({
        key: newKey || normalizeLabelKey(newLabel),
        label: newLabel,
        description: newDescription,
        example: newExample,
        category: newCategory,
      });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      setLabels((current) =>
        [...current, result.label].sort((a, b) => a.label.localeCompare(b.label, "fr"))
      );
      setEnabledKeys((current) =>
        current.includes(result.label.key) ? current : [...current, result.label.key]
      );
      setNewLabel("");
      setNewKey("");
      setNewExample("");
      setNewDescription("");
      setMessage(`Étiquette « ${result.label.label} » ajoutée au catalogue.`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-5">
      <header className="rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">
              {DOCUMENT_DOC_TYPE_LABELS[docType]}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Rédigez le modèle, choisissez les étiquettes disponibles, puis prévisualisez le
              document rempli avec des exemples.
            </p>
            {sourceFileName && (
              <p className="mt-2 text-xs text-slate-500">
                Fichier Word source : <span className="font-medium">{sourceFileName}</span>
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {(
              [
                ["edit", "Édition"],
                ["labels", "Étiquettes"],
                ["filled", "Aperçu rempli"],
              ] as const
            ).map(([mode, label]) => (
              <button
                key={mode}
                type="button"
                onClick={() => {
                  if (mode !== "edit") {
                    const latest = editorRef.current?.getHtml();
                    if (latest !== undefined) setBodyHtml(latest);
                  }
                  setPreviewMode(mode);
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                  previewMode === mode
                    ? "bg-violet-700 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {!canEdit && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Lecture seule. Seuls les super-admins et les admins / gestionnaires de projet peuvent
            modifier les modèles et ajouter des étiquettes.
          </p>
        )}
      </header>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <form onSubmit={handleSave} className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <AppFormField
              label="Titre du modèle"
              name={`title_${docType}`}
              value={title}
              savedValue={initialTemplate.title}
              onChange={setTitle}
              disabled={!canEdit || isPending}
              required
            />

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <input
                ref={fileInputRef}
                type="file"
                accept=".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                className="hidden"
                onChange={(event) => {
                  handleImportWord(event.target.files?.[0] ?? null);
                  event.target.value = "";
                }}
              />
              <button
                type="button"
                disabled={!canEdit || isPending}
                onClick={() => fileInputRef.current?.click()}
                className="rounded-lg bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-40"
              >
                Importer un Word (.docx)
              </button>
              <p className="text-xs text-slate-500">
                L&apos;import convertit le Word en modèle éditable, puis vous placez les étiquettes.
              </p>
            </div>

            <div className="mt-5">
              {previewMode === "edit" ? (
                <>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                    Contenu du document
                  </label>
                  <RichTextEditor
                    ref={editorRef}
                    value={bodyHtml}
                    onChange={setBodyHtml}
                    disabled={!canEdit || isPending}
                    minHeight="420px"
                    placeholder="Rédigez le modèle ou importez un Word…"
                  />
                </>
              ) : (
                <DocumentPreviewFrame
                  title={
                    previewMode === "labels"
                      ? "Prévisualisation — emplacement des étiquettes"
                      : "Prévisualisation — document rempli (exemples)"
                  }
                  html={previewHtml}
                />
              )}
            </div>

            {error && (
              <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
            )}
            {message && (
              <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
                {message}
              </p>
            )}

            <div className="mt-4 flex justify-end">
              <button
                type="submit"
                disabled={!canEdit || isPending}
                className="rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-40"
              >
                {isPending ? "Enregistrement…" : "Enregistrer le modèle"}
              </button>
            </div>
          </section>
        </form>

        <aside className="space-y-4">
          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Étiquettes du modèle</h3>
            <p className="mt-1 text-xs text-slate-500">
              Cochez les étiquettes à proposer, puis cliquez pour les insérer dans le document.
            </p>

            {enabledLabels.length === 0 ? (
              <p className="mt-3 text-xs text-slate-400">Aucune étiquette sélectionnée.</p>
            ) : (
              <div className="mt-3 flex flex-wrap gap-2">
                {enabledLabels.map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    disabled={!canEdit || isPending}
                    onClick={() => insertLabel(item.key)}
                    className="rounded-full bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-800 hover:bg-violet-100 disabled:opacity-40"
                    title={`${item.description} — ex. ${item.example}`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">Catalogue — choisir</h3>
            <p className="mt-1 text-xs text-slate-500">
              Activez ou désactivez les étiquettes pour ce modèle.
            </p>
            <div className="mt-3 max-h-[22rem] space-y-4 overflow-y-auto pr-1">
              {labelsByCategory.map(([category, items]) => (
                <div key={category}>
                  <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
                    {DOCUMENT_LABEL_CATEGORY_LABELS[category] ?? category}
                  </p>
                  <ul className="space-y-1.5">
                    {items.map((item) => {
                      const checked = enabledKeys.includes(item.key);
                      return (
                        <li key={item.key}>
                          <label className="flex cursor-pointer items-start gap-2 rounded-lg px-1.5 py-1 hover:bg-slate-50">
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={!canEdit || isPending}
                              onChange={() => toggleEnabled(item.key)}
                              className="mt-0.5"
                            />
                            <span className="min-w-0">
                              <span className="block text-sm font-medium text-slate-800">
                                {item.label}
                              </span>
                              <span className="block truncate font-mono text-[11px] text-slate-400">
                                {`{{${item.key}}}`}
                              </span>
                            </span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </div>
          </section>

          {canEdit && (
            <section className="rounded-2xl border border-dashed border-violet-200 bg-violet-50/40 p-4">
              <h3 className="text-sm font-semibold text-slate-900">Ajouter une étiquette</h3>
              <p className="mt-1 text-xs text-slate-500">
                Réservé aux admins — l&apos;étiquette rejoindra le catalogue pour tous les modèles.
              </p>
              <form onSubmit={handleCreateLabel} className="mt-3 space-y-3">
                <AppFormField
                  label="Libellé"
                  name="new_label"
                  value={newLabel}
                  onChange={(value) => {
                    setNewLabel(value);
                    if (!newKey) setNewKey(normalizeLabelKey(value));
                  }}
                  required
                  disabled={isPending}
                />
                <AppFormField
                  label="Clé technique"
                  name="new_key"
                  value={newKey}
                  onChange={(value) => setNewKey(normalizeLabelKey(value))}
                  hint="Ex. montant_retenue"
                  disabled={isPending}
                />
                <AppFormField
                  label="Exemple"
                  name="new_example"
                  value={newExample}
                  onChange={setNewExample}
                  disabled={isPending}
                />
                <AppFormField
                  label="Description"
                  name="new_description"
                  value={newDescription}
                  onChange={setNewDescription}
                  disabled={isPending}
                />
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700">
                    Catégorie
                  </label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    disabled={isPending}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900"
                  >
                    {Object.entries(DOCUMENT_LABEL_CATEGORY_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={isPending || !newLabel.trim()}
                  className="w-full rounded-lg bg-violet-700 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-600 disabled:opacity-40"
                >
                  Ajouter au catalogue
                </button>
              </form>
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}

function DocumentPreviewFrame({ title, html }: { title: string; html: string }) {
  return (
    <div>
      <p className="mb-2 text-sm font-semibold text-slate-700">{title}</p>
      <div className="overflow-auto rounded-xl bg-slate-200/70 p-4 sm:p-6">
        <article className="mx-auto min-h-[640px] w-full max-w-[210mm] bg-white px-8 py-10 shadow-lg sm:px-12">
          <style>{`
            .doc-preview .doc-label-chip {
              display: inline-block;
              margin: 0 2px;
              padding: 1px 8px;
              border-radius: 9999px;
              background: #ede9fe;
              color: #5b21b6;
              font-size: 12px;
              font-weight: 600;
              white-space: nowrap;
            }
            .doc-preview .doc-label-value {
              color: #5b21b6;
              font-weight: 600;
              border-bottom: 1px dashed #c4b5fd;
            }
          `}</style>
          <div className="doc-preview text-sm leading-relaxed" dangerouslySetInnerHTML={{ __html: html }} />
        </article>
      </div>
    </div>
  );
}
