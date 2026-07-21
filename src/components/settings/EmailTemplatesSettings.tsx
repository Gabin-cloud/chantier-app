"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { EmailTemplatesSettingsData } from "@/lib/actions/email-templates";
import {
  updateAmendmentEmailTemplate,
  updatePlatformInvitationEmailTemplate,
  updateVisitReportEmailTemplate,
} from "@/lib/actions/email-templates";
import { RichTextEditor, type RichTextEditorHandle } from "@/components/ui/RichTextEditor";

const inputClass =
  "w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-200";

type MergeTag = { key: string; label: string; description: string; example: string };

function MergeTagsPanel({
  tags,
  canEdit,
  onInsertSubject,
  onInsertBody,
}: {
  tags: readonly MergeTag[];
  canEdit: boolean;
  onInsertSubject: (key: string) => void;
  onInsertBody: (key: string) => void;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-base font-semibold text-slate-900">Étiquettes disponibles</h3>
      <p className="mt-1 text-sm text-slate-500">
        Cliquez sur une étiquette pour l&apos;insérer dans l&apos;objet ou le corps du mail.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <span className="self-center text-xs font-semibold uppercase tracking-wide text-slate-400">
          Objet
        </span>
        {tags.map((tag) => (
          <button
            key={`subject-${tag.key}`}
            type="button"
            disabled={!canEdit}
            onClick={() => onInsertSubject(tag.key)}
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
        {tags.map((tag) => (
          <button
            key={`body-${tag.key}`}
            type="button"
            disabled={!canEdit}
            onClick={() => onInsertBody(tag.key)}
            className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-40"
            title={`${tag.description} — ex. ${tag.example}`}
          >
            {`{{${tag.key}}}`}
          </button>
        ))}
      </div>
    </section>
  );
}

export function EmailTemplatesSettings({ data }: { data: EmailTemplatesSettingsData }) {
  const router = useRouter();
  const [visitSubject, setVisitSubject] = useState(data.visitReport.subjectTemplate);
  const [visitBody, setVisitBody] = useState(data.visitReport.bodyTemplate);
  const [visitCc, setVisitCc] = useState(data.visitReport.defaultCc);
  const [inviteSubject, setInviteSubject] = useState(data.platformInvitation.subjectTemplate);
  const [inviteBody, setInviteBody] = useState(data.platformInvitation.bodyTemplate);
  const [amendmentSubject, setAmendmentSubject] = useState(data.amendmentSend.subjectTemplate);
  const [amendmentBody, setAmendmentBody] = useState(data.amendmentSend.bodyTemplate);
  const [amendmentCc, setAmendmentCc] = useState(data.amendmentSend.defaultCc);
  const [visitError, setVisitError] = useState<string | null>(null);
  const [visitSuccess, setVisitSuccess] = useState<string | null>(null);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState<string | null>(null);
  const [amendmentError, setAmendmentError] = useState<string | null>(null);
  const [amendmentSuccess, setAmendmentSuccess] = useState<string | null>(null);
  const [isVisitPending, startVisitTransition] = useTransition();
  const [isInvitePending, startInviteTransition] = useTransition();
  const [isAmendmentPending, startAmendmentTransition] = useTransition();
  const visitSubjectRef = useRef<HTMLInputElement>(null);
  const inviteSubjectRef = useRef<HTMLInputElement>(null);
  const amendmentSubjectRef = useRef<HTMLInputElement>(null);
  const visitBodyRef = useRef<RichTextEditorHandle>(null);
  const inviteBodyRef = useRef<RichTextEditorHandle>(null);
  const amendmentBodyRef = useRef<RichTextEditorHandle>(null);

  function insertTag(
    field: "subject" | "body",
    tagKey: string,
    subject: string,
    setSubject: (value: string) => void,
    subjectRef: React.RefObject<HTMLInputElement | null>,
    bodyRef: React.RefObject<RichTextEditorHandle | null>,
    setBody: (value: string) => void
  ) {
    const token = `{{${tagKey}}}`;
    if (field === "subject") {
      const input = subjectRef.current;
      if (!input) {
        setSubject(`${subject}${token}`);
        return;
      }
      const start = input.selectionStart ?? subject.length;
      const end = input.selectionEnd ?? subject.length;
      const next = `${subject.slice(0, start)}${token}${subject.slice(end)}`;
      setSubject(next);
      requestAnimationFrame(() => {
        input.focus();
        const caret = start + token.length;
        input.setSelectionRange(caret, caret);
      });
      return;
    }

    bodyRef.current?.insertToken(token);
    const latestHtml = bodyRef.current?.getHtml();
    if (latestHtml !== undefined) {
      setBody(latestHtml);
    }
  }

  function saveVisit(event: React.FormEvent) {
    event.preventDefault();
    setVisitError(null);
    setVisitSuccess(null);
    const latestBody = visitBodyRef.current?.getHtml() ?? visitBody;

    startVisitTransition(async () => {
      const result = await updateVisitReportEmailTemplate({
        subjectTemplate: visitSubject,
        bodyTemplate: latestBody,
        defaultCc: visitCc,
      });
      if (!result.ok) {
        setVisitError(result.error);
        return;
      }
      setVisitBody(latestBody);
      setVisitSuccess("Modèle enregistré.");
      router.refresh();
    });
  }

  function saveInvitation(event: React.FormEvent) {
    event.preventDefault();
    setInviteError(null);
    setInviteSuccess(null);
    const latestBody = inviteBodyRef.current?.getHtml() ?? inviteBody;

    startInviteTransition(async () => {
      const result = await updatePlatformInvitationEmailTemplate({
        subjectTemplate: inviteSubject,
        bodyTemplate: latestBody,
      });
      if (!result.ok) {
        setInviteError(result.error);
        return;
      }
      setInviteBody(latestBody);
      setInviteSuccess("Modèle enregistré.");
      router.refresh();
    });
  }

  function saveAmendment(event: React.FormEvent) {
    event.preventDefault();
    setAmendmentError(null);
    setAmendmentSuccess(null);
    const latestBody = amendmentBodyRef.current?.getHtml() ?? amendmentBody;

    startAmendmentTransition(async () => {
      const result = await updateAmendmentEmailTemplate({
        subjectTemplate: amendmentSubject,
        bodyTemplate: latestBody,
        defaultCc: amendmentCc,
      });
      if (!result.ok) {
        setAmendmentError(result.error);
        return;
      }
      setAmendmentBody(latestBody);
      setAmendmentSuccess("Modèle enregistré.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-8">
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Mails type — visite de chantier</h2>
        <p className="mt-1 text-sm text-slate-500">
          Rédigez le mail comme dans un traitement de texte. Les étiquettes se remplissent
          automatiquement lors de la préparation du brouillon.
        </p>

        {!data.canEdit && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Lecture seule. Seuls les administrateurs ou gestionnaires de projet peuvent modifier
            les mails type.
          </p>
        )}

        <form onSubmit={saveVisit} className="mt-5 space-y-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Objet du mail</label>
            <input
              ref={visitSubjectRef}
              type="text"
              value={visitSubject}
              onChange={(e) => setVisitSubject(e.target.value)}
              disabled={!data.canEdit || isVisitPending}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Copie carbone par défaut (Cc)
            </label>
            <input
              type="text"
              value={visitCc}
              onChange={(e) => setVisitCc(e.target.value)}
              disabled={!data.canEdit || isVisitPending}
              placeholder="email1@entreprise.fr, email2@entreprise.fr"
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Corps du mail</label>
            <RichTextEditor
              ref={visitBodyRef}
              value={visitBody}
              onChange={setVisitBody}
              disabled={!data.canEdit || isVisitPending}
              minHeight="260px"
              placeholder="Rédigez le contenu du mail type…"
            />
          </div>
          {data.canEdit && (
            <button
              type="submit"
              disabled={isVisitPending}
              className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              Enregistrer le modèle
            </button>
          )}
        </form>

        {visitSuccess && (
          <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {visitSuccess}
          </p>
        )}
        {visitError && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{visitError}</p>
        )}

        <div className="mt-6">
          <MergeTagsPanel
            tags={data.mergeTags}
            canEdit={data.canEdit}
            onInsertSubject={(key) =>
              insertTag("subject", key, visitSubject, setVisitSubject, visitSubjectRef, visitBodyRef, setVisitBody)
            }
            onInsertBody={(key) =>
              insertTag("body", key, visitSubject, setVisitSubject, visitSubjectRef, visitBodyRef, setVisitBody)
            }
          />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Mails type — invitation plateforme</h2>
        <p className="mt-1 text-sm text-slate-500">
          Envoyé depuis votre adresse Microsoft 365 lors d&apos;une invitation entreprise sur la
          fiche opération.
        </p>

        <form onSubmit={saveInvitation} className="mt-5 space-y-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Objet du mail</label>
            <input
              ref={inviteSubjectRef}
              type="text"
              value={inviteSubject}
              onChange={(e) => setInviteSubject(e.target.value)}
              disabled={!data.canEdit || isInvitePending}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Corps du mail</label>
            <RichTextEditor
              ref={inviteBodyRef}
              value={inviteBody}
              onChange={setInviteBody}
              disabled={!data.canEdit || isInvitePending}
              minHeight="260px"
              placeholder="Rédigez le contenu de l'invitation…"
            />
          </div>
          {data.canEdit && (
            <button
              type="submit"
              disabled={isInvitePending}
              className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              Enregistrer le modèle
            </button>
          )}
        </form>

        {inviteSuccess && (
          <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {inviteSuccess}
          </p>
        )}
        {inviteError && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{inviteError}</p>
        )}

        <div className="mt-6">
          <MergeTagsPanel
            tags={data.invitationMergeTags}
            canEdit={data.canEdit}
            onInsertSubject={(key) =>
              insertTag("subject", key, inviteSubject, setInviteSubject, inviteSubjectRef, inviteBodyRef, setInviteBody)
            }
            onInsertBody={(key) =>
              insertTag("body", key, inviteSubject, setInviteSubject, inviteSubjectRef, inviteBodyRef, setInviteBody)
            }
          />
        </div>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">Mails type — envoi avenant</h2>
        <p className="mt-1 text-sm text-slate-500">
          Utilisé après la création d&apos;un avenant pour l&apos;envoyer à l&apos;entreprise avec le PDF
          fusionné (avenant + devis).
        </p>

        <form onSubmit={saveAmendment} className="mt-5 space-y-5">
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Objet du mail</label>
            <input
              ref={amendmentSubjectRef}
              type="text"
              value={amendmentSubject}
              onChange={(e) => setAmendmentSubject(e.target.value)}
              disabled={!data.canEdit || isAmendmentPending}
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">
              Copie carbone par défaut (Cc)
            </label>
            <input
              type="text"
              value={amendmentCc}
              onChange={(e) => setAmendmentCc(e.target.value)}
              disabled={!data.canEdit || isAmendmentPending}
              placeholder="email1@entreprise.fr, email2@entreprise.fr"
              className={inputClass}
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-medium text-slate-700">Corps du mail</label>
            <RichTextEditor
              ref={amendmentBodyRef}
              value={amendmentBody}
              onChange={setAmendmentBody}
              disabled={!data.canEdit || isAmendmentPending}
              minHeight="260px"
              placeholder="Rédigez le contenu du mail type…"
            />
          </div>
          {data.canEdit && (
            <button
              type="submit"
              disabled={isAmendmentPending}
              className="rounded-xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              Enregistrer le modèle
            </button>
          )}
        </form>

        {amendmentSuccess && (
          <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {amendmentSuccess}
          </p>
        )}
        {amendmentError && (
          <p className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{amendmentError}</p>
        )}

        <div className="mt-6">
          <MergeTagsPanel
            tags={data.amendmentMergeTags}
            canEdit={data.canEdit}
            onInsertSubject={(key) =>
              insertTag(
                "subject",
                key,
                amendmentSubject,
                setAmendmentSubject,
                amendmentSubjectRef,
                amendmentBodyRef,
                setAmendmentBody
              )
            }
            onInsertBody={(key) =>
              insertTag(
                "body",
                key,
                amendmentSubject,
                setAmendmentSubject,
                amendmentSubjectRef,
                amendmentBodyRef,
                setAmendmentBody
              )
            }
          />
        </div>
      </section>
    </div>
  );
}
