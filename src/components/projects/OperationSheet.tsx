"use client";

import { useMemo, useRef, useState, useTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AutocompleteInput } from "@/components/projects/AutocompleteInput";
import { EmailFieldWithInvite } from "@/components/projects/EmailFieldWithInvite";
import { SharePointPathSettings } from "@/components/projects/SharePointPathSettings";
import { FormattedNumberInput } from "@/components/ui/FormattedNumberInput";
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
import {
  dirtyTextClass,
  validateEmail,
  validatePercent,
  validatePhone,
  validatePostalCode,
  validateSiret,
} from "@/lib/validation/fields";

type OperationSheetProps = {
  project: Project;
  enterprises: Enterprise[];
  directory: CompanyDirectoryEntry[];
  ownerDirectory: OwnerDirectoryEntry[];
  canEdit: boolean;
  isOperationConfigured: boolean;
  invitationMap?: Record<string, Record<string, string>>;
  onDirtyChange?: (dirty: boolean) => void;
};

type OperationFormState = {
  name: string;
  description: string;
  address: string;
  postal_code: string;
  city: string;
  owner_name: string;
  owner_address: string;
  owner_postal_code: string;
  owner_city: string;
  owner_email_admin: string;
  owner_email_works: string;
  owner_signatory_name: string;
  owner_signatory_email: string;
  owner_doc_marche: boolean;
  owner_doc_os: boolean;
  owner_doc_ae: boolean;
  owner_doc_avenant: boolean;
  moe_address: string;
  moe_postal_code: string;
  moe_city: string;
  moe_email_admin: string;
  moe_email_works: string;
};

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

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
const labelClass = "mb-1.5 block text-sm font-semibold text-slate-700";
const danobatInput =
  "w-full rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-2.5 text-base focus:border-slate-400 focus:bg-white focus:outline-none";
const enterpriseInput =
  "w-full rounded-xl border-2 border-dashed border-slate-300 bg-slate-100 px-4 py-2.5 text-base placeholder:text-slate-400 focus:border-blue-400 focus:bg-white focus:outline-none";

function logoUrl(path: string | null | undefined) {
  return path
    ? `${SUPABASE_URL}/storage/v1/object/public/financial-files/${path}`
    : null;
}

function operationForm(project: Project): OperationFormState {
  return {
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
  };
}

function enterpriseForm(enterprise: Enterprise): EnterpriseFormState {
  return {
    name: enterprise.name ?? "",
    lot_number: enterprise.lot_number ?? "",
    designation: enterprise.designation ?? "",
    contract_amount_ht: String(enterprise.contract_amount_ht ?? 0),
    vat_rate: String(enterprise.vat_rate ?? 20),
    prorata_percent: String(
      Number(((Number(enterprise.prorata_percent) || 0) * 100).toFixed(3))
    ),
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
  };
}

function Field({
  label,
  children,
  error,
}: {
  label: string;
  children: React.ReactNode;
  error?: string | null;
}) {
  return (
    <div>
      <label className={labelClass}>{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
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
    <section className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
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

  async function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      await onUpload(formData);
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
        <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleChange} disabled={disabled || busy} />
        <button type="button" onClick={() => inputRef.current?.click()} disabled={disabled || busy} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50">
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
  isOperationConfigured = project.is_operation_configured,
  invitationMap = {},
  onDirtyChange,
}: OperationSheetProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [op, setOp] = useState(() => operationForm(project));
  const [savedOp, setSavedOp] = useState(() => operationForm(project));
  const [opErrors, setOpErrors] = useState<Partial<Record<keyof OperationFormState, string | null>>>({});
  const [selectedId, setSelectedId] = useState(enterprises[0]?.id ?? "");
  const [showNewEnterprise, setShowNewEnterprise] = useState(false);
  const [newEnterpriseName, setNewEnterpriseName] = useState("");
  const [enterpriseDirty, setEnterpriseDirty] = useState(false);

  useEffect(() => {
    setEnterpriseDirty(false);
  }, [selectedId]);

  const ownerOptions = useMemo(
    () => ownerDirectory.map((entry) => ({ id: entry.id, label: entry.name, data: entry })),
    [ownerDirectory]
  );
  const selected = useMemo(
    () => enterprises.find((enterprise) => enterprise.id === selectedId) ?? null,
    [enterprises, selectedId]
  );
  const configuredEditing = canEdit && isOperationConfigured;

  const opDirty = useMemo(
    () => JSON.stringify(op) !== JSON.stringify(savedOp),
    [op, savedOp]
  );

  useEffect(() => {
    onDirtyChange?.(opDirty || enterpriseDirty);
  }, [opDirty, enterpriseDirty, onDirtyChange]);

  const setOpField = <K extends keyof OperationFormState>(key: K, value: OperationFormState[K]) =>
    setOp((current) => ({ ...current, [key]: value }));
  const opInputClass = <K extends keyof OperationFormState>(key: K) =>
    `${danobatInput} ${dirtyTextClass(String(op[key]), String(savedOp[key]), !canEdit)}`;

  function validateOpField<K extends keyof OperationFormState>(
    key: K,
    validator: (value: string) => string | null
  ) {
    setOpErrors((current) => ({ ...current, [key]: validator(String(op[key])) }));
  }

  function applyOwner(entry: OwnerDirectoryEntry) {
    setOp((current) => ({
      ...current,
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
        setSavedOp(op);
        setMessage(isOperationConfigured ? "Fiche opération enregistrée." : "Opération créée.");
        router.refresh();
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Erreur lors de l'enregistrement.");
      }
    });
  }

  async function uploadLogo(target: LogoTarget, formData: FormData, enterpriseId?: string) {
    await uploadOperationLogo(project.id, target, formData, enterpriseId);
    router.refresh();
  }

  function addEnterprise() {
    setError(null);
    const name = newEnterpriseName.trim();
    if (!name) {
      setError("Le nom de l'entreprise est obligatoire.");
      return;
    }
    startTransition(async () => {
      try {
        const id = await createEnterpriseOnProject(project.id, name);
        setSelectedId(id);
        setNewEnterpriseName("");
        setShowNewEnterprise(false);
        router.refresh();
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Erreur lors de la création.");
      }
    });
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-3">
        <SectionCard title="Opération" subtitle="Renseigné par DANOBAT.">
          <div className="grid gap-3">
            <Field label="Nom de l'opération">
              <input className={opInputClass("name")} value={op.name} onChange={(event) => setOpField("name", event.target.value)} disabled={!canEdit} />
            </Field>
            <Field label="Descriptif opération">
              <textarea className={opInputClass("description")} rows={2} value={op.description} onChange={(event) => setOpField("description", event.target.value)} disabled={!canEdit} />
            </Field>
            <div>
              <label className={labelClass}>Adresse opération</label>
              <div className="grid gap-2">
                <input className={opInputClass("address")} placeholder="N° et rue" value={op.address} onChange={(event) => setOpField("address", event.target.value)} disabled={!canEdit} />
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <input className={opInputClass("postal_code")} placeholder="CP" value={op.postal_code} onChange={(event) => setOpField("postal_code", event.target.value)} onBlur={() => validateOpField("postal_code", validatePostalCode)} disabled={!canEdit} />
                    {opErrors.postal_code && <p className="mt-1 text-xs text-red-600">{opErrors.postal_code}</p>}
                  </div>
                  <input className={opInputClass("city")} placeholder="Ville" value={op.city} onChange={(event) => setOpField("city", event.target.value)} disabled={!canEdit} />
                </div>
              </div>
            </div>
            <OperationPhoto project={project} disabled={!canEdit} onDone={() => router.refresh()} />
          </div>
        </SectionCard>

        <SectionCard title="Maître d'ouvrage" subtitle="Renseigné par DANOBAT. Auto-complétion depuis les autres opérations." className={!isOperationConfigured ? "pointer-events-none opacity-50" : ""}>
          <div className="grid gap-3">
            <Field label="Nom du maître d'ouvrage">
              <AutocompleteInput value={op.owner_name} onChange={(value) => setOpField("owner_name", value)} onSelect={(option) => applyOwner(option.data)} options={ownerOptions} disabled={!configuredEditing} className={opInputClass("owner_name")} placeholder="Rechercher ou saisir…" />
            </Field>
            <div>
              <label className={labelClass}>Adresse postale</label>
              <div className="grid gap-2">
                <input className={opInputClass("owner_address")} placeholder="N° et rue" value={op.owner_address} onChange={(event) => setOpField("owner_address", event.target.value)} disabled={!configuredEditing} />
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <input className={opInputClass("owner_postal_code")} placeholder="CP" value={op.owner_postal_code} onChange={(event) => setOpField("owner_postal_code", event.target.value)} onBlur={() => validateOpField("owner_postal_code", validatePostalCode)} disabled={!configuredEditing} />
                    {opErrors.owner_postal_code && <p className="mt-1 text-xs text-red-600">{opErrors.owner_postal_code}</p>}
                  </div>
                  <input className={opInputClass("owner_city")} placeholder="Ville" value={op.owner_city} onChange={(event) => setOpField("owner_city", event.target.value)} disabled={!configuredEditing} />
                </div>
              </div>
            </div>
            <Field label="Adresse mail administratif" error={opErrors.owner_email_admin}>
              <input type="email" className={opInputClass("owner_email_admin")} value={op.owner_email_admin} onChange={(event) => setOpField("owner_email_admin", event.target.value)} onBlur={() => validateOpField("owner_email_admin", validateEmail)} disabled={!configuredEditing} />
            </Field>
            <Field label="Adresse mail suivi des travaux" error={opErrors.owner_email_works}>
              <input type="email" className={opInputClass("owner_email_works")} value={op.owner_email_works} onChange={(event) => setOpField("owner_email_works", event.target.value)} onBlur={() => validateOpField("owner_email_works", validateEmail)} disabled={!configuredEditing} />
            </Field>
            <Field label="Signataire — Nom + Prénom">
              <input className={opInputClass("owner_signatory_name")} value={op.owner_signatory_name} onChange={(event) => setOpField("owner_signatory_name", event.target.value)} disabled={!configuredEditing} />
            </Field>
            <Field label="Signataire — Adresse mail" error={opErrors.owner_signatory_email}>
              <input type="email" className={opInputClass("owner_signatory_email")} value={op.owner_signatory_email} onChange={(event) => setOpField("owner_signatory_email", event.target.value)} onBlur={() => validateOpField("owner_signatory_email", validateEmail)} disabled={!configuredEditing} />
            </Field>
            <LogoUploader label="Logo du maître d'ouvrage" currentPath={project.owner_logo_path} onUpload={(formData) => uploadLogo("owner", formData)} disabled={!configuredEditing} />
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="mb-2 text-xs font-semibold text-slate-600">Documents types</p>
              <div className="flex flex-wrap gap-3">
                {([["owner_doc_marche", "Marché"], ["owner_doc_os", "OS"], ["owner_doc_ae", "AE"], ["owner_doc_avenant", "Avenant"]] as const).map(([key, label]) => (
                  <label key={key} className="flex items-center gap-1.5 text-sm text-slate-700">
                    <input type="checkbox" className="h-4 w-4 rounded border-slate-300" checked={op[key]} onChange={(event) => setOpField(key, event.target.checked)} disabled={!configuredEditing} />
                    {label}
                  </label>
                ))}
              </div>
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Maître d'œuvre — DANOBAT" subtitle="Renseigné par DANOBAT." className={!isOperationConfigured ? "pointer-events-none opacity-50" : ""}>
          <div className="grid gap-3">
            <div>
              <label className={labelClass}>Adresse postale</label>
              <div className="grid gap-2">
                <input className={opInputClass("moe_address")} placeholder="N° et rue" value={op.moe_address} onChange={(event) => setOpField("moe_address", event.target.value)} disabled={!configuredEditing} />
                <div className="grid gap-2 sm:grid-cols-2">
                  <div>
                    <input className={opInputClass("moe_postal_code")} placeholder="CP" value={op.moe_postal_code} onChange={(event) => setOpField("moe_postal_code", event.target.value)} onBlur={() => validateOpField("moe_postal_code", validatePostalCode)} disabled={!configuredEditing} />
                    {opErrors.moe_postal_code && <p className="mt-1 text-xs text-red-600">{opErrors.moe_postal_code}</p>}
                  </div>
                  <input className={opInputClass("moe_city")} placeholder="Ville" value={op.moe_city} onChange={(event) => setOpField("moe_city", event.target.value)} disabled={!configuredEditing} />
                </div>
              </div>
            </div>
            <Field label="Adresse mail administratif" error={opErrors.moe_email_admin}>
              <input type="email" className={opInputClass("moe_email_admin")} value={op.moe_email_admin} onChange={(event) => setOpField("moe_email_admin", event.target.value)} onBlur={() => validateOpField("moe_email_admin", validateEmail)} disabled={!configuredEditing} />
            </Field>
            <Field label="Adresse mail suivi des travaux" error={opErrors.moe_email_works}>
              <input type="email" className={opInputClass("moe_email_works")} value={op.moe_email_works} onChange={(event) => setOpField("moe_email_works", event.target.value)} onBlur={() => validateOpField("moe_email_works", validateEmail)} disabled={!configuredEditing} />
            </Field>
            <LogoUploader label="Logo DANOBAT" currentPath={project.moe_logo_path} onUpload={(formData) => uploadLogo("moe", formData)} disabled={!configuredEditing} />
          </div>
        </SectionCard>
      </div>

      <div className={!isOperationConfigured ? "pointer-events-none opacity-50" : ""}>
        <SharePointPathSettings project={project} canEdit={canEdit && isOperationConfigured} />
      </div>

      {canEdit && (
        <div className="flex flex-wrap items-center gap-3">
          <button type="button" onClick={saveProject} disabled={isPending} className="rounded-xl bg-emerald-600 px-5 py-2.5 font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">
            {isPending ? "Enregistrement…" : isOperationConfigured ? "Enregistrer l'opération, le MOA et le MOE" : "Créer opération"}
          </button>
          {message && <span className="text-sm font-medium text-emerald-700">{message}</span>}
          {error && <span className="text-sm font-medium text-red-700">{error}</span>}
        </div>
      )}

      <div className={!isOperationConfigured ? "pointer-events-none opacity-50" : ""}>
        <SectionCard title="Entreprise" subtitle="Une fiche par entreprise.">
          <div className="mb-4 flex flex-wrap items-end gap-3">
            {enterprises.length > 0 && (
              <div className="min-w-[16rem] flex-1">
                <label className={labelClass}>Sélectionner</label>
                <select className={`${danobatInput} text-slate-900`} value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
                  {enterprises.map((enterprise) => (
                    <option key={enterprise.id} value={enterprise.id}>
                      {enterprise.lot_number ? `Lot ${enterprise.lot_number} — ` : ""}{enterprise.name}
                    </option>
                  ))}
                </select>
              </div>
            )}
            {configuredEditing && !showNewEnterprise && (
              <button type="button" onClick={() => setShowNewEnterprise(true)} className="rounded-xl border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-800 hover:bg-emerald-100">
                + Nouvelle entreprise
              </button>
            )}
          </div>

          {showNewEnterprise && (
            <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <div className="min-w-[16rem] flex-1">
                <label className={labelClass}>Nom de la nouvelle entreprise</label>
                <input className={`${danobatInput} text-slate-900`} value={newEnterpriseName} onChange={(event) => setNewEnterpriseName(event.target.value)} disabled={isPending} />
              </div>
              <button type="button" onClick={addEnterprise} disabled={isPending} className="rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-emerald-500 disabled:opacity-50">
                Ajouter
              </button>
              <button type="button" onClick={() => setShowNewEnterprise(false)} disabled={isPending} className="px-3 py-2.5 text-sm font-medium text-slate-600 hover:text-slate-900">
                Annuler
              </button>
            </div>
          )}

          {enterprises.length === 0 ? (
            <p className="rounded-xl bg-slate-50 px-4 py-3 text-sm text-slate-500">Aucune entreprise. Cliquez sur « Nouvelle entreprise » pour commencer.</p>
          ) : selected ? (
            <EnterpriseSheetForm
              key={selected.id}
              projectId={project.id}
              enterprise={selected}
              directory={directory}
              canEdit={configuredEditing}
              invitationMap={invitationMap[selected.id] ?? {}}
              onUploadLogo={(formData) => uploadLogo("enterprise", formData, selected.id)}
              onSaved={() => router.refresh()}
              onDirtyChange={setEnterpriseDirty}
            />
          ) : null}
        </SectionCard>
      </div>
    </div>
  );
}

function OperationPhoto({ project, disabled, onDone }: { project: Project; disabled: boolean; onDone: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [preview, setPreview] = useState<string | null>(logoUrl(project.operation_photo_path));

  async function handleChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      await uploadOperationPhoto(project.id, formData);
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
  directoryEntry: CompanyDirectoryEntry,
  setForm: React.Dispatch<React.SetStateAction<EnterpriseFormState>>
) {
  setForm((current) => ({
    ...current,
    name: directoryEntry.name,
    enterprise_address: directoryEntry.address ?? "",
    enterprise_postal_code: directoryEntry.postal_code ?? "",
    enterprise_city: directoryEntry.city ?? "",
    email_administratif: directoryEntry.email_administratif ?? "",
    email_comptabilite: directoryEntry.email_comptabilite ?? "",
    email_travaux: directoryEntry.email_travaux ?? "",
    email_bureau_etudes: directoryEntry.email_bureau_etudes ?? "",
    email_signataire: directoryEntry.email_signataire ?? "",
    signataire_name: directoryEntry.signataire_name ?? "",
    siret: directoryEntry.siret ?? "",
    email_sav: directoryEntry.email_sav ?? "",
    phone_accueil: directoryEntry.phone_accueil ?? "",
    phone_travaux: directoryEntry.phone_travaux ?? "",
  }));
}

function EnterpriseSheetForm({
  projectId,
  enterprise,
  directory,
  canEdit,
  invitationMap,
  onUploadLogo,
  onSaved,
  onDirtyChange,
}: {
  projectId: string;
  enterprise: Enterprise;
  directory: CompanyDirectoryEntry[];
  canEdit: boolean;
  invitationMap: Record<string, string>;
  onUploadLogo: (formData: FormData) => Promise<void>;
  onSaved: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const [isPending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState(() => enterpriseForm(enterprise));
  const [savedForm, setSavedForm] = useState(() => enterpriseForm(enterprise));
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof EnterpriseFormState, string | null>>>({});
  const [localInvitations, setLocalInvitations] = useState(invitationMap);

  const companyOptions = useMemo(
    () => directory.map((entry) => ({ id: entry.id, label: `${entry.name}${entry.siret ? ` (${entry.siret})` : ""}`, data: entry })),
    [directory]
  );
  const siretOptions = useMemo(
    () =>
      directory
        .filter((entry) => entry.siret)
        .map((entry) => ({
          id: entry.id,
          label: `${entry.siret} — ${entry.name}`,
          data: entry,
        })),
    [directory]
  );

  const formDirty = useMemo(
    () => JSON.stringify(form) !== JSON.stringify(savedForm),
    [form, savedForm]
  );

  useEffect(() => {
    onDirtyChange?.(formDirty);
  }, [formDirty, onDirtyChange]);

  useEffect(() => {
    setLocalInvitations(invitationMap);
  }, [invitationMap]);
  const set = <K extends keyof EnterpriseFormState>(key: K, value: EnterpriseFormState[K]) =>
    setForm((current) => ({ ...current, [key]: value }));
  const inputClass = <K extends keyof EnterpriseFormState>(key: K, base = danobatInput) =>
    `${base} ${dirtyTextClass(form[key], savedForm[key], !canEdit)}`;

  function validateField<K extends keyof EnterpriseFormState>(key: K, validator: (value: string) => string | null) {
    setFieldErrors((current) => ({ ...current, [key]: validator(form[key]) }));
  }

  function save() {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      try {
        await updateEnterpriseSheet(projectId, enterprise.id, {
          ...form,
          contract_amount_ht: Number(form.contract_amount_ht) || 0,
          vat_rate: Number(form.vat_rate) || 20,
          prorata_percent: (Number(form.prorata_percent) || 0) / 100,
          avancement_max_avant_dgd: Number(form.avancement_max_avant_dgd) || 95,
        });
        setSavedForm(form);
        setMessage("Fiche entreprise enregistrée.");
        onSaved();
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "Erreur.");
      }
    });
  }

  const emailFields = [
    ["email_administratif", "Mail administratif"],
    ["email_comptabilite", "Mail comptabilité"],
    ["email_travaux", "Mail suivi travaux"],
    ["email_bureau_etudes", "Mail bureau d'études"],
    ["email_signataire", "Mail signataire"],
  ] as const;

  return (
    <div className="space-y-4">
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">Renseigné par DANOBAT</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <Field label="Nom de l'entreprise">
            <AutocompleteInput value={form.name} onChange={(value) => set("name", value)} onSelect={(option) => applyCompanyAdminFields(option.data, setForm)} options={companyOptions} disabled={!canEdit} className={inputClass("name")} placeholder="Rechercher…" />
          </Field>
          <Field label="N° du lot"><input className={inputClass("lot_number")} value={form.lot_number} onChange={(event) => set("lot_number", event.target.value)} disabled={!canEdit} /></Field>
          <Field label="Intitulé du lot"><input className={inputClass("designation")} value={form.designation} onChange={(event) => set("designation", event.target.value)} disabled={!canEdit} /></Field>
          <Field label="Marché initial H.T.">
            <FormattedNumberInput
              value={form.contract_amount_ht}
              onChange={(value) => set("contract_amount_ht", value)}
              unit="€"
              decimals={2}
              disabled={!canEdit}
              className={inputClass("contract_amount_ht")}
            />
          </Field>
          <Field label="TVA" error={fieldErrors.vat_rate}>
            <FormattedNumberInput
              value={form.vat_rate}
              onChange={(value) => set("vat_rate", value)}
              unit="%"
              decimals={2}
              disabled={!canEdit}
              className={inputClass("vat_rate")}
              onBlur={() => validateField("vat_rate", validatePercent)}
            />
          </Field>
          <Field label="Prorata" error={fieldErrors.prorata_percent}>
            <FormattedNumberInput
              value={form.prorata_percent}
              onChange={(value) => set("prorata_percent", value)}
              unit="%"
              decimals={3}
              disabled={!canEdit}
              className={inputClass("prorata_percent")}
              onBlur={() => validateField("prorata_percent", validatePercent)}
            />
          </Field>
          <Field label="Avanc. max avant DGD" error={fieldErrors.avancement_max_avant_dgd}>
            <FormattedNumberInput
              value={form.avancement_max_avant_dgd}
              onChange={(value) => set("avancement_max_avant_dgd", value)}
              unit="%"
              decimals={2}
              disabled={!canEdit}
              className={inputClass("avancement_max_avant_dgd")}
              onBlur={() => validateField("avancement_max_avant_dgd", validatePercent)}
            />
          </Field>
        </div>
      </div>

      <div className="rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/70 p-4">
        <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">À remplir par l&apos;entreprise</p>
        <p className="mb-3 mt-1 text-sm text-slate-500">Normalement complété par l&apos;entreprise en début d&apos;opération. DANOBAT peut renseigner si besoin.</p>
        <div className="grid gap-3">
          <div>
            <label className={labelClass}>Adresse postale</label>
            <div className="grid gap-2">
              <input className={inputClass("enterprise_address", enterpriseInput)} placeholder="N° et rue" value={form.enterprise_address} onChange={(event) => set("enterprise_address", event.target.value)} disabled={!canEdit} />
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <input className={inputClass("enterprise_postal_code", enterpriseInput)} placeholder="CP" value={form.enterprise_postal_code} onChange={(event) => set("enterprise_postal_code", event.target.value)} onBlur={() => validateField("enterprise_postal_code", validatePostalCode)} disabled={!canEdit} />
                  {fieldErrors.enterprise_postal_code && <p className="mt-1 text-xs text-red-600">{fieldErrors.enterprise_postal_code}</p>}
                </div>
                <input className={inputClass("enterprise_city", enterpriseInput)} placeholder="Ville" value={form.enterprise_city} onChange={(event) => set("enterprise_city", event.target.value)} disabled={!canEdit} />
              </div>
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {emailFields.map(([key, label]) => (
              <Field key={key} label={label}>
                <EmailFieldWithInvite
                  value={form[key]}
                  onChange={(value) => set(key, value)}
                  projectId={projectId}
                  enterpriseId={enterprise.id}
                  disabled={!canEdit}
                  inputClassName={enterpriseInput}
                  savedValue={savedForm[key]}
                  invitationSentAt={localInvitations[form[key].trim().toLowerCase()] ?? null}
                  onInvitationSent={(email, sentAt) =>
                    setLocalInvitations((current) => ({ ...current, [email]: sentAt }))
                  }
                />
              </Field>
            ))}
            <Field label="Signataire"><input className={inputClass("signataire_name", enterpriseInput)} value={form.signataire_name} onChange={(event) => set("signataire_name", event.target.value)} disabled={!canEdit} /></Field>
            <Field label="N° SIRET" error={fieldErrors.siret}>
              <AutocompleteInput
                value={form.siret}
                onChange={(value) => set("siret", value)}
                onSelect={(option) => applyCompanyAdminFields(option.data, setForm)}
                options={siretOptions}
                disabled={!canEdit}
                className={inputClass("siret", enterpriseInput)}
                placeholder="Rechercher par SIRET…"
              />
            </Field>
            <Field label="Mail SAV">
              <EmailFieldWithInvite
                value={form.email_sav}
                onChange={(value) => set("email_sav", value)}
                projectId={projectId}
                enterpriseId={enterprise.id}
                disabled={!canEdit}
                inputClassName={enterpriseInput}
                savedValue={savedForm.email_sav}
                invitationSentAt={localInvitations[form.email_sav.trim().toLowerCase()] ?? null}
                onInvitationSent={(email, sentAt) =>
                  setLocalInvitations((current) => ({ ...current, [email]: sentAt }))
                }
              />
            </Field>
            <Field label="Tél. Accueil" error={fieldErrors.phone_accueil}><input className={inputClass("phone_accueil", enterpriseInput)} value={form.phone_accueil} onChange={(event) => set("phone_accueil", event.target.value)} onBlur={() => validateField("phone_accueil", validatePhone)} disabled={!canEdit} /></Field>
            <Field label="Tél. Travaux" error={fieldErrors.phone_travaux}><input className={inputClass("phone_travaux", enterpriseInput)} value={form.phone_travaux} onChange={(event) => set("phone_travaux", event.target.value)} onBlur={() => validateField("phone_travaux", validatePhone)} disabled={!canEdit} /></Field>
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
