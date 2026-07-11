"use server";

import { revalidatePath } from "next/cache";
import { requireProjectAccess, requireProjectRoles } from "@/lib/auth/permissions";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const PLANS_BUCKET = "plans";

async function downloadPlanBlob(filePath: string) {
  const supabase = await createClient();
  const userResult = await supabase.storage.from(PLANS_BUCKET).download(filePath);

  if (!userResult.error && userResult.data) {
    return userResult.data;
  }

  if (isAdminClientConfigured()) {
    const admin = createAdminClient();
    const adminResult = await admin.storage.from(PLANS_BUCKET).download(filePath);
    if (!adminResult.error && adminResult.data) {
      return adminResult.data;
    }
  }

  const { data: signed, error: signError } = await supabase.storage
    .from(PLANS_BUCKET)
    .createSignedUrl(filePath, 3600);

  if (!signError && signed?.signedUrl) {
    const response = await fetch(signed.signedUrl);
    if (response.ok) {
      return await response.blob();
    }
  }

  throw new Error(
    userResult.error?.message ??
      "Impossible de lire le fichier PDF dans le stockage Supabase."
  );
}

async function getPlanRecord(projectId: string, planId: string) {
  const supabase = await createClient();
  const { data: plan, error } = await supabase
    .from("plans")
    .select("file_path, project_id, name")
    .eq("id", planId)
    .eq("project_id", projectId)
    .single();

  if (error || !plan) {
    throw new Error("Plan introuvable.");
  }

  return plan;
}

export async function getPlanPdfData(
  projectId: string,
  planId: string
): Promise<string> {
  await requireProjectAccess(projectId);
  const plan = await getPlanRecord(projectId, planId);
  const blob = await downloadPlanBlob(plan.file_path);
  const buffer = Buffer.from(await blob.arrayBuffer());

  if (buffer.length < 4 || buffer.subarray(0, 4).toString("utf8") !== "%PDF") {
    throw new Error("Le fichier stocké n'est pas un PDF valide.");
  }

  return buffer.toString("base64");
}

export type PlanPageImage = {
  imageBase64: string;
  width: number;
  height: number;
};

export async function getPlanPageImage(
  projectId: string,
  planId: string,
  pageNumber = 1
): Promise<PlanPageImage> {
  await requireProjectAccess(projectId);
  const plan = await getPlanRecord(projectId, planId);
  const blob = await downloadPlanBlob(plan.file_path);
  const buffer = Buffer.from(await blob.arrayBuffer());

  if (buffer.length < 4 || buffer.subarray(0, 4).toString("utf8") !== "%PDF") {
    throw new Error("Le fichier stocké n'est pas un PDF valide.");
  }

  const { join } = await import("path");
  const { pathToFileURL } = await import("url");
  const { createCanvas } = await import("@napi-rs/canvas");
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

  pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(
    join(process.cwd(), "node_modules/pdfjs-dist/legacy/build/pdf.worker.min.mjs")
  ).href;

  const doc = await pdfjs.getDocument({
    data: new Uint8Array(buffer),
    useSystemFonts: true,
  }).promise;

  const page = await doc.getPage(pageNumber);
  const baseViewport = page.getViewport({ scale: 1 });
  const maxSide = Math.max(baseViewport.width, baseViewport.height);
  const renderScale = Math.min(2, 4096 / maxSide);
  const viewport = page.getViewport({ scale: renderScale });

  const canvas = createCanvas(Math.ceil(viewport.width), Math.ceil(viewport.height));
  const context = canvas.getContext("2d");

  await page.render({
    canvasContext: context as unknown as CanvasRenderingContext2D,
    viewport,
    canvas: canvas as unknown as HTMLCanvasElement,
  }).promise;

  return {
    imageBase64: canvas.toBuffer("image/png").toString("base64"),
    width: viewport.width,
    height: viewport.height,
  };
}

export async function getPlans(projectId: string) {
  await requireProjectAccess(projectId);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("plans")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return data;
}

export async function getPlanPublicUrl(filePath: string) {
  const supabase = await createClient();
  const { data } = supabase.storage.from(PLANS_BUCKET).getPublicUrl(filePath);
  return data.publicUrl;
}

export async function uploadPlan(projectId: string, formData: FormData) {
  await requireProjectRoles(projectId, ["admin", "gestionnaire", "terrain"]);
  const file = formData.get("file") as File | null;
  const nameInput = (formData.get("name") as string | null)?.trim();

  if (!file || file.size === 0) {
    throw new Error("Veuillez sélectionner un fichier PDF.");
  }

  if (file.type !== "application/pdf" && !file.name.toLowerCase().endsWith(".pdf")) {
    throw new Error("Seuls les fichiers PDF sont acceptés.");
  }

  const supabase = await createClient();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filePath = `${projectId}/${crypto.randomUUID()}-${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from(PLANS_BUCKET)
    .upload(filePath, buffer, { contentType: "application/pdf", upsert: false });

  if (uploadError) throw new Error(uploadError.message);

  const { data, error } = await supabase
    .from("plans")
    .insert({
      project_id: projectId,
      name: nameInput || file.name.replace(/\.pdf$/i, ""),
      file_path: filePath,
      file_size: file.size,
    })
    .select("*")
    .single();

  if (error) {
    await supabase.storage.from(PLANS_BUCKET).remove([filePath]);
    throw new Error(error.message);
  }

  revalidatePath(`/tablette/projets/${projectId}/parametres`);
  revalidatePath(`/pc/projets/${projectId}/parametres`);

  return data;
}

export async function deletePlan(projectId: string, planId: string) {
  await requireProjectRoles(projectId, ["admin", "gestionnaire", "terrain"]);
  const supabase = await createClient();

  const { data: plan, error: fetchError } = await supabase
    .from("plans")
    .select("file_path")
    .eq("id", planId)
    .eq("project_id", projectId)
    .single();

  if (fetchError) throw new Error(fetchError.message);

  const { error } = await supabase.from("plans").delete().eq("id", planId);

  if (error) throw new Error(error.message);

  await supabase.storage.from(PLANS_BUCKET).remove([plan.file_path]);

  revalidatePath(`/tablette/projets/${projectId}/parametres`);
  revalidatePath(`/pc/projets/${projectId}/parametres`);
}

export async function getPlansWithUrls(projectId: string) {
  const plans = await getPlans(projectId);

  return plans.map((plan) => ({
    ...plan,
    pdf_url: `/api/plans/${plan.id}/pdf?projectId=${projectId}`,
  }));
}
