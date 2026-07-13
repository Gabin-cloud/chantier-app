"use server";

import { revalidatePath } from "next/cache";
import {
  requireProjectRoles,
  requireUser,
} from "@/lib/auth/permissions";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { EnterpriseProjectAccess } from "@/lib/types/sous-traitance";

export type EnterpriseAccessWithProfile = {
  id: string;
  project_id: string;
  user_id: string;
  enterprise_id: string;
  role: "entreprise";
  created_at: string;
  profiles: {
    email: string;
    full_name: string | null;
  };
  enterprises: {
    name: string;
    lot_number: string | null;
  };
};

export async function getEnterpriseProjectAccess(): Promise<EnterpriseProjectAccess[]> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("project_members")
    .select(
      "project_id, enterprise_id, role, projects(id, name, address, city, postal_code, description), enterprises(id, name, lot_number, trade)"
    )
    .eq("user_id", user.id)
    .eq("role", "entreprise")
    .not("enterprise_id", "is", null)
    .order("created_at", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as EnterpriseProjectAccess[];
}

export async function getEnterpriseAccessForProject(projectId: string) {
  await requireProjectRoles(projectId, [
    "admin",
    "gestionnaire",
    "financier",
    "terrain",
    "lecture",
  ]);
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("project_members")
    .select(
      "id, project_id, user_id, enterprise_id, role, created_at, profiles(email, full_name), enterprises(name, lot_number)"
    )
    .eq("project_id", projectId)
    .eq("role", "entreprise")
    .not("enterprise_id", "is", null)
    .order("created_at", { ascending: true });

  if (error) throw new Error(error.message);
  return (data ?? []) as EnterpriseAccessWithProfile[];
}

export async function getEnterpriseMembership(projectId: string) {
  const user = await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("project_members")
    .select("enterprise_id, enterprises(*)")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .eq("role", "entreprise")
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as {
    enterprise_id: string;
    enterprises: {
      id: string;
      name: string;
      lot_number: string | null;
      trade: string | null;
    };
  } | null;
}

export async function inviteEnterpriseUser(
  projectId: string,
  enterpriseId: string,
  email: string,
  password?: string
) {
  await requireProjectRoles(projectId, ["admin", "gestionnaire"]);

  const supabase = await createClient();
  const normalizedEmail = email.trim().toLowerCase();

  const { data: enterprise, error: entError } = await supabase
    .from("enterprises")
    .select("id, name")
    .eq("id", enterpriseId)
    .eq("project_id", projectId)
    .maybeSingle();

  if (entError) throw new Error(entError.message);
  if (!enterprise) throw new Error("Entreprise introuvable sur ce projet.");

  let userId: string;

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (profileError) throw new Error(profileError.message);

  if (profile) {
    userId = profile.id;
  } else {
    if (!password || password.length < 8) {
      throw new Error(
        "Mot de passe requis (8 caractères minimum) pour créer un nouveau compte entreprise."
      );
    }
    if (!isAdminClientConfigured()) {
      throw new Error(
        "La clé SUPABASE_SERVICE_ROLE_KEY est requise pour créer un compte depuis le PC."
      );
    }

    const admin = createAdminClient();
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: normalizedEmail,
      password,
      email_confirm: true,
      user_metadata: { full_name: enterprise.name },
    });

    if (createError) throw new Error(createError.message);
    userId = created.user.id;
  }

  const { error } = await supabase.from("project_members").insert({
    project_id: projectId,
    user_id: userId,
    role: "entreprise",
    enterprise_id: enterpriseId,
  });

  if (error) {
    if (error.code === "23505") {
      throw new Error("Cet utilisateur a déjà un accès sur ce projet.");
    }
    throw new Error(error.message);
  }

  revalidatePath(`/pc/projets/${projectId}/parametres`);
  revalidatePath(`/tablette/projets/${projectId}/parametres`);
  revalidatePath("/entreprise");
}

export async function removeEnterpriseAccess(projectId: string, memberId: string) {
  await requireProjectRoles(projectId, ["admin", "gestionnaire"]);

  const supabase = await createClient();
  const { error } = await supabase
    .from("project_members")
    .delete()
    .eq("id", memberId)
    .eq("project_id", projectId)
    .eq("role", "entreprise");

  if (error) throw new Error(error.message);

  revalidatePath(`/pc/projets/${projectId}/parametres`);
  revalidatePath(`/tablette/projets/${projectId}/parametres`);
  revalidatePath("/entreprise");
}
