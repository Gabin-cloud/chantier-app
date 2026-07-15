"use server";

import { revalidatePath } from "next/cache";
import { requireProjectAccess, requireProjectRoles } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import type { CompanyDirectoryEntry, OwnerDirectoryEntry } from "@/lib/types/database";

const LOGO_BUCKET = "financial-files";

/** Champs de la fiche renseignés par DANOBAT au niveau du projet. */
export type OperationSheetData = {
  // Opération
  name: string;
  description?: string | null;
  address?: string | null;
  postal_code?: string | null;
  city?: string | null;
  // Maître d'ouvrage
  owner_name?: string | null;
  owner_address?: string | null;
  owner_postal_code?: string | null;
  owner_city?: string | null;
  owner_email_admin?: string | null;
  owner_email_works?: string | null;
  owner_signatory_name?: string | null;
  owner_signatory_email?: string | null;
  owner_doc_marche?: boolean;
  owner_doc_os?: boolean;
  owner_doc_ae?: boolean;
  owner_doc_avenant?: boolean;
  // Maître d'œuvre (DANOBAT)
  moe_address?: string | null;
  moe_postal_code?: string | null;
  moe_city?: string | null;
  moe_email_admin?: string | null;
  moe_email_works?: string | null;
};

/** Fiche entreprise : partie DANOBAT + partie « à remplir par l'entreprise ». */
export type EnterpriseSheetData = {
  // Renseigné par DANOBAT
  name: string;
  lot_number?: string | null;
  designation?: string | null;
  contract_amount_ht?: number;
  vat_rate?: number;
  prorata_percent?: number;
  avancement_max_avant_dgd?: number;
  // À remplir par l'entreprise (DANOBAT peut aussi les saisir)
  enterprise_address?: string | null;
  enterprise_postal_code?: string | null;
  enterprise_city?: string | null;
  email_administratif?: string | null;
  email_comptabilite?: string | null;
  email_travaux?: string | null;
  email_bureau_etudes?: string | null;
  email_signataire?: string | null;
  signataire_name?: string | null;
  siret?: string | null;
  email_sav?: string | null;
  phone_accueil?: string | null;
  phone_travaux?: string | null;
};

const clean = (v: string | null | undefined) => {
  const s = (v ?? "").toString().trim();
  return s.length > 0 ? s : null;
};

function revalidateSheet(projectId: string) {
  revalidatePath(`/pc/projets/${projectId}/parametres`);
  revalidatePath(`/pc/projets/${projectId}/dossier`);
  revalidatePath(`/pc/projets/${projectId}`);
  revalidatePath(`/tablette/projets/${projectId}/parametres`);
  revalidatePath("/pc/referentiels");
}

export async function updateOperationSheet(
  projectId: string,
  data: OperationSheetData
) {
  await requireProjectRoles(projectId, ["admin", "gestionnaire"]);
  const supabase = await createClient();

  const name = clean(data.name);
  if (!name) throw new Error("Le nom de l'opération est obligatoire.");

  const { error } = await supabase
    .from("projects")
    .update({
      name,
      description: clean(data.description),
      address: clean(data.address),
      postal_code: clean(data.postal_code),
      city: clean(data.city),
      is_operation_configured: true,
      owner_name: clean(data.owner_name),
      owner_address: clean(data.owner_address),
      owner_postal_code: clean(data.owner_postal_code),
      owner_city: clean(data.owner_city),
      owner_email_admin: clean(data.owner_email_admin),
      owner_email_works: clean(data.owner_email_works),
      owner_signatory_name: clean(data.owner_signatory_name),
      owner_signatory_email: clean(data.owner_signatory_email),
      owner_doc_marche: !!data.owner_doc_marche,
      owner_doc_os: !!data.owner_doc_os,
      owner_doc_ae: !!data.owner_doc_ae,
      owner_doc_avenant: !!data.owner_doc_avenant,
      moe_address: clean(data.moe_address),
      moe_postal_code: clean(data.moe_postal_code),
      moe_city: clean(data.moe_city),
      moe_email_admin: clean(data.moe_email_admin),
      moe_email_works: clean(data.moe_email_works),
    })
    .eq("id", projectId);

  if (error) throw new Error(error.message);

  const ownerName = clean(data.owner_name);
  if (ownerName) {
    await supabase.from("owner_directory").upsert(
      {
        name: ownerName,
        address: clean(data.owner_address),
        postal_code: clean(data.owner_postal_code),
        city: clean(data.owner_city),
        email_admin: clean(data.owner_email_admin),
        email_works: clean(data.owner_email_works),
        signatory_name: clean(data.owner_signatory_name),
        signatory_email: clean(data.owner_signatory_email),
        doc_marche: !!data.owner_doc_marche,
        doc_os: !!data.owner_doc_os,
        doc_ae: !!data.owner_doc_ae,
        doc_avenant: !!data.owner_doc_avenant,
      },
      { onConflict: "name" }
    );
  }

  revalidateSheet(projectId);
}

export async function updateEnterpriseSheet(
  projectId: string,
  enterpriseId: string,
  data: EnterpriseSheetData
) {
  await requireProjectRoles(projectId, ["admin", "gestionnaire"]);
  const supabase = await createClient();

  const name = clean(data.name);
  if (!name) throw new Error("Le nom de l'entreprise est obligatoire.");

  const payload = {
    name,
    lot_number: clean(data.lot_number),
    designation: clean(data.designation),
    contract_amount_ht: Number(data.contract_amount_ht ?? 0) || 0,
    vat_rate: Number(data.vat_rate ?? 20) || 20,
    prorata_percent: Number(data.prorata_percent ?? 0) || 0,
    avancement_max_avant_dgd: Number(data.avancement_max_avant_dgd ?? 95) || 95,
    enterprise_address: clean(data.enterprise_address),
    enterprise_postal_code: clean(data.enterprise_postal_code),
    enterprise_city: clean(data.enterprise_city),
    email_administratif: clean(data.email_administratif),
    email_comptabilite: clean(data.email_comptabilite),
    email_travaux: clean(data.email_travaux),
    email_bureau_etudes: clean(data.email_bureau_etudes),
    email_signataire: clean(data.email_signataire),
    signataire_name: clean(data.signataire_name),
    siret: clean(data.siret),
    email_sav: clean(data.email_sav),
    phone_accueil: clean(data.phone_accueil),
    phone_travaux: clean(data.phone_travaux),
  };

  const { error } = await supabase
    .from("enterprises")
    .update(payload)
    .eq("id", enterpriseId)
    .eq("project_id", projectId);

  if (error) throw new Error(error.message);

  // Alimente la base de données d'entreprises réutilisable (clé SIRET ou nom).
  if (payload.siret) {
    await supabase
      .from("company_directory")
      .upsert(
        {
          siret: payload.siret,
          name: payload.name,
          address: payload.enterprise_address,
          postal_code: payload.enterprise_postal_code,
          city: payload.enterprise_city,
          email_administratif: payload.email_administratif,
          email_comptabilite: payload.email_comptabilite,
          email_travaux: payload.email_travaux,
          email_bureau_etudes: payload.email_bureau_etudes,
          email_signataire: payload.email_signataire,
          signataire_name: payload.signataire_name,
          email_sav: payload.email_sav,
          phone_accueil: payload.phone_accueil,
          phone_travaux: payload.phone_travaux,
        },
        { onConflict: "siret" }
      );
  } else if (payload.name) {
    const { data: existing } = await supabase
      .from("company_directory")
      .select("id")
      .eq("name", payload.name)
      .maybeSingle();
    if (existing) {
      await supabase
        .from("company_directory")
        .update({
          address: payload.enterprise_address,
          postal_code: payload.enterprise_postal_code,
          city: payload.enterprise_city,
          email_administratif: payload.email_administratif,
          email_comptabilite: payload.email_comptabilite,
          email_travaux: payload.email_travaux,
          email_bureau_etudes: payload.email_bureau_etudes,
          email_signataire: payload.email_signataire,
          signataire_name: payload.signataire_name,
          email_sav: payload.email_sav,
          phone_accueil: payload.phone_accueil,
          phone_travaux: payload.phone_travaux,
        })
        .eq("id", existing.id);
    }
  }

  revalidateSheet(projectId);
}

export async function getCompanyDirectory(): Promise<CompanyDirectoryEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("company_directory")
    .select("*")
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return (data as CompanyDirectoryEntry[]) ?? [];
}

export async function getOwnerDirectory(): Promise<OwnerDirectoryEntry[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("owner_directory")
    .select("*")
    .order("name", { ascending: true });

  if (error) throw new Error(error.message);
  return (data as OwnerDirectoryEntry[]) ?? [];
}

export async function createEnterpriseOnProject(projectId: string, name: string) {
  await requireProjectRoles(projectId, ["admin", "gestionnaire"]);
  const supabase = await createClient();
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Le nom de l'entreprise est obligatoire.");

  const { data, error } = await supabase
    .from("enterprises")
    .insert({
      project_id: projectId,
      name: trimmed,
      contract_amount_ht: 0,
      vat_rate: 20,
      prorata_percent: 0.015,
      avancement_max_avant_dgd: 95,
    })
    .select("id")
    .single();

  if (error) throw new Error(error.message);
  revalidateSheet(projectId);
  return data.id as string;
}

/** Pré-remplit une fiche entreprise depuis l'annuaire (gain de temps début d'opé). */
export async function applyDirectoryToEnterprise(
  projectId: string,
  enterpriseId: string,
  directoryId: string
) {
  await requireProjectRoles(projectId, ["admin", "gestionnaire"]);
  const supabase = await createClient();

  const { data: entry, error: entryError } = await supabase
    .from("company_directory")
    .select("*")
    .eq("id", directoryId)
    .single();

  if (entryError) throw new Error(entryError.message);
  const dir = entry as CompanyDirectoryEntry;

  const { error } = await supabase
    .from("enterprises")
    .update({
      name: dir.name,
      siret: dir.siret,
      enterprise_address: dir.address,
      enterprise_postal_code: dir.postal_code,
      enterprise_city: dir.city,
      email_administratif: dir.email_administratif,
      email_comptabilite: dir.email_comptabilite,
      email_travaux: dir.email_travaux,
      email_bureau_etudes: dir.email_bureau_etudes,
      email_signataire: dir.email_signataire,
      signataire_name: dir.signataire_name,
      email_sav: dir.email_sav,
      phone_accueil: dir.phone_accueil,
      phone_travaux: dir.phone_travaux,
      logo_path: dir.logo_path,
    })
    .eq("id", enterpriseId)
    .eq("project_id", projectId);

  if (error) throw new Error(error.message);
  revalidateSheet(projectId);
}

export type LogoTarget = "owner" | "moe" | "enterprise";

export async function uploadOperationLogo(
  projectId: string,
  target: LogoTarget,
  formData: FormData,
  enterpriseId?: string
) {
  await requireProjectRoles(projectId, ["admin", "gestionnaire"]);
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) throw new Error("Veuillez sélectionner une image.");
  if (!file.type.startsWith("image/")) {
    throw new Error("Le logo doit être une image.");
  }

  const supabase = await createClient();
  const ext = file.name.split(".").pop() ?? "png";
  const scope = target === "enterprise" ? `enterprise-${enterpriseId}` : target;
  const filePath = `${projectId}/logos/${scope}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from(LOGO_BUCKET)
    .upload(filePath, buffer, { contentType: file.type, upsert: true });

  if (uploadError) throw new Error(uploadError.message);

  if (target === "owner") {
    await supabase.from("projects").update({ owner_logo_path: filePath }).eq("id", projectId);
  } else if (target === "moe") {
    await supabase.from("projects").update({ moe_logo_path: filePath }).eq("id", projectId);
  } else if (target === "enterprise" && enterpriseId) {
    await supabase
      .from("enterprises")
      .update({ logo_path: filePath })
      .eq("id", enterpriseId)
      .eq("project_id", projectId);
  }

  revalidateSheet(projectId);
  const { data } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(filePath);
  return data.publicUrl;
}

export async function getLogoUrl(projectId: string, filePath: string) {
  await requireProjectAccess(projectId);
  const supabase = await createClient();
  const { data } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(filePath);
  return data.publicUrl;
}
