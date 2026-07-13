import { NextResponse } from "next/server";
import { getAppBaseUrl } from "@/lib/outlook/app-url";
import { buildOutlookManifestXml } from "@/lib/outlook/manifest-xml";

export async function GET() {
  const base = getAppBaseUrl();
  const manifest = buildOutlookManifestXml(base);

  return new NextResponse(manifest, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
