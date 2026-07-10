"use server";

import { revalidatePath } from "next/cache";
import { computeAmendmentTtc } from "@/lib/finance/calculations";
import { createClient } from "@/lib/supabase/server";
import type {
  AmendmentFormData,
  DelegationFormData,
  LotFormData,
  ProjectFinancialData,
  SituationFormData,
} from "@/lib/types/database";

function financePaths(projectId: string) {
  return [
    `/pc/projets/${projectId}/finance`,
    `/pc/projets/${projectId}/finance/lots`,
    `/pc/projets/${projectId}/finance/recap`,
    `/pc/projets/${projectId}/finance/situations`,
  ];
}

function revalidateFinance(projectId: string) {
  for (const path of financePaths(projectId)) {
    revalidatePath(path);
  }
  revalidatePath(`/pc/projets/${projectId}`);
}

async function logAudit(
  projectId: string,
  enterpriseId: string | null,
  entityType: string,
  entityId: string | null,
  action: string,
  summary: string
) {
  const supabase = await createClient();
  await supabase.from("financial_audit_log").insert({
    project_id: projectId,
    enterprise_id: enterpriseId,
    entity_type: entityType,
    entity_id: entityId,
    action,
    summary,
  });
}

export async function getProjectFinancialData(projectId: string): Promise<ProjectFinancialData> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("projects")
    .select(
      `*,
      enterprises(
        *,
        financial_amendments(*),
        financial_situations(*)
      ),
      financial_bank_guarantees(*)`
    )
    .eq("id", projectId)
    .single();

  if (error) throw new Error(error.message);

  if (data.enterprises) {
    data.enterprises.sort(
      (a: { sort_order: number; lot_number: string | null }, b: { sort_order: number; lot_number: string | null }) => {
        if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
        return (a.lot_number ?? "").localeCompare(b.lot_number ?? "", "fr", {
          numeric: true,
        });
      }
    );

    for (const enterprise of data.enterprises) {
      enterprise.amendments = enterprise.financial_amendments ?? [];
      enterprise.situations = enterprise.financial_situations ?? [];
      delete enterprise.financial_amendments;
      delete enterprise.financial_situations;

      enterprise.amendments.sort(
        (a: { amendment_number: number }, b: { amendment_number: number }) =>
          a.amendment_number - b.amendment_number
      );
      enterprise.situations.sort(
        (a: { situation_number: number }, b: { situation_number: number }) =>
          a.situation_number - b.situation_number
      );
    }
  }

  data.bank_guarantees = data.financial_bank_guarantees ?? [];
  delete data.financial_bank_guarantees;

  return data as ProjectFinancialData;
}

export async function getLot(projectId: string, lotId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("enterprises")
    .select(
      `*,
      financial_amendments(*),
      financial_situations(*),
      project:projects(*)`
    )
    .eq("id", lotId)
    .eq("project_id", projectId)
    .single();

  if (error) throw new Error(error.message);

  data.amendments = data.financial_amendments ?? [];
  data.situations = data.financial_situations ?? [];
  delete data.financial_amendments;
  delete data.financial_situations;

  data.amendments.sort(
    (a: { amendment_number: number }, b: { amendment_number: number }) =>
      a.amendment_number - b.amendment_number
  );
  data.situations.sort(
    (a: { situation_number: number }, b: { situation_number: number }) =>
      a.situation_number - b.situation_number
  );

  return data;
}

export async function getSituation(
  projectId: string,
  lotId: string,
  situationId: string
) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("financial_situations")
    .select(
      `*,
      enterprise:enterprises(
        *,
        financial_amendments(*),
        financial_situations(*),
        project:projects(*)
      ),
      financial_situation_delegations(*)`
    )
    .eq("id", situationId)
    .single();

  if (error) throw new Error(error.message);
  if (data.enterprise.project_id !== projectId || data.enterprise_id !== lotId) {
    throw new Error("Situation introuvable.");
  }

  const enterprise = data.enterprise;
  enterprise.amendments = enterprise.financial_amendments ?? [];
  enterprise.situations = enterprise.financial_situations ?? [];
  delete enterprise.financial_amendments;
  delete enterprise.financial_situations;

  enterprise.amendments.sort(
    (a: { amendment_number: number }, b: { amendment_number: number }) =>
      a.amendment_number - b.amendment_number
  );
  enterprise.situations.sort(
    (a: { situation_number: number }, b: { situation_number: number }) =>
      a.situation_number - b.situation_number
  );

  data.financial_situation_delegations?.sort(
    (a: { sort_order: number }, b: { sort_order: number }) =>
      a.sort_order - b.sort_order
  );

  return data;
}

export async function updateProjectFinancialInfo(
  projectId: string,
  data: {
    typology?: string;
    client_name?: string;
    client_address?: string;
    default_payment_terms?: string;
  }
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({
      typology: data.typology || null,
      client_name: data.client_name || null,
      client_address: data.client_address || null,
      default_payment_terms: data.default_payment_terms || null,
    })
    .eq("id", projectId);

  if (error) throw new Error(error.message);

  await logAudit(
    projectId,
    null,
    "project",
    projectId,
    "update",
    "Informations financières du projet mises à jour"
  );

  revalidateFinance(projectId);
}

export async function upsertLot(projectId: string, formData: LotFormData, lotId?: string) {
  const supabase = await createClient();
  const payload = {
    project_id: projectId,
    lot_number: formData.lot_number,
    designation: formData.designation,
    name: formData.name,
    trade: formData.designation,
    enterprise_address: formData.enterprise_address || null,
    contract_amount_ht: formData.contract_amount_ht,
    prorata_percent: formData.prorata_percent,
    payment_terms: formData.payment_terms || null,
    vat_rate: formData.vat_rate ?? 20,
    contact_name: formData.contact_name || null,
    contact_email: formData.contact_email || null,
    contact_phone: formData.contact_phone || null,
    email_chantier: formData.email_chantier || null,
    email_factures: formData.email_factures || null,
    email_administratif: formData.email_administratif || null,
    has_bank_guarantee: formData.has_bank_guarantee ?? false,
  };

  if (lotId) {
    const { error } = await supabase
      .from("enterprises")
      .update(payload)
      .eq("id", lotId)
      .eq("project_id", projectId);

    if (error) throw new Error(error.message);

    await logAudit(
      projectId,
      lotId,
      "lot",
      lotId,
      "update",
      `Lot ${formData.lot_number} — ${formData.designation} mis à jour`
    );
  } else {
    const { data: existing } = await supabase
      .from("enterprises")
      .select("sort_order")
      .eq("project_id", projectId)
      .order("sort_order", { ascending: false })
      .limit(1);

    const nextOrder = (existing?.[0]?.sort_order ?? 0) + 1;

    const { data, error } = await supabase
      .from("enterprises")
      .insert({ ...payload, sort_order: nextOrder })
      .select("id")
      .single();

    if (error) throw new Error(error.message);

    await logAudit(
      projectId,
      data.id,
      "lot",
      data.id,
      "create",
      `Lot ${formData.lot_number} — ${formData.designation} créé`
    );
  }

  revalidateFinance(projectId);
  revalidatePath(`/pc/projets/${projectId}/parametres`);
}

export async function deleteLot(projectId: string, lotId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("enterprises")
    .delete()
    .eq("id", lotId)
    .eq("project_id", projectId);

  if (error) throw new Error(error.message);

  await logAudit(projectId, lotId, "lot", lotId, "delete", "Lot supprimé");

  revalidateFinance(projectId);
  revalidatePath(`/pc/projets/${projectId}/parametres`);
}

export async function upsertAmendment(
  projectId: string,
  lotId: string,
  formData: AmendmentFormData,
  amendmentId?: string
) {
  const supabase = await createClient();

  const { data: lot, error: lotError } = await supabase
    .from("enterprises")
    .select("vat_rate")
    .eq("id", lotId)
    .eq("project_id", projectId)
    .single();

  if (lotError) throw new Error(lotError.message);

  const amountTtc = computeAmendmentTtc(
    formData.amount_ht,
    Number(lot.vat_rate ?? 20)
  );

  const payload = {
    enterprise_id: lotId,
    amendment_number: formData.amendment_number,
    designation: formData.designation || null,
    os_number: formData.os_number || null,
    amount_ht: formData.amount_ht,
    amount_ttc: amountTtc,
  };

  if (amendmentId) {
    const { error } = await supabase
      .from("financial_amendments")
      .update(payload)
      .eq("id", amendmentId)
      .eq("enterprise_id", lotId);

    if (error) throw new Error(error.message);

    await logAudit(
      projectId,
      lotId,
      "amendment",
      amendmentId,
      "update",
      `Avenant n°${formData.amendment_number} mis à jour`
    );
  } else {
    const { data, error } = await supabase
      .from("financial_amendments")
      .insert(payload)
      .select("id")
      .single();

    if (error) throw new Error(error.message);

    await logAudit(
      projectId,
      lotId,
      "amendment",
      data.id,
      "create",
      `Avenant n°${formData.amendment_number} créé`
    );
  }

  revalidateFinance(projectId);
}

export async function deleteAmendment(
  projectId: string,
  lotId: string,
  amendmentId: string
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("financial_amendments")
    .delete()
    .eq("id", amendmentId)
    .eq("enterprise_id", lotId);

  if (error) throw new Error(error.message);

  await logAudit(
    projectId,
    lotId,
    "amendment",
    amendmentId,
    "delete",
    "Avenant supprimé"
  );

  revalidateFinance(projectId);
}

export async function upsertSituation(
  projectId: string,
  lotId: string,
  formData: SituationFormData,
  situationId?: string
) {
  const supabase = await createClient();

  const payload = {
    enterprise_id: lotId,
    situation_number: formData.situation_number,
    situation_date: formData.situation_date,
    works_cumulative_ht: formData.works_cumulative_ht,
    amendment_works_cumulative_ht: formData.amendment_works_cumulative_ht ?? 0,
    prorata_cumulative_ht: formData.prorata_cumulative_ht ?? 0,
    retention_guarantee_cumulative_ht:
      formData.retention_guarantee_cumulative_ht ?? 0,
    retention_finition_cumulative_ht:
      formData.retention_finition_cumulative_ht ?? 0,
    retention_diverse_cumulative_ht: formData.retention_diverse_cumulative_ht ?? 0,
    penalties_cumulative_ht: formData.penalties_cumulative_ht ?? 0,
    cie_cumulative_ht: formData.cie_cumulative_ht ?? 0,
    notes: formData.notes || null,
  };

  if (situationId) {
    const { error } = await supabase
      .from("financial_situations")
      .update(payload)
      .eq("id", situationId)
      .eq("enterprise_id", lotId);

    if (error) throw new Error(error.message);

    await logAudit(
      projectId,
      lotId,
      "situation",
      situationId,
      "update",
      `Situation n°${formData.situation_number} mise à jour`
    );

    return situationId;
  }

  const { data, error } = await supabase
    .from("financial_situations")
    .insert(payload)
    .select("id")
    .single();

  if (error) throw new Error(error.message);

  await logAudit(
    projectId,
    lotId,
    "situation",
    data.id,
    "create",
    `Situation n°${formData.situation_number} créée`
  );

  revalidateFinance(projectId);
  return data.id;
}

export async function deleteSituation(
  projectId: string,
  lotId: string,
  situationId: string
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("financial_situations")
    .delete()
    .eq("id", situationId)
    .eq("enterprise_id", lotId);

  if (error) throw new Error(error.message);

  await logAudit(
    projectId,
    lotId,
    "situation",
    situationId,
    "delete",
    "Situation supprimée"
  );

  revalidateFinance(projectId);
}

export async function saveSituationDelegations(
  projectId: string,
  lotId: string,
  situationId: string,
  delegations: DelegationFormData[]
) {
  const supabase = await createClient();

  const { error: deleteError } = await supabase
    .from("financial_situation_delegations")
    .delete()
    .eq("situation_id", situationId);

  if (deleteError) throw new Error(deleteError.message);

  if (delegations.length > 0) {
    const { error } = await supabase.from("financial_situation_delegations").insert(
      delegations.map((d, index) => ({
        situation_id: situationId,
        company_name: d.company_name,
        delegation_type: d.delegation_type,
        delegation_amount: d.delegation_amount,
        cumulative_ttc: d.cumulative_ttc,
        previous_cumulative_ttc: d.previous_cumulative_ttc ?? 0,
        sort_order: index,
      }))
    );

    if (error) throw new Error(error.message);
  }

  await logAudit(
    projectId,
    lotId,
    "situation",
    situationId,
    "update",
    "Délégations de paiement mises à jour"
  );

  revalidateFinance(projectId);
}

export async function getFinancialAuditLog(projectId: string) {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("financial_audit_log")
    .select("*")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw new Error(error.message);
  return data;
}

export async function getFinanceNavLabels(
  projectId: string,
  lotId: string,
  situationId?: string
) {
  const supabase = await createClient();

  const { data: lot, error: lotError } = await supabase
    .from("enterprises")
    .select("lot_number, designation, name")
    .eq("id", lotId)
    .eq("project_id", projectId)
    .single();

  if (lotError) {
    return {
      lotNumber: null,
      lotDesignation: null,
      lotName: null,
      situationNumber: null,
      isNewSituation: false,
      isPrint: false,
    };
  }

  let situationNumber: number | null = null;

  if (situationId) {
    const { data: situation } = await supabase
      .from("financial_situations")
      .select("situation_number")
      .eq("id", situationId)
      .eq("enterprise_id", lotId)
      .single();

    situationNumber = situation?.situation_number ?? null;
  }

  return {
    lotNumber: lot.lot_number,
    lotDesignation: lot.designation,
    lotName: lot.name,
    situationNumber,
    isNewSituation: false,
    isPrint: false,
  };
}

const FINANCIAL_BUCKET = "financial-files";

export async function getFinancialFileUrl(filePath: string) {
  const supabase = await createClient();
  const { data } = supabase.storage.from(FINANCIAL_BUCKET).getPublicUrl(filePath);
  return data.publicUrl;
}

export async function uploadOperationPhoto(projectId: string, formData: FormData) {
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) throw new Error("Veuillez sélectionner une image.");

  const supabase = await createClient();
  const ext = file.name.split(".").pop() ?? "jpg";
  const filePath = `${projectId}/operation-photo.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from(FINANCIAL_BUCKET)
    .upload(filePath, buffer, { contentType: file.type, upsert: true });

  if (uploadError) throw new Error(uploadError.message);

  const { error } = await supabase
    .from("projects")
    .update({ operation_photo_path: filePath })
    .eq("id", projectId);

  if (error) throw new Error(error.message);
  revalidateFinance(projectId);
}

export async function uploadSituationInvoice(
  projectId: string,
  lotId: string,
  situationId: string,
  formData: FormData
) {
  const file = formData.get("file") as File | null;
  if (!file || file.size === 0) throw new Error("Veuillez sélectionner un fichier.");

  const isPdf =
    file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
  const isImage = file.type.startsWith("image/");

  if (!isPdf && !isImage) {
    throw new Error("Seuls les fichiers PDF ou images sont acceptés.");
  }

  const supabase = await createClient();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filePath = `${projectId}/situations/${situationId}/${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from(FINANCIAL_BUCKET)
    .upload(filePath, buffer, {
      contentType: file.type || "application/pdf",
      upsert: true,
    });

  if (uploadError) throw new Error(uploadError.message);

  const { error } = await supabase
    .from("financial_situations")
    .update({
      invoice_file_path: filePath,
      invoice_file_name: file.name,
    })
    .eq("id", situationId)
    .eq("enterprise_id", lotId);

  if (error) throw new Error(error.message);

  await logAudit(
    projectId,
    lotId,
    "situation",
    situationId,
    "update",
    `Facture entreprise jointe : ${file.name}`
  );

  revalidateFinance(projectId);
  return filePath;
}

export async function addBankGuarantee(
  projectId: string,
  data: { company_name: string; amount_ht: number; notes?: string }
) {
  const supabase = await createClient();
  const { error } = await supabase.from("financial_bank_guarantees").insert({
    project_id: projectId,
    company_name: data.company_name,
    amount_ht: data.amount_ht,
    notes: data.notes || null,
  });

  if (error) throw new Error(error.message);
  revalidateFinance(projectId);
}

export async function deleteBankGuarantee(projectId: string, guaranteeId: string) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("financial_bank_guarantees")
    .delete()
    .eq("id", guaranteeId)
    .eq("project_id", projectId);

  if (error) throw new Error(error.message);
  revalidateFinance(projectId);
}
