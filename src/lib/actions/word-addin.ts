"use server";

import { getFinanceProjects } from "@/lib/actions/incoming-files";
import { requireProjectAccess } from "@/lib/auth/permissions";
import { requireUser } from "@/lib/auth/permissions";
import { buildDocumentLabelValuesFromContext } from "@/lib/documents/build-label-values";
import {
  DEFAULT_DOCUMENT_LABELS,
  type DocumentLabelDefinition,
} from "@/lib/documents/document-labels";
import { createClient } from "@/lib/supabase/server";

export type WordEnterpriseOption = {
  id: string;
  name: string;
  lot_number: string | null;
  designation: string | null;
};

export type WordAddinBootstrap = {
  labels: DocumentLabelDefinition[];
  projects: { id: string; name: string }[];
};

export async function getWordAddinBootstrap(): Promise<WordAddinBootstrap> {
  await requireUser();
  const projects = await getFinanceProjects();

  const supabase = await createClient();
  const { data: labelRows, error } = await supabase
    .from("document_labels")
    .select("key, label, description, example, category, is_system")
    .order("category", { ascending: true })
    .order("label", { ascending: true });

  const labels =
    !error && labelRows && labelRows.length > 0
      ? labelRows.map((row) => ({
          key: row.key,
          label: row.label,
          description: row.description ?? "",
          example: row.example ?? "",
          category: row.category ?? "general",
          isSystem: row.is_system,
        }))
      : DEFAULT_DOCUMENT_LABELS;

  return { labels, projects };
}

export async function getWordAddinEnterprises(
  projectId: string
): Promise<WordEnterpriseOption[]> {
  await requireProjectAccess(projectId);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("enterprises")
    .select("id, name, lot_number, designation")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getWordAddinLabelValues(
  projectId: string,
  enterpriseId: string
): Promise<Record<string, string>> {
  await requireProjectAccess(projectId);
  const supabase = await createClient();

  const { data: project, error: projectError } = await supabase
    .from("projects")
    .select(
      "name, address, postal_code, city, owner_name, owner_address, owner_postal_code, owner_city, owner_signatory_name, owner_signatory_email, moe_address, moe_postal_code, moe_city, default_payment_terms"
    )
    .eq("id", projectId)
    .single();

  if (projectError) throw new Error(projectError.message);

  const { data: enterprise, error: enterpriseError } = await supabase
    .from("enterprises")
    .select(
      "name, enterprise_address, enterprise_postal_code, enterprise_city, siret, signataire_name, lot_number, designation, contract_amount_ht, vat_rate, payment_terms"
    )
    .eq("id", enterpriseId)
    .eq("project_id", projectId)
    .single();

  if (enterpriseError) throw new Error(enterpriseError.message);

  return buildDocumentLabelValuesFromContext(project, enterprise);
}
