import { redirect } from "next/navigation";
import { SupabaseSetupNotice } from "@/components/SupabaseSetupNotice";
import { createQuickProject } from "@/lib/actions/projects";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default async function NouveauProjetPcPage() {
  if (!isSupabaseConfigured()) {
    return <SupabaseSetupNotice />;
  }

  const projectId = await createQuickProject();
  redirect(`/pc/projets/${projectId}/parametres`);
}
