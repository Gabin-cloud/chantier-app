"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

type AuthResult = { error?: string };

function safeRedirectPath(value: FormDataEntryValue | null) {
  const path = typeof value === "string" ? value.trim() : "";
  if (path.startsWith("/pc") || path.startsWith("/tablette") || path.startsWith("/entreprise") || path === "/") {
    return path;
  }
  return "/";
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

  redirect(redirectTo);
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
      data: { full_name: fullName || undefined },
    },
  });

  if (error) {
    return { error: error.message };
  }

  redirect(redirectTo);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
