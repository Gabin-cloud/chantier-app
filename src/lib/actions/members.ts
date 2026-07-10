"use server";

import { revalidatePath } from "next/cache";
import {
  canManageMembers,
  requireProjectAccess,
  requireProjectRoles,
} from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import type { ProjectRole } from "@/lib/types/database";

export type ProjectMemberWithProfile = {
  id: string;
  project_id: string;
  user_id: string;
  role: ProjectRole;
  created_at: string;
  profiles: {
    email: string;
    full_name: string | null;
  };
};

export async function getProjectMembers(projectId: string) {
  await requireProjectAccess(projectId);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("project_members")
    .select("*, profiles(email, full_name)")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return data as ProjectMemberWithProfile[];
}

export async function addProjectMember(
  projectId: string,
  email: string,
  role: ProjectRole
) {
  const currentRole = await requireProjectAccess(projectId);
  if (!canManageMembers(currentRole)) {
    throw new Error("Seul un administrateur projet peut ajouter des membres.");
  }

  const supabase = await createClient();
  const normalizedEmail = email.trim().toLowerCase();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (profileError) throw new Error(profileError.message);
  if (!profile) {
    throw new Error(
      "Aucun compte trouvé avec cet email. La personne doit d'abord s'inscrire."
    );
  }

  const { error } = await supabase.from("project_members").insert({
    project_id: projectId,
    user_id: profile.id,
    role,
  });

  if (error) {
    if (error.code === "23505") {
      throw new Error("Cette personne a déjà accès au projet.");
    }
    throw new Error(error.message);
  }

  revalidatePath(`/pc/projets/${projectId}/parametres`);
  revalidatePath(`/tablette/projets/${projectId}/parametres`);
}

export async function updateProjectMemberRole(
  projectId: string,
  memberId: string,
  role: ProjectRole
) {
  const currentRole = await requireProjectAccess(projectId);
  if (!canManageMembers(currentRole)) {
    throw new Error("Seul un administrateur projet peut modifier les accès.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("project_members")
    .update({ role })
    .eq("id", memberId)
    .eq("project_id", projectId);

  if (error) throw new Error(error.message);

  revalidatePath(`/pc/projets/${projectId}/parametres`);
  revalidatePath(`/tablette/projets/${projectId}/parametres`);
}

export async function removeProjectMember(projectId: string, memberId: string) {
  const currentRole = await requireProjectAccess(projectId);
  if (!canManageMembers(currentRole)) {
    throw new Error("Seul un administrateur projet peut retirer un membre.");
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("project_members")
    .delete()
    .eq("id", memberId)
    .eq("project_id", projectId);

  if (error) throw new Error(error.message);

  revalidatePath(`/pc/projets/${projectId}/parametres`);
  revalidatePath(`/tablette/projets/${projectId}/parametres`);
}

export async function ensureProjectCreatorMember(
  projectId: string,
  userId: string
) {
  const supabase = await createClient();
  const { error } = await supabase.from("project_members").insert({
    project_id: projectId,
    user_id: userId,
    role: "admin",
  });

  if (error && error.code !== "23505") {
    throw new Error(error.message);
  }
}

export async function requireFinanceAccess(projectId: string) {
  await requireProjectRoles(projectId, ["admin", "gestionnaire", "financier"]);
}

export async function requireFieldEdit(projectId: string) {
  await requireProjectRoles(projectId, ["admin", "gestionnaire", "terrain"]);
}
