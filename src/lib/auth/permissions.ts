import { createClient } from "@/lib/supabase/server";
import type { AccountKind, GlobalRole, ProjectRole } from "@/lib/types/database";

export async function getSessionUser() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error) throw new Error(error.message);
  return user;
}

export async function requireUser() {
  const user = await getSessionUser();
  if (!user) throw new Error("Connexion requise.");
  return user;
}

export async function getProfile() {
  const user = await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  if (error) throw new Error(error.message);
  return data as {
    id: string;
    email: string;
    full_name: string | null;
    global_role: GlobalRole;
    account_kind: AccountKind;
  };
}

export async function getProjectRole(projectId: string): Promise<ProjectRole | null> {
  const user = await getSessionUser();
  if (!user) return null;

  const supabase = await createClient();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("global_role")
    .eq("id", user.id)
    .single();

  if (profileError) throw new Error(profileError.message);

  if (profile.global_role === "super_admin") {
    return "admin";
  }

  const { data, error } = await supabase
    .from("project_members")
    .select("role")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return (data?.role as ProjectRole) ?? null;
}

export async function requireProjectAccess(projectId: string) {
  const role = await getProjectRole(projectId);
  if (!role) throw new Error("Accès refusé à ce projet.");
  return role;
}

export async function requireProjectRoles(
  projectId: string,
  allowed: ProjectRole[]
) {
  const role = await requireProjectAccess(projectId);
  if (!allowed.includes(role)) {
    throw new Error("Droits insuffisants pour cette action.");
  }
  return role;
}

export function canEditProject(role: ProjectRole) {
  return role === "admin" || role === "gestionnaire";
}

export function canManageMembers(role: ProjectRole) {
  return role === "admin";
}

export function canAccessFinance(role: ProjectRole) {
  return role === "admin" || role === "gestionnaire" || role === "financier";
}

export function canEditFinance(role: ProjectRole) {
  return canAccessFinance(role);
}

export function canAccessField(role: ProjectRole) {
  return role === "admin" || role === "gestionnaire" || role === "terrain";
}

export function canEditField(role: ProjectRole) {
  return canAccessField(role);
}
