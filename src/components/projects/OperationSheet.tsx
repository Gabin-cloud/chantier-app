"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SharePointPathSettings } from "@/components/projects/SharePointPathSettings";
import { uploadOperationPhoto } from "@/lib/actions/finance";
import {
  applyDirectoryToEnterprise,
  updateEnterpriseSheet,
  updateOperationSheet,
  uploadOperationLogo,
  type LogoTarget,
} from "@/lib/actions/operation-sheet";
import type {
  CompanyDirectoryEntry,
  Enterprise,
  Project,
} from "@/lib/types/database";

type OperationSheetProps = {
  project: Project;
  enterprises: Enterprise[];
  directory: CompanyDirectoryEntry[];
  canEdit: boolean;
};

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";

function logoUrl(path: string | null | undefined) {
  if (!path) return null;
  return `${SUPABASE_URL}/storage/v1/object/public/financial-files/${path}`;
}

const labelClass = "mb-1.5 block text-sm font-semibold text-slate-700";
const danobatInput =
  "w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-2.5 text-base text-slate-800 focus:border-slate-400 focus:bg-white focus:outline-none";
const enterpriseInput =
  "w-full rounded-xl border-2 border-dashed border-slate-300 bg-slate-100 px-4 py-2.5 text-base text-slate-600 placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:text-slate-800 focus:outline-none";

function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-400">{hint}</p>}
    </div>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

function LogoUploader({
  label,
  currentPath,
  onUpload,
  disabled,
}: {
  label: string;
  currentPath: string | null;
  onUpload: (formData: FormData) => Promise<void>;
  disabled: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(logoUrl(currentPath));

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      await onUpload(fd);
      setPreview(URL.createObjectURL(file));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <label className={labelClass}>{label}</label>
      <div className="flex items-center gap-3">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt={label} className="h-full w-full object-contain" />
          ) : (
            <span className="text-[10px] text-slate-400">Aucun</span>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleChange}
          disabled={disabled || busy}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || busy}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {busy ? "Envoi…" : "Choisir un logo"}
        </button>
      </div>
    </div>
  );
}

export function OperationSheet({
  project,
  enterprises,
  directory,
  canEdit,
}: OperationSheetProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ---- Bloc projet (Opération + Maître d'ouvrage + Maître d'œuvre) ----
  const [op, setOp] = useState({
    name: project.name ?? "",
    description: project.description ?? "",
    address: project.address ?? "",
    postal_code: project.postal_code ?? "",
    city: project.city ?? "",
    owner_name: project.owner_name ?? "",
    owner_address: project.owner_address ?? "",
    owner_postal_code: project.owner_postal_code ?? "",
    owner_city: project.owner_city ?? "",
    owner_email_admin: project.owner_email_admin ?? "",
    owner_email_works: project.owner_email_works ?? "",
    owner_signatory_name: project.owner_signatory_name ?? "",
    owner_signatory_email: project.owner_signatory_email ?? "",
    owner_doc_marche: project.owner_doc_marche ?? false,
    owner_doc_os: project.owner_doc_os ?? false,
    owner_doc_ae: project.owner_doc_ae ?? false,
    owner_doc_avenant: project.owner_doc_avenant ?? false,
    moe_address: project.moe_address ?? "",
    moe_postal_code: project.moe_postal_code ?? "",
    moe_city: project.moe_city ?? "",
    moe_email_admin: project.moe_email_admin ?? "",
    moe_email_works: project.moe_email_works ?? "",
  });

  const setOpField = <K extends keyof typeof op>(k: K, v: (typeof op)[K]) =>
    setOp((prev) => ({ ...prev, [k]: v }));

  function saveProject() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        await updateOperationSheet(project.id, op);
        setMessage("Fiche opération enregistrée.");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement.");
      }
    });
  }

  async function uploadLogo(target: LogoTarget, fd: FormData, enterpriseId?: string) {
    await uploadOperationLogo(project.id, target, fd, enterpriseId);
    router.refresh();
  }

  // ---- Bloc entreprise (sélection par menu déroulant) ----
  const [selectedId, setSelectedId] = useState<string>(enterprises[0]?.id ?? "");
  const selected = useMemo(
    () => enterprises.find((e) => e.id === selectedId) ?? null,
    [enterprises, selectedId]
  );

  return (
    <div className="space-y-6">
      {/* ============================= OPÉRATION ============================= */}
      <SectionCard title="Opération" subtitle="Renseigné par DANOBAT.">
        <div className="grid gap-4">
          <Field label="Nom de l'opération">
            <input
              className={danobatInput}
              value={op.name}
              onChange={(e) => setOpField("name", e.target.value)}
              disabled={!canEdit}
            />
          </Field>
          <Field label="Descriptif opération">
            <textarea
              className={danobatInput}
              rows={2}
              value={op.description}
              onChange={(e) => setOpField("description", e.target.value)}
              disabled={!canEdit}
            />
          </Field>
          <div>
            <label className={labelClass}>Adresse opération</label>
            <div className="grid gap-3 sm:grid-cols-3">
              <input
                className={danobatInput}
                placeholder="N° et rue"
                value={op.address}
                onChange={(e) => setOpField("address", e.target.value)}
                disabled={!canEdit}
              />
              <input
                className={danobatInput}
                placeholder="Code postal"
                value={op.postal_code}
                onChange={(e) => setOpField("postal_code", e.target.value)}
                disabled={!canEdit}
              />
              <input
                className={danobatInput}
                placeholder="Ville"
                value={op.city}
                onChange={(e) => setOpField("city", e.target.value)}
                disabled={!canEdit}
              />
            </div>
          </div>
          <OperationPhoto project={project} disabled={!canEdit} onDone={() => router.refresh()} />
        </div>
      </SectionCard>

      {/* ========================== MAÎTRE D'OUVRAGE ========================== */}
      <SectionCard
        title="Maître d'ouvrage"
        subtitle="Renseigné par DANOBAT. Le maître d'ouvrage détermine les documents types associés."
      >
        <div className="grid gap-4">
          <Field label="Nom du maître d'ouvrage">
            <input
              className={danobatInput}
              value={op.owner_name}
              onChange={(e) => setOpField("owner_name", e.target.value)}
              disabled={!canEdit}
            />
          </Field>
          <div>
            <label className={labelClass}>Adresse postale</label>
            <div className="grid gap-3 sm:grid-cols-3">
              <input
                className={danobatInput}
                placeholder="N° et rue"
                value={op.owner_address}
                onChange={(e) => setOpField("owner_address", e.target.value)}
                disabled={!canEdit}
              />
              <input
                className={danobatInput}
                placeholder="Code postal"
                value={op.owner_postal_code}
                onChange={(e) => setOpField("owner_postal_code", e.target.value)}
                disabled={!canEdit}
              />
              <input
                className={danobatInput}
                placeholder="Ville"
                value={op.owner_city}
                onChange={(e) => setOpField("owner_city", e.target.value)}
                disabled={!canEdit}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Adresse mail administratif">
              <input
                type="email"
                className={danobatInput}
                value={op.owner_email_admin}
                onChange={(e) => setOpField("owner_email_admin", e.target.value)}
                disabled={!canEdit}
              />
            </Field>
            <Field label="Adresse mail suivi des travaux">
              <input
                type="email"
                className={danobatInput}
                value={op.owner_email_works}
                onChange={(e) => setOpField("owner_email_works", e.target.value)}
                disabled={!canEdit}
              />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Signataire — Nom + Prénom">
              <input
                className={danobatInput}
                value={op.owner_signatory_name}
                onChange={(e) => setOpField("owner_signatory_name", e.target.value)}
                disabled={!canEdit}
              />
            </Field>
            <Field label="Signataire — Adresse mail">
              <input
                type="email"
                className={danobatInput}
                value={op.owner_signatory_email}
                onChange={(e) => setOpField("owner_signatory_email", e.target.value)}
                disabled={!canEdit}
              />
            </Field>
          </div>
          <LogoUploader
            label="Logo du maître d'ouvrage"
            currentPath={project.owner_logo_path}
            onUpload={(fd) => uploadLogo("owner", fd)}
            disabled={!canEdit}
          />
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="mb-3 text-sm font-semibold text-slate-700">
              Documents types associés au maître d'ouvrage
            </p>
            <div className="flex flex-wrap gap-4">
              {(
                [
                  ["owner_doc_marche", "Marché"],
                  ["owner_doc_os", "OS"],
                  ["owner_doc_ae", "AE"],
                  ["owner_doc_avenant", "Avenant"],
                ] as const
              ).map(([key, lab]) => (
                <label key={key} className="flex items-center gap-2 text-sm text-slate-700">
                  <input
                    type="checkbox"
                    className="h-4 w-4 rounded border-slate-300"
                    checked={op[key] as boolean}
                    onChange={(e) => setOpField(key, e.target.checked as never)}
                    disabled={!canEdit}
                  />
                  {lab}
                </label>
              ))}
            </div>
          </div>
        </div>
      </SectionCard>

      {/* ============================ MAÎTRE D'ŒUVRE ========================== */}
      <SectionCard title="Maître d'œuvre — DANOBAT" subtitle="Renseigné par DANOBAT.">
        <div className="grid gap-4">
          <div>
            <label className={labelClass}>Adresse postale</label>
            <div className="grid gap-3 sm:grid-cols-3">
              <input
                className={danobatInput}
                placeholder="N° et rue"
                value={op.moe_address}
                onChange={(e) => setOpField("moe_address", e.target.value)}
                disabled={!canEdit}
              />
              <input
                className={danobatInput}
                placeholder="Code postal"
                value={op.moe_postal_code}
                onChange={(e) => setOpField("moe_postal_code", e.target.value)}
                disabled={!canEdit}
              />
              <input
                className={danobatInput}
                placeholder="Ville"
                value={op.moe_city}
                onChange={(e) => setOpField("moe_city", e.target.value)}
                disabled={!canEdit}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Adresse mail administratif">
              <input
                type="email"
                className={danobatInput}
                value={op.moe_email_admin}
                onChange={(e) => setOpField("moe_email_admin", e.target.value)}
                disabled={!canEdit}
              />
            </Field>
            <Field label="Adresse mail suivi des travaux">
              <input
                type="email"
                className={danobatInput}
                value={op.moe_email_works}
                onChange={(e) => setOpField("moe_email_works", e.target.value)}
                disabled={!canEdit}
              />
            </Field>
          </div>
          <LogoUploader
            label="Logo DANOBAT"
            currentPath={project.moe_logo_path}
            onUpload={(fd) => uploadLogo("moe", fd)}
            disabled={!canEdit}
          />
        </div>
      </SectionCard>

      {/* Lien serveur SharePoint — même principe que la zone paramétrage. */}
      <SharePointPathSettings
        project={project}
        enterprises={enterprises}
        canEdit={canEdit}
      />

      {/* Bouton d'enregistrement du bloc projet */}
      {canEdit && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={saveProject}
            disabled={isPending}
            className="rounded-xl bg-emerald-600 px-5 py-2.5 font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {isPending ? "Enregistrement…" : "Enregistrer l'opération, le MOA et le MOE"}
          </button>
          {message && <span className="text-sm font-medium text-emerald-700">{message}</span>}
          {error && <span className="text-sm font-medium text-red-700">{error}</span>}
        </div>
      )}

      {/* ============================== ENTREPRISE =========================== */}
      <SectionCard
        title="Entreprise"
        subtitle="Une fiche par entreprise. Sélectionnez l'entreprise à configurer."
      >
        {enterprises.length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
            Aucune entreprise sur ce chantier. Ajoutez d'abord un lot / une entreprise
            dans la section « Entreprises sur le chantier » ci-dessous.
          </p>
        ) : (
          <div className="space-y-4">
            <Field label="Entreprise">
              <select
                className={danobatInput}
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
              >
                {enterprises.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.lot_number ? `Lot ${e.lot_number} — ` : ""}
                    {e.name}
                  </option>
                ))}
              </select>
            </Field>

            {selected && (
              <EnterpriseSheetForm
                key={selected.id}
                projectId={project.id}
                enterprise={selected}
                directory={directory}
                canEdit={canEdit}
                onUploadLogo={(fd) => uploadLogo("enterprise", fd, selected.id)}
                onSaved={() => router.refresh()}
              />
            )}
          </div>
        )}
      </SectionCard>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Photo de l'opération                                                        */
/* -------------------------------------------------------------------------- */
function OperationPhoto({
  project,
  disabled,
  onDone,
}: {
  project: Project;
  disabled: boolean;
  onDone: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(
    logoUrl(project.operation_photo_path)
  );

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      await uploadOperationPhoto(project.id, fd);
      setPreview(URL.createObjectURL(file));
      onDone();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <label className={labelClass}>Photo de l'opération</label>
      <div className="flex items-center gap-3">
        <div className="flex h-20 w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
          {preview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={preview} alt="Opération" className="h-full w-full object-cover" />
          ) : (
            <span className="text-[10px] text-slate-400">Aucune</span>
          )}
        </div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleChange}
          disabled={disabled || busy}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || busy}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          {busy ? "Envoi…" : "Choisir une photo"}
        </button>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Fiche d'une entreprise                                                      */
/* -------------------------------------------------------------------------- */
function EnterpriseSheetForm({
  projectId,
  enterprise,
  directory,
  canEdit,
  onUploadLogo,
  onSaved,
}: {
  projectId: string;
  enterprise: Enterprise;
  directory: CompanyDirectoryEntry[];
  canEdit: boolean;
  onUploadLogo: (fd: FormData) => Promise<void>;
  onSaved: () => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [form, setForm] = useState({
    // DANOBAT
    name: enterprise.name ?? "",
    lot_number: enterprise.lot_number ?? "",
    designation: enterprise.designation ?? "",
    contract_amount_ht: String(enterprise.contract_amount_ht ?? 0),
    vat_rate: String(enterprise.vat_rate ?? 20),
    prorata_percent: String(
      Number(((Number(enterprise.prorata_percent) || 0) * 100).toFixed(3))
    ),
    avancement_max_avant_dgd: String(enterprise.avancement_max_avant_dgd ?? 95),
    // Entreprise
    enterprise_address: enterprise.enterprise_address ?? "",
    enterprise_postal_code: enterprise.enterprise_postal_code ?? "",
    enterprise_city: enterprise.enterprise_city ?? "",
    email_administratif: enterprise.email_administratif ?? "",
    email_comptabilite: enterprise.email_comptabilite ?? "",
    email_travaux: enterprise.email_travaux ?? "",
    email_bureau_etudes: enterprise.email_bureau_etudes ?? "",
    email_signataire: enterprise.email_signataire ?? "",
    signataire_name: enterprise.signataire_name ?? "",
    siret: enterprise.siret ?? "",
    email_sav: enterprise.email_sav ?? "",
    phone_accueil: enterprise.phone_accueil ?? "",
    phone_travaux: enterprise.phone_travaux ?? "",
  });

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  function save() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        await updateEnterpriseSheet(projectId, enterprise.id, {
          name: form.name,
          lot_number: form.lot_number,
          designation: form.designation,
          contract_amount_ht: Number(form.contract_amount_ht) || 0,
          vat_rate: Number(form.vat_rate) || 20,
          prorata_percent: (Number(form.prorata_percent) || 0) / 100,
          avancement_max_avant_dgd: Number(form.avancement_max_avant_dgd) || 95,
          enterprise_address: form.enterprise_address,
          enterprise_postal_code: form.enterprise_postal_code,
          enterprise_city: form.enterprise_city,
          email_administratif: form.email_administratif,
          email_comptabilite: form.email_comptabilite,
          email_travaux: form.email_travaux,
          email_bureau_etudes: form.email_bureau_etudes,
          email_signataire: form.email_signataire,
          signataire_name: form.signataire_name,
          siret: form.siret,
          email_sav: form.email_sav,
          phone_accueil: form.phone_accueil,
          phone_travaux: form.phone_travaux,
        });
        setMessage("Fiche entreprise enregistrée.");
        onSaved();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur lors de l'enregistrement.");
      }
    });
  }

  function applyDirectory(directoryId: string) {
    if (!directoryId) return;
    startTransition(async () => {
      try {
        await applyDirectoryToEnterprise(projectId, enterprise.id, directoryId);
        setMessage("Fiche pré-remplie depuis la base entreprises. Rechargement…");
        onSaved();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur lors du pré-remplissage.");
      }
    });
  }

  return (
    <div className="space-y-5">
      {/* Partie DANOBAT */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
          Renseigné par DANOBAT
        </p>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Field label="Nom de l'entreprise">
            <input
              className={danobatInput}
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
              disabled={!canEdit}
            />
          </Field>
          <Field label="N° du lot">
            <input
              className={danobatInput}
              value={form.lot_number}
              onChange={(e) => set("lot_number", e.target.value)}
              disabled={!canEdit}
            />
          </Field>
          <Field label="Intitulé du lot">
            <input
              className={danobatInput}
              value={form.designation}
              onChange={(e) => set("designation", e.target.value)}
              disabled={!canEdit}
            />
          </Field>
          <Field label="Marché initial H.T. (€)">
            <input
              type="number"
              step="0.01"
              className={danobatInput}
              value={form.contract_amount_ht}
              onChange={(e) => set("contract_amount_ht", e.target.value)}
              disabled={!canEdit}
            />
          </Field>
          <Field label="TVA (%)">
            <input
              type="number"
              step="0.01"
              className={danobatInput}
              value={form.vat_rate}
              onChange={(e) => set("vat_rate", e.target.value)}
              disabled={!canEdit}
            />
          </Field>
          <Field label="Prorata (%)" hint="Ex. 1,5 pour 1,5 %">
            <input
              type="number"
              step="0.001"
              className={danobatInput}
              value={form.prorata_percent}
              onChange={(e) => set("prorata_percent", e.target.value)}
              disabled={!canEdit}
            />
          </Field>
          <Field label="Avancement max. avant DGD (%)">
            <input
              type="number"
              step="0.01"
              className={danobatInput}
              value={form.avancement_max_avant_dgd}
              onChange={(e) => set("avancement_max_avant_dgd", e.target.value)}
              disabled={!canEdit}
            />
          </Field>
        </div>
      </div>

      {/* Partie à remplir par l'entreprise (grisée) */}
      <div className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/70 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
              À remplir par l'entreprise
            </p>
            <p className="mt-1 text-sm text-slate-500">
              Ces informations sont normalement complétées par l'entreprise en début
              d'opération. Vous (DANOBAT) pouvez les renseigner vous-même si besoin.
            </p>
          </div>
          {canEdit && directory.length > 0 && (
            <div className="w-full sm:w-64">
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Pré-remplir depuis la base entreprises
              </label>
              <select
                className={danobatInput}
                defaultValue=""
                onChange={(e) => applyDirectory(e.target.value)}
                disabled={isPending}
              >
                <option value="">Sélectionner une entreprise…</option>
                {directory.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                    {d.siret ? ` (${d.siret})` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        <div className="grid gap-4">
          <div>
            <label className={labelClass}>Adresse postale</label>
            <div className="grid gap-3 sm:grid-cols-3">
              <input
                className={enterpriseInput}
                placeholder="N° et rue"
                value={form.enterprise_address}
                onChange={(e) => set("enterprise_address", e.target.value)}
                disabled={!canEdit}
              />
              <input
                className={enterpriseInput}
                placeholder="Code postal"
                value={form.enterprise_postal_code}
                onChange={(e) => set("enterprise_postal_code", e.target.value)}
                disabled={!canEdit}
              />
              <input
                className={enterpriseInput}
                placeholder="Ville"
                value={form.enterprise_city}
                onChange={(e) => set("enterprise_city", e.target.value)}
                disabled={!canEdit}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Field label="Adresse mail administratif">
              <input
                type="email"
                className={enterpriseInput}
                value={form.email_administratif}
                onChange={(e) => set("email_administratif", e.target.value)}
                disabled={!canEdit}
              />
            </Field>
            <Field label="Adresse mail comptabilité">
              <input
                type="email"
                className={enterpriseInput}
                value={form.email_comptabilite}
                onChange={(e) => set("email_comptabilite", e.target.value)}
                disabled={!canEdit}
              />
            </Field>
            <Field label="Adresse mail suivi des travaux">
              <input
                type="email"
                className={enterpriseInput}
                value={form.email_travaux}
                onChange={(e) => set("email_travaux", e.target.value)}
                disabled={!canEdit}
              />
            </Field>
            <Field label="Adresse mail bureau d'études">
              <input
                type="email"
                className={enterpriseInput}
                value={form.email_bureau_etudes}
                onChange={(e) => set("email_bureau_etudes", e.target.value)}
                disabled={!canEdit}
              />
            </Field>
            <Field label="Adresse mail signataire">
              <input
                type="email"
                className={enterpriseInput}
                value={form.email_signataire}
                onChange={(e) => set("email_signataire", e.target.value)}
                disabled={!canEdit}
              />
            </Field>
            <Field label="Signataire — Nom + Prénom">
              <input
                className={enterpriseInput}
                value={form.signataire_name}
                onChange={(e) => set("signataire_name", e.target.value)}
                disabled={!canEdit}
              />
            </Field>
            <Field label="N° SIRET" hint="Clé de la base entreprises (auto-remplissage)">
              <input
                className={enterpriseInput}
                value={form.siret}
                onChange={(e) => set("siret", e.target.value)}
                disabled={!canEdit}
              />
            </Field>
            <Field label="Adresse mail SAV">
              <input
                type="email"
                className={enterpriseInput}
                value={form.email_sav}
                onChange={(e) => set("email_sav", e.target.value)}
                disabled={!canEdit}
              />
            </Field>
            <Field label="N° téléphone Accueil">
              <input
                className={enterpriseInput}
                value={form.phone_accueil}
                onChange={(e) => set("phone_accueil", e.target.value)}
                disabled={!canEdit}
              />
            </Field>
            <Field label="N° téléphone Travaux">
              <input
                className={enterpriseInput}
                value={form.phone_travaux}
                onChange={(e) => set("phone_travaux", e.target.value)}
                disabled={!canEdit}
              />
            </Field>
          </div>
          <LogoUploader
            label="Logo de l'entreprise"
            currentPath={enterprise.logo_path}
            onUpload={onUploadLogo}
            disabled={!canEdit}
          />
        </div>
      </div>

      {canEdit && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={save}
            disabled={isPending}
            className="rounded-xl bg-emerald-600 px-5 py-2.5 font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {isPending ? "Enregistrement…" : "Enregistrer la fiche entreprise"}
          </button>
          {message && <span className="text-sm font-medium text-emerald-700">{message}</span>}
          {error && <span className="text-sm font-medium text-red-700">{error}</span>}
        </div>
      )}
    </div>
  );
}
