"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { homePathForAccount } from "@/lib/auth/account";
import { createClient } from "@/lib/supabase/server";
import type { AccountKind } from "@/lib/types/database";

type AuthResult = { error?: string };

function safeRedirectPath(value: FormDataEntryValue | null) {
  const path = typeof value === "string" ? value.trim() : "";
  if (
    path.startsWith("/pc") ||
    path.startsWith("/tablette") ||
    path.startsWith("/entreprise") ||
    path.startsWith("/outlook") ||
    path.startsWith("/word") ||
    path === "/"
  ) {
    return path;
  }
  return "/";
}

async function redirectAfterAuth(requestedPath: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("account_kind")
    .eq("id", user.id)
    .maybeSingle();

  const accountKind = (profile?.account_kind as AccountKind | undefined) ?? "danobat";
  const ua = (await headers()).get("user-agent");
  const home = homePathForAccount(accountKind, ua);

  // Respecter un redirect explicite seulement s'il correspond au type de compte
  if (requestedPath === "/") {
    redirect(home);
  }

  if (accountKind === "entreprise") {
    if (requestedPath.startsWith("/entreprise")) {
      redirect(requestedPath);
    }
    redirect("/entreprise");
  }

  // DANOBAT : pas d'accès portail entreprise
  if (requestedPath.startsWith("/entreprise")) {
    redirect(home);
  }

  if (requestedPath.startsWith("/pc") || requestedPath.startsWith("/tablette")) {
    redirect(requestedPath);
  }

  redirect(home);
}

export async function signIn(formData: FormData): Promise<AuthResult> {
  const email = (formData.get("email") as string)?.trim();
  const password = formData.get("password") as string;
  const redirectTo = safeRedirectPath(formData.get("redirect"));

  if (!email || !password) {
    return { error: "Email et mot de passe requis." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    return { error: error.message };
  }

  await redirectAfterAuth(redirectTo);
  return {};
}

export async function signUp(formData: FormData): Promise<AuthResult> {
  const email = (formData.get("email") as string)?.trim();
  const password = formData.get("password") as string;
  const fullName = (formData.get("full_name") as string)?.trim();
  const redirectTo = safeRedirectPath(formData.get("redirect"));

  if (!email || !password) {
    return { error: "Email et mot de passe requis." };
  }

  if (password.length < 8) {
    return { error: "Le mot de passe doit contenir au moins 8 caractères." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName || undefined,
        account_kind: "danobat",
      },
    },
  });

  if (error) {
    return { error: error.message };
  }

  await redirectAfterAuth(redirectTo);
  return {};
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
