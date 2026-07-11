import { createAdminClient } from "@/lib/supabase/admin";
import { isNotificationEmailConfigured } from "@/lib/microsoft/config";
import { sendNotificationEmail } from "@/lib/microsoft/graph";

type NotifyNewProjectInput = {
  projectId: string;
  projectName: string;
  createdByUserId: string;
  createdByName: string | null;
  createdByEmail: string;
};

function buildProjectUrl(projectId: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base}/pc/projets/${projectId}`;
}

export async function notifyNewProjectCreated(input: NotifyNewProjectInput) {
  if (!isNotificationEmailConfigured()) {
    return;
  }

  const supabase = createAdminClient();
  const { data: recipients, error } = await supabase
    .from("profiles")
    .select("email, full_name")
    .eq("notify_new_projects", true)
    .neq("id", input.createdByUserId);

  if (error) {
    console.error("[notifyNewProjectCreated]", error.message);
    return;
  }

  if (!recipients?.length) {
    return;
  }

  const creatorLabel = input.createdByName || input.createdByEmail;
  const projectUrl = buildProjectUrl(input.projectId);

  const htmlBody = `
    <p>Un nouveau projet a été créé dans Chantier App.</p>
    <ul>
      <li><strong>Projet :</strong> ${escapeHtml(input.projectName)}</li>
      <li><strong>Créé par :</strong> ${escapeHtml(creatorLabel)}</li>
    </ul>
    <p><a href="${projectUrl}">Ouvrir le projet</a></p>
  `;

  try {
    await sendNotificationEmail({
      subject: `[Chantier App] Nouveau projet : ${input.projectName}`,
      htmlBody,
      to: recipients.map((recipient) => ({
        email: recipient.email,
        name: recipient.full_name,
      })),
    });
  } catch (sendError) {
    console.error(
      "[notifyNewProjectCreated]",
      sendError instanceof Error ? sendError.message : sendError
    );
  }
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}
