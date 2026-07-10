"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function signIn(formData: FormData) {
  const email = (formData.get("email") as string)?.trim();
  const password = formData.get("password") as string;

  if (!email || !password) {
    throw new Error("Email et mot de passe requis.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) throw new Error(error.message);
}

export async function signUp(formData: FormData) {
  const email = (formData.get("email") as string)?.trim();
  const password = formData.get("password") as string;
  const fullName = (formData.get("full_name") as string)?.trim();

  if (!email || !password) {
    throw new Error("Email et mot de passe requis.");
  }

  if (password.length < 8) {
    throw new Error("Le mot de passe doit contenir au moins 8 caractères.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName || undefined },
    },
  });

  if (error) throw new Error(error.message);
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
