"use server";

import { revalidatePath } from "next/cache";
import { requireProjectRoles } from "@/lib/auth/permissions";
import { createAdminClient, isAdminClientConfigured } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { ProjectRole } from "@/lib/types/database";

export type InvitationContext =
  | { type: "enterprise"; enterpriseId: string }
  | { type: "platform"; role?: ProjectRole };

export async function sendPlatformInvitation(
  projectId: string,
  email: string,
  context: InvitationContext
) {
  await requireProjectRoles(projectId, ["admin", "gestionnaire"]);

  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail || !normalizedEmail.includes("@")) {
    throw new Error("Adresse e-mail invalide.");
  }

  const supabase = await createClient();

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("id, email")
    .eq("email", normalizedEmail)
    .maybeSingle();

  if (profileError) throw new Error(profileError.message);

  let userId = profile?.id;

  if (!userId) {
    if (!isAdminClientConfigured()) {
      throw new Error(
        "La clé SUPABASE_SERVICE_ROLE_KEY est requise pour envoyer une invitation."
      );
    }

    const admin = createAdminClient();
    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const { data: invited, error: inviteError } =
      await admin.auth.admin.inviteUserByEmail(normalizedEmail, {
        redirectTo: `${appUrl}/login`,
      });

    if (inviteError) throw new Error(inviteError.message);
    userId = invited.user.id;
  }

  const role: ProjectRole =
    context.type === "enterprise" ? "entreprise" : (context.role ?? "lecture");

  const insertPayload: {
    project_id: string;
    user_id: string;
    role: ProjectRole;
    enterprise_id?: string;
  } = {
    project_id: projectId,
    user_id: userId,
    role,
  };

  if (context.type === "enterprise") {
    const { data: enterprise, error: entError } = await supabase
      .from("enterprises")
      .select("id")
      .eq("id", context.enterpriseId)
      .eq("project_id", projectId)
      .maybeSingle();

    if (entError) throw new Error(entError.message);
    if (!enterprise) throw new Error("Entreprise introuvable sur ce projet.");
    insertPayload.enterprise_id = context.enterpriseId;
  }

  const { error } = await supabase.from("project_members").insert(insertPayload);

  if (error) {
    if (error.code === "23505") {
      throw new Error("Cet utilisateur a déjà accès à ce projet.");
    }
    throw new Error(error.message);
  }

  revalidatePath(`/pc/projets/${projectId}/parametres`);
  revalidatePath("/entreprise");
}
