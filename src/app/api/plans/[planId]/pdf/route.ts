import { NextResponse, type NextRequest } from "next/server";
import { requireProjectAccess } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";

type RouteContext = {
  params: Promise<{ planId: string }>;
};

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

    const { data: fileData, error: downloadError } = await supabase.storage
      .from("plans")
      .download(plan.file_path);

    if (downloadError || !fileData) {
      return NextResponse.json(
        { error: downloadError?.message ?? "Fichier PDF introuvable." },
        { status: 404 }
      );
    }

    const buffer = await fileData.arrayBuffer();

    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Accès refusé.";
    const status = message.includes("Accès") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
