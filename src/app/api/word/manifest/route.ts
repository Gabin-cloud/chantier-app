import { NextResponse } from "next/server";
import { getAppBaseUrl } from "@/lib/outlook/app-url";
import { buildWordManifestXml } from "@/lib/word/manifest-xml";

export async function GET() {
  const base = getAppBaseUrl();
  const manifest = buildWordManifestXml(base);

  return new NextResponse(manifest, {
    headers: {
      "Content-Type": "application/xml",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
