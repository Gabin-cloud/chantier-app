import { NextResponse, type NextRequest } from "next/server";
import { getPlanPdfData } from "@/lib/actions/plans";

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
    const base64 = await getPlanPdfData(projectId, planId);
    const buffer = Buffer.from(base64, "base64");

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
