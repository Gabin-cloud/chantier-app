import { NextResponse, type NextRequest } from "next/server";
import { requireProjectAccess } from "@/lib/auth/permissions";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ planId: string }>;
};

async function downloadPlanFile(filePath: string) {
  const supabase = await createClient();
  const userDownload = await supabase.storage.from("plans").download(filePath);

  if (!userDownload.error && userDownload.data) {
    return userDownload.data;
  }

  if (isAdminClientConfigured()) {
    const admin = createAdminClient();
    const adminDownload = await admin.storage.from("plans").download(filePath);
    if (!adminDownload.error && adminDownload.data) {
      return adminDownload.data;
    }
  }

  const { data: signed, error: signError } = await supabase.storage
    .from("plans")
    .createSignedUrl(filePath, 3600);

  if (!signError && signed?.signedUrl) {
    const response = await fetch(signed.signedUrl);
    if (response.ok) {
      return await response.blob();
    }
  }

  throw new Error(
    userDownload.error?.message ??
      "Impossible de télécharger le fichier PDF depuis le stockage."
  );
}

export async function GET(request: NextRequest, context: RouteContext) {
  const { planId } = await context.params;
  const projectId = request.nextUrl.searchParams.get("projectId");

  if (!projectId) {
    return NextResponse.json({ error: "projectId requis." }, { status: 400 });
  }

  try {
    await requireProjectAccess(projectId);
    const supabase = await createClient();

    const { data: plan, error: planError } = await supabase
      .from("plans")
      .select("file_path, project_id")
      .eq("id", planId)
      .eq("project_id", projectId)
      .single();

    if (planError || !plan) {
      return NextResponse.json({ error: "Plan introuvable." }, { status: 404 });
    }

    const fileData = await downloadPlanFile(plan.file_path);
    const buffer = await fileData.arrayBuffer();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Erreur lors du chargement du plan.";
    const status = message.toLowerCase().includes("accès") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
