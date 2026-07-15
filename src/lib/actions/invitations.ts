"use server";

import { revalidatePath } from "next/cache";
import { requireProjectRoles, requireUser } from "@/lib/auth/permissions";
import { getPlatformInvitationEmailTemplate } from "@/lib/actions/email-templates";
import { createClient } from "@/lib/supabase/server";
import { sendUserMail } from "@/lib/microsoft/graph";
import { buildInvitationEmailFromTemplates } from "@/lib/notifications/invitation-email";

export async function sendEnterpriseInvitation(
  projectId: string,
  email: string,
  enterpriseId: string
): Promise<{ ok: true; message: string } | { ok: false; error: string }> {
  try {
    const user = await requireUser();
    await requireProjectRoles(projectId, ["admin", "gestionnaire"]);

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return { ok: false, error: "Adresse e-mail invalide." };
    }

    const supabase = await createClient();

    const [{ data: project }, { data: enterprise }, { data: profile }] =
      await Promise.all([
        supabase.from("projects").select("name").eq("id", projectId).single(),
        supabase
          .from("enterprises")
          .select("id, name")
          .eq("id", enterpriseId)
          .eq("project_id", projectId)
          .single(),
        supabase
          .from("profiles")
          .select("email_signature_html")
          .eq("id", user.id)
          .single(),
      ]);

    if (!enterprise) {
      return { ok: false, error: "Entreprise introuvable sur ce projet." };
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
    const template = await getPlatformInvitationEmailTemplate();
    const emailContent = buildInvitationEmailFromTemplates(
      template.subjectTemplate,
      template.bodyTemplate,
      {
        projectName: project?.name ?? "Opération",
        enterpriseName: enterprise.name,
        platformUrl: `${appUrl}/login`,
        signatureHtml: profile?.email_signature_html ?? null,
      }
    );

    await sendUserMail(user.id, {
      subject: emailContent.subject,
      htmlBody: emailContent.htmlBody,
      to: [{ email: normalizedEmail, name: enterprise.name }],
    });

    const { data: existingProfile } = await supabase
      .from("profiles")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    let accessMessage =
      "Invitation envoyée par e-mail. L'utilisateur devra créer son compte puis se connecter.";

    if (existingProfile) {
      const { error: memberError } = await supabase.from("project_members").insert({
        project_id: projectId,
        user_id: existingProfile.id,
        role: "entreprise",
        enterprise_id: enterpriseId,
      });

      if (memberError && memberError.code !== "23505") {
        return { ok: false, error: memberError.message };
      }

      if (!memberError) {
        accessMessage =
          "Invitation envoyée et accès entreprise créé pour ce compte existant.";
      } else {
        accessMessage = "Invitation envoyée. Cet utilisateur a déjà accès au projet.";
      }
    }

    revalidatePath(`/pc/projets/${projectId}/parametres`);
    revalidatePath("/entreprise");
    return { ok: true, message: accessMessage };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erreur lors de l'envoi.";
    return { ok: false, error: message };
  }
}
