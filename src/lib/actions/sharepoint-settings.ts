"use server";

import { revalidatePath } from "next/cache";
import { requireProjectRoles } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import {
  cleanSharePointRelativePath,
  listSharePointFolderSafe,
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

  const path = cleanSharePointRelativePath(sharepointPlanExePath) || null;

  const { error } = await supabase
    .from("projects")
    .update({ sharepoint_plan_exe_path: path })
    .eq("id", projectId);

  if (error) throw new Error(error.message);
  revalidateProjectSettings(projectId);
  return path ?? "";
}

export async function selectSharePointPlanExeFolder(
  projectId: string,
  folderPath: string
) {
  return updateProjectSharePointPath(projectId, folderPath);
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

export async function browseSharePointFolderForProject(
  projectId: string,
  folderPath: string
) {
  await requireProjectRoles(projectId, ["admin", "gestionnaire", "finance"]);
  const result = await listSharePointFolderSafe(folderPath);
  return {
    ok: result.ok,
    currentPath: result.currentPath,
    driveName: result.driveName,
    items: result.items.map((item) => ({
      name: item.name,
      isFolder: item.isFolder,
    })),
    error: result.error,
  };
}

/** @deprecated Utiliser browseSharePointFolderForProject */
export async function browseSharePointFolder(folderPath: string) {
  const result = await listSharePointFolderSafe(folderPath);
  return result.items.map((item) => ({
    name: item.name,
    isFolder: item.isFolder,
  }));
}
