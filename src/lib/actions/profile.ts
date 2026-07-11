"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import { deleteM365Connection, getM365ConnectionPublic } from "@/lib/microsoft/m365-store";
import {
  isMicrosoftOAuthConfigured,
  isNotificationEmailConfigured,
} from "@/lib/microsoft/config";
import { isAdminClientConfigured } from "@/lib/supabase/admin";
import { isTokenEncryptionConfigured } from "@/lib/microsoft/crypto";

export type ProfileSettingsData = {
  id: string;
  email: string;
  full_name: string | null;
  notify_new_projects: boolean;
  m365: {
    connected: boolean;
    msEmail: string | null;
    connectedAt: string | null;
  };
  capabilities: {
    microsoftOAuth: boolean;
    notifications: boolean;
    tokenStorage: boolean;
  };
};

export async function getProfileSettings(): Promise<ProfileSettingsData> {
  const user = await requireUser();
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("profiles")
    .select("id, email, full_name, notify_new_projects")
    .eq("id", user.id)
    .single();

  if (error) throw new Error(error.message);

  let m365Public = null;
  if (isAdminClientConfigured() && isTokenEncryptionConfigured()) {
    try {
      m365Public = await getM365ConnectionPublic(user.id);
    } catch {
      m365Public = null;
    }
  }

  return {
    id: data.id,
    email: data.email,
    full_name: data.full_name,
    notify_new_projects: data.notify_new_projects ?? true,
    m365: {
      connected: Boolean(m365Public),
      msEmail: m365Public?.msEmail ?? null,
      connectedAt: m365Public?.connectedAt ?? null,
    },
    capabilities: {
      microsoftOAuth: isMicrosoftOAuthConfigured(),
      notifications: isNotificationEmailConfigured(),
      tokenStorage:
        isAdminClientConfigured() && isTokenEncryptionConfigured(),
    },
  };
}

export async function updateProfileSettings(input: {
  full_name?: string;
  notify_new_projects?: boolean;
}) {
  const user = await requireUser();
  const supabase = await createClient();

  const updates: Record<string, unknown> = {};
  if (input.full_name !== undefined) {
    updates.full_name = input.full_name.trim() || null;
  }
  if (input.notify_new_projects !== undefined) {
    updates.notify_new_projects = input.notify_new_projects;
  }

  if (Object.keys(updates).length === 0) {
    return;
  }

  const { error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", user.id);

  if (error) throw new Error(error.message);

  revalidatePath("/pc/profil");
  revalidatePath("/tablette/profil");
  revalidatePath("/pc");
  revalidatePath("/tablette");
}

export async function disconnectMicrosoftAccount() {
  const user = await requireUser();
  await deleteM365Connection(user.id);
  revalidatePath("/pc/profil");
  revalidatePath("/tablette/profil");
}
