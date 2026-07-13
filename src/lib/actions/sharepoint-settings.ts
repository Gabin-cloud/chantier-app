"use server";

import { revalidatePath } from "next/cache";
import { requireProjectRoles } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import {
  listSharePointFolder,
  testSharePointConnection,
} from "@/lib/microsoft/sharepoint";

function revalidateProjectSettings(projectId: string) {
  revalidatePath(`/pc/projets/${projectId}/parametres`);
  revalidatePath(`/tablette/projets/${projectId}/parametres`);
}

export async function updateProjectSharePointPath(
  projectId: string,
  sharepointPlanExePath: string
) {
  await requireProjectRoles(projectId, ["admin", "gestionnaire"]);
  const supabase = await createClient();

  const path = sharepointPlanExePath.trim() || null;

  const { error } = await supabase
    .from("projects")
    .update({ sharepoint_plan_exe_path: path })
    .eq("id", projectId);

  if (error) throw new Error(error.message);
  revalidateProjectSettings(projectId);
}

export async function updateEnterpriseSharePointFolder(
  projectId: string,
  enterpriseId: string,
  sharepointFolderName: string
) {
  await requireProjectRoles(projectId, ["admin", "gestionnaire"]);
  const supabase = await createClient();

  const folderName = sharepointFolderName.trim() || null;

  const { error } = await supabase
    .from("enterprises")
    .update({ sharepoint_folder_name: folderName })
    .eq("id", enterpriseId)
    .eq("project_id", projectId);

  if (error) throw new Error(error.message);
  revalidateProjectSettings(projectId);
}

export async function checkSharePointConnection() {
  return testSharePointConnection();
}

export async function browseSharePointFolder(folderPath: string) {
  return listSharePointFolder(folderPath);
}
