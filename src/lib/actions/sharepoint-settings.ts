"use server";

import { requireProjectRoles, requireUser } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import {
  cleanSharePointRelativePath,
  listSharePointFolderSafe,
  testSharePointConnection,
} from "@/lib/microsoft/sharepoint";

export type SharePointActionResult =
  | { ok: true; path: string }
  | { ok: false; error: string };

function mapSupabaseError(message: string): string {
  if (message.includes("sharepoint_plan_exe_path")) {
    return (
      "Colonne SharePoint absente en base. Exécutez la migration " +
      "015_sharepoint_plan_exe.sql dans Supabase."
    );
  }
  if (message.includes("sharepoint_folder_name")) {
    return (
      "Colonne dossier entreprise absente en base. Exécutez la migration " +
      "015_sharepoint_plan_exe.sql dans Supabase."
    );
  }
  return message;
}

export async function updateProjectSharePointPath(
  projectId: string,
  sharepointPlanExePath: string
): Promise<SharePointActionResult> {
  try {
    await requireProjectRoles(projectId, ["admin", "gestionnaire"]);
    const supabase = await createClient();

    const path = cleanSharePointRelativePath(sharepointPlanExePath) || null;

    const { error } = await supabase
      .from("projects")
      .update({ sharepoint_plan_exe_path: path })
      .eq("id", projectId);

    if (error) {
      return { ok: false, error: mapSupabaseError(error.message) };
    }

    return { ok: true, path: path ?? "" };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Enregistrement impossible.",
    };
  }
}

export async function selectSharePointPlanExeFolder(
  projectId: string,
  folderPath: string
): Promise<SharePointActionResult> {
  return updateProjectSharePointPath(projectId, folderPath);
}

export async function updateEnterpriseSharePointFolder(
  projectId: string,
  enterpriseId: string,
  sharepointFolderName: string
): Promise<SharePointActionResult> {
  try {
    await requireProjectRoles(projectId, ["admin", "gestionnaire"]);
    const supabase = await createClient();

    const folderName = sharepointFolderName.trim() || null;

    const { error } = await supabase
      .from("enterprises")
      .update({ sharepoint_folder_name: folderName })
      .eq("id", enterpriseId)
      .eq("project_id", projectId);

    if (error) {
      return { ok: false, error: mapSupabaseError(error.message) };
    }

    return { ok: true, path: folderName ?? "" };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Enregistrement impossible.",
    };
  }
}

export async function checkSharePointConnection() {
  const user = await requireUser();
  return testSharePointConnection(user.id);
}

export async function browseSharePointFolderForProject(
  projectId: string,
  folderPath: string
) {
  try {
    await requireProjectRoles(projectId, ["admin", "gestionnaire"]);
    const user = await requireUser();
    const result = await listSharePointFolderSafe(folderPath, user.id);
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
  } catch (error) {
    return {
      ok: false,
      currentPath: cleanSharePointRelativePath(folderPath),
      driveName: "",
      items: [] as { name: string; isFolder: boolean }[],
      error:
        error instanceof Error ? error.message : "Impossible de lire ce dossier.",
    };
  }
}

/** @deprecated Utiliser browseSharePointFolderForProject */
export async function browseSharePointFolder(folderPath: string) {
  const user = await requireUser();
  const result = await listSharePointFolderSafe(folderPath, user.id);
  return result.items.map((item) => ({
    name: item.name,
    isFolder: item.isFolder,
  }));
}
