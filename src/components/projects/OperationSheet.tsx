"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AutocompleteInput } from "@/components/projects/AutocompleteInput";
import { EmailFieldWithInvite } from "@/components/projects/EmailFieldWithInvite";
import { SharePointPathSettings } from "@/components/projects/SharePointPathSettings";
import { uploadOperationPhoto } from "@/lib/actions/finance";
import {
  createEnterpriseOnProject,
  updateEnterpriseSheet,
  updateOperationSheet,
  uploadOperationLogo,
  type LogoTarget,
} from "@/lib/actions/operation-sheet";
import type {
  CompanyDirectoryEntry,
  Enterprise,
  OwnerDirectoryEntry,
  Project,
} from "@/lib/types/database";

type OperationSheetProps = {
  project: Project;
  enterprises: Enterprise[];
  directory: CompanyDirectoryEntry[];
  ownerDirectory: OwnerDirectoryEntry[];
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
  className = "",
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}
    >
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
  ownerDirectory,
  canEdit,
}: OperationSheetProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  const ownerOptions = useMemo(
    () =>
      ownerDirectory.map((o) => ({
        id: o.id,
        label: o.name,
        data: o,
      })),
    [ownerDirectory]
  );

  function applyOwner(entry: OwnerDirectoryEntry) {
    setOp((prev) => ({
      ...prev,
      owner_name: entry.name,
      owner_address: entry.address ?? "",
      owner_postal_code: entry.postal_code ?? "",
      owner_city: entry.city ?? "",
      owner_email_admin: entry.email_admin ?? "",
      owner_email_works: entry.email_works ?? "",
      owner_signatory_name: entry.signatory_name ?? "",
      owner_signatory_email: entry.signatory_email ?? "",
      owner_doc_marche: entry.doc_marche,
      owner_doc_os: entry.doc_os,
      owner_doc_ae: entry.doc_ae,
      owner_doc_avenant: entry.doc_avenant,
    }));
  }

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

  const [selectedId, setSelectedId] = useState<string>(enterprises[0]?.id ?? "");
  const selected = useMemo(
    () => enterprises.find((e) => e.id === selectedId) ?? null,
    [enterprises, selectedId]
  );

  function handleNewEnterprise() {
    const name = prompt("Nom de la nouvelle entreprise :");
    if (!name?.trim()) return;
    startTransition(async () => {
      try {
        const id = await createEnterpriseOnProject(project.id, name);
        setSelectedId(id);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-3">
        <SectionCard title="Opération" subtitle="Renseigné par DANOBAT.">
          <div className="grid gap-3">
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
              <div className="grid gap-2 sm:grid-cols-3">
                <input className={danobatInput} placeholder="N° et rue" value={op.address} onChange={(e) => setOpField("address", e.target.value)} disabled={!canEdit} />
                <input className={danobatInput} placeholder="CP" value={op.postal_code} onChange={(e) => setOpField("postal_code", e.target.value)} disabled={!canEdit} />
                <input className={danobatInput} placeholder="Ville" value={op.city} onChange={(e) => setOpField("city", e.target.value)} disabled={!canEdit} />
              </div>
            </div>
            <OperationPhoto project={project} disabled={!canEdit} onDone={() => router.refresh()} />
          </div>
        </SectionCard>

        <SectionCard title="Maître d'ouvrage" subtitle="Renseigné par DANOBAT. Auto-complétion depuis les autres opérations.">
          <div className="grid gap-3">
            <Field label="Nom du maître d'ouvrage">
              <AutocompleteInput
                value={op.owner_name}
                onChange={(v) => setOpField("owner_name", v)}
                onSelect={(opt) => applyOwner(opt.data)}
                options={ownerOptions}
                disabled={!canEdit}
                className={danobatInput}
                placeholder="Rechercher ou saisir…"
              />
            </Field>
            <div>
              <label className={labelClass}>Adresse postale</label>
              <div className="grid gap-2 sm:grid-cols-3">
                <input className={danobatInput} placeholder="N° et rue" value={op.owner_address} onChange={(e) => setOpField("owner_address", e.target.value)} disabled={!canEdit} />
                <input className={danobatInput} placeholder="CP" value={op.owner_postal_code} onChange={(e) => setOpField("owner_postal_code", e.target.value)} disabled={!canEdit} />
                <input className={danobatInput} placeholder="Ville" value={op.owner_city} onChange={(e) => setOpField("owner_city", e.target.value)} disabled={!canEdit} />
              </div>
            </div>
            <Field label="Adresse mail administratif">
              <EmailFieldWithInvite value={op.owner_email_admin} onChange={(v) => setOpField("owner_email_admin", v)} projectId={project.id} inviteContext={{ type: "platform" }} disabled={!canEdit} inputClassName={danobatInput} />
            </Field>
            <Field label="Adresse mail suivi des travaux">
              <EmailFieldWithInvite value={op.owner_email_works} onChange={(v) => setOpField("owner_email_works", v)} projectId={project.id} inviteContext={{ type: "platform" }} disabled={!canEdit} inputClassName={danobatInput} />
            </Field>
            <Field label="Signataire — Nom + Prénom">
              <input className={danobatInput} value={op.owner_signatory_name} onChange={(e) => setOpField("owner_signatory_name", e.target.value)} disabled={!canEdit} />
            </Field>
            <Field label="Signataire — Adresse mail">
              <EmailFieldWithInvite value={op.owner_signatory_email} onChange={(v) => setOpField("owner_signatory_email", v)} projectId={project.id} inviteContext={{ type: "platform" }} disabled={!canEdit} inputClassName={danobatInput} />
            </Field>
            <LogoUploader label="Logo du maître d'ouvrage" currentPath={project.owner_logo_path} onUpload={(fd) => uploadLogo("owner", fd)} disabled={!canEdit} />
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="mb-2 text-xs font-semibold text-slate-600">Documents types</p>
              <div className="flex flex-wrap gap-3">
                {([["owner_doc_marche", "Marché"], ["owner_doc_os", "OS"], ["owner_doc_ae", "AE"], ["owner_doc_avenant", "Avenant"]] as const).map(([key, lab]) => (
                  <label key={key} className="flex items-center gap-1.5 text-sm text-slate-700">
                    <input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={op[key] as boolean} onChange={(e) => setOpField(key, e.target.checked as never)} disabled={!canEdit} />
                    {lab}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Maître d'œuvre — DANOBAT" subtitle="Renseigné par DANOBAT.">
          <div className="grid gap-3">
            <div>
              <label className={labelClass}>Adresse postale</label>
              <div className="grid gap-2 sm:grid-cols-3">
                <input className={danobatInput} placeholder="N° et rue" value={op.moe_address} onChange={(e) => setOpField("moe_address", e.target.value)} disabled={!canEdit} />
                <input className={danobatInput} placeholder="CP" value={op.moe_postal_code} onChange={(e) => setOpField("moe_postal_code", e.target.value)} disabled={!canEdit} />
                <input className={danobatInput} placeholder="Ville" value={op.moe_city} onChange={(e) => setOpField("moe_city", e.target.value)} disabled={!canEdit} />
              </div>
            </div>
            <Field label="Adresse mail administratif">
              <EmailFieldWithInvite value={op.moe_email_admin} onChange={(v) => setOpField("moe_email_admin", v)} projectId={project.id} inviteContext={{ type: "platform" }} disabled={!canEdit} inputClassName={danobatInput} />
            </Field>
            <Field label="Adresse mail suivi des travaux">
              <EmailFieldWithInvite value={op.moe_email_works} onChange={(v) => setOpField("moe_email_works", v)} projectId={project.id} inviteContext={{ type: "platform" }} disabled={!canEdit} inputClassName={danobatInput} />
            </Field>
            <LogoUploader label="Logo DANOBAT" currentPath={project.moe_logo_path} onUpload={(fd) => uploadLogo("moe", fd)} disabled={!canEdit} />
          </div>
        </SectionCard>
      </div>

      <SharePointPathSettings project={project} canEdit={canEdit} />

      {canEdit && (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={saveProject} disabled={isPending} className="rounded-xl bg-emerald-600 px-5 py-2.5 font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">
            {isPending ? "Enregistrement…" : "Enregistrer l'opération, le MOA et le MOE"}
          </button>
          {message && <span className="text-sm font-medium text-emerald-700">{message}</span>}
          {error && <span className="text-sm font-medium text-red-700">{error}</span>}
        </div>
      )}

      <SectionCard title="Entreprise" subtitle="Une fiche par entreprise.">
        <div className="mb-4 flex flex-wrap items-end gap-3">
          {enterprises.length > 0 && (
            <div className="min-w-[16rem] flex-1">
              <label className={labelClass}>Sélectionner</label>
              <select className={danobatInput} value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
                {enterprises.map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.lot_number ? `Lot ${e.lot_number} — ` : ""}{e.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          {canEdit && (
            <button type="button" onClick={handleNewEnterprise} disabled={isPending} className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-100 disabled:opacity-50">
              + Nouvelle entreprise
            </button>
          )}
        </div>

        {enterprises.length === 0 ? (
          <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
            Aucune entreprise. Cliquez sur « Nouvelle entreprise » pour commencer.
          </p>
        ) : selected ? (
          <EnterpriseSheetForm
            key={selected.id}
            projectId={project.id}
            enterprise={selected}
            directory={directory}
            canEdit={canEdit}
            onUploadLogo={(fd) => uploadLogo("enterprise", fd, selected.id)}
            onSaved={() => router.refresh()}
          />
        ) : null}
      </SectionCard>
    </div>
  );
}

function OperationPhoto({ project, disabled, onDone }: { project: Project; disabled: boolean; onDone: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(logoUrl(project.operation_photo_path));

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
      <label className={labelClass}>Photo de l&apos;opération</label>
      <div className="flex items-center gap-3">
        <div className="flex h-20 w-28 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-slate-50">
          {preview ? <img src={preview} alt="Opération" className="h-full w-full object-cover" /> : <span className="text-[10px] text-slate-400">Aucune</span>}
        </div>
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleChange} disabled={disabled || busy} />
        <button type="button" onClick={() => inputRef.current?.click()} disabled={disabled || busy} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
          {busy ? "Envoi…" : "Choisir une photo"}
        </button>
      </div>
    </div>
  );
}

function applyCompanyAdminFields(
  dir: CompanyDirectoryEntry,
  setForm: React.Dispatch<React.SetStateAction<EnterpriseFormState>>
) {
  setForm((prev) => ({
    ...prev,
    name: dir.name,
    enterprise_address: dir.address ?? "",
    enterprise_postal_code: dir.postal_code ?? "",
    enterprise_city: dir.city ?? "",
    email_administratif: dir.email_administratif ?? "",
    email_comptabilite: dir.email_comptabilite ?? "",
    email_travaux: dir.email_travaux ?? "",
    email_bureau_etudes: dir.email_bureau_etudes ?? "",
    email_signataire: dir.email_signataire ?? "",
    signataire_name: dir.signataire_name ?? "",
    siret: dir.siret ?? "",
    email_sav: dir.email_sav ?? "",
    phone_accueil: dir.phone_accueil ?? "",
    phone_travaux: dir.phone_travaux ?? "",
  }));
}

type EnterpriseFormState = {
  name: string;
  lot_number: string;
  designation: string;
  contract_amount_ht: string;
  vat_rate: string;
  prorata_percent: string;
  avancement_max_avant_dgd: string;
  enterprise_address: string;
  enterprise_postal_code: string;
  enterprise_city: string;
  email_administratif: string;
  email_comptabilite: string;
  email_travaux: string;
  email_bureau_etudes: string;
  email_signataire: string;
  signataire_name: string;
  siret: string;
  email_sav: string;
  phone_accueil: string;
  phone_travaux: string;
};

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

  const [form, setForm] = useState<EnterpriseFormState>({
    name: enterprise.name ?? "",
    lot_number: enterprise.lot_number ?? "",
    designation: enterprise.designation ?? "",
    contract_amount_ht: String(enterprise.contract_amount_ht ?? 0),
    vat_rate: String(enterprise.vat_rate ?? 20),
    prorata_percent: String(Number(((Number(enterprise.prorata_percent) || 0) * 100).toFixed(3))),
    avancement_max_avant_dgd: String(enterprise.avancement_max_avant_dgd ?? 95),
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

  const set = <K extends keyof EnterpriseFormState>(k: K, v: EnterpriseFormState[K]) =>
    setForm((prev) => ({ ...prev, [k]: v }));

  const companyOptions = useMemo(
    () => directory.map((d) => ({ id: d.id, label: d.name + (d.siret ? ` (${d.siret})` : ""), data: d })),
    [directory]
  );

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
        setError(err instanceof Error ? err.message : "Erreur.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Renseigné par DANOBAT</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <Field label="Nom de l'entreprise">
            <AutocompleteInput
              value={form.name}
              onChange={(v) => set("name", v)}
              onSelect={(opt) => applyCompanyAdminFields(opt.data, setForm)}
              options={companyOptions}
              disabled={!canEdit}
              className={danobatInput}
              placeholder="Rechercher…"
            />
          </Field>
          <Field label="N° du lot"><input className={danobatInput} value={form.lot_number} onChange={(e) => set("lot_number", e.target.value)} disabled={!canEdit} /></Field>
          <Field label="Intitulé du lot"><input className={danobatInput} value={form.designation} onChange={(e) => set("designation", e.target.value)} disabled={!canEdit} /></Field>
          <Field label="Marché initial H.T. (€)"><input type="number" step="0.01" className={danobatInput} value={form.contract_amount_ht} onChange={(e) => set("contract_amount_ht", e.target.value)} disabled={!canEdit} /></Field>
          <Field label="TVA (%)"><input type="number" step="0.01" className={danobatInput} value={form.vat_rate} onChange={(e) => set("vat_rate", e.target.value)} disabled={!canEdit} /></Field>
          <Field label="Prorata (%)"><input type="number" step="0.001" className={danobatInput} value={form.prorata_percent} onChange={(e) => set("prorata_percent", e.target.value)} disabled={!canEdit} /></Field>
          <Field label="Avanc. max avant DGD (%)"><input type="number" step="0.01" className={danobatInput} value={form.avancement_max_avant_dgd} onChange={(e) => set("avancement_max_avant_dgd", e.target.value)} disabled={!canEdit} /></Field>
        </div>
      </div>

      <div className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/70 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">À remplir par l&apos;entreprise</p>
        <p className="mt-1 mb-3 text-sm text-slate-500">Normalement complété par l&apos;entreprise en début d&apos;opération. DANOBAT peut renseigner si besoin.</p>
        <div className="grid gap-3">
          <div>
            <label className={labelClass}>Adresse postale</label>
            <div className="grid gap-2 sm:grid-cols-3">
              <input className={enterpriseInput} placeholder="N° et rue" value={form.enterprise_address} onChange={(e) => set("enterprise_address", e.target.value)} disabled={!canEdit} />
              <input className={enterpriseInput} placeholder="CP" value={form.enterprise_postal_code} onChange={(e) => set("enterprise_postal_code", e.target.value)} disabled={!canEdit} />
              <input className={enterpriseInput} placeholder="Ville" value={form.enterprise_city} onChange={(e) => set("enterprise_city", e.target.value)} disabled={!canEdit} />
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <Field label="Mail administratif"><EmailFieldWithInvite value={form.email_administratif} onChange={(v) => set("email_administratif", v)} projectId={projectId} inviteContext={{ type: "enterprise", enterpriseId: enterprise.id }} disabled={!canEdit} inputClassName={enterpriseInput} /></Field>
            <Field label="Mail comptabilité"><EmailFieldWithInvite value={form.email_comptabilite} onChange={(v) => set("email_comptabilite", v)} projectId={projectId} inviteContext={{ type: "enterprise", enterpriseId: enterprise.id }} disabled={!canEdit} inputClassName={enterpriseInput} /></Field>
            <Field label="Mail suivi travaux"><EmailFieldWithInvite value={form.email_travaux} onChange={(v) => set("email_travaux", v)} projectId={projectId} inviteContext={{ type: "enterprise", enterpriseId: enterprise.id }} disabled={!canEdit} inputClassName={enterpriseInput} /></Field>
            <Field label="Mail bureau d'études"><EmailFieldWithInvite value={form.email_bureau_etudes} onChange={(v) => set("email_bureau_etudes", v)} projectId={projectId} inviteContext={{ type: "enterprise", enterpriseId: enterprise.id }} disabled={!canEdit} inputClassName={enterpriseInput} /></Field>
            <Field label="Mail signataire"><EmailFieldWithInvite value={form.email_signataire} onChange={(v) => set("email_signataire", v)} projectId={projectId} inviteContext={{ type: "enterprise", enterpriseId: enterprise.id }} disabled={!canEdit} inputClassName={enterpriseInput} /></Field>
            <Field label="Signataire"><input className={enterpriseInput} value={form.signataire_name} onChange={(e) => set("signataire_name", e.target.value)} disabled={!canEdit} /></Field>
            <Field label="N° SIRET"><input className={enterpriseInput} value={form.siret} onChange={(e) => set("siret", e.target.value)} disabled={!canEdit} /></Field>
            <Field label="Mail SAV"><EmailFieldWithInvite value={form.email_sav} onChange={(v) => set("email_sav", v)} projectId={projectId} inviteContext={{ type: "enterprise", enterpriseId: enterprise.id }} disabled={!canEdit} inputClassName={enterpriseInput} /></Field>
            <Field label="Tél. Accueil"><input className={enterpriseInput} value={form.phone_accueil} onChange={(e) => set("phone_accueil", e.target.value)} disabled={!canEdit} /></Field>
            <Field label="Tél. Travaux"><input className={enterpriseInput} value={form.phone_travaux} onChange={(e) => set("phone_travaux", e.target.value)} disabled={!canEdit} /></Field>
          </div>
          <LogoUploader label="Logo entreprise" currentPath={enterprise.logo_path} onUpload={onUploadLogo} disabled={!canEdit} />
        </div>
      </div>

      {canEdit && (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={save} disabled={isPending} className="rounded-xl bg-emerald-600 px-5 py-2.5 font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">
            {isPending ? "Enregistrement…" : "Enregistrer la fiche entreprise"}
          </button>
          {message && <span className="text-sm font-medium text-emerald-700">{message}</span>}
          {error && <span className="text-sm font-medium text-red-700">{error}</span>}
        </div>
      )}
    </div>
  );
}
