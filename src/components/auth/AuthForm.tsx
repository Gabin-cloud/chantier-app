"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { signIn, signUp } from "@/lib/actions/auth";

type AuthFormProps = {
  redirectTo: string;
};

const inputClass =
  "w-full rounded-xl border-2 border-zinc-200 bg-zinc-50 px-4 py-3 text-base text-zinc-800 placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white focus:outline-none";

export function AuthForm({ redirectTo }: AuthFormProps) {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    const formData = new FormData(e.currentTarget);
    formData.set("redirect", redirectTo);

    startTransition(async () => {
      try {
        const result =
          mode === "login" ? await signIn(formData) : await signUp(formData);

        if (result?.error) {
          setError(result.error);
          return;
        }

        router.refresh();
      } catch (err) {
        const digest =
          err && typeof err === "object" && "digest" in err
            ? String((err as { digest?: string }).digest ?? "")
            : "";
        if (
          err instanceof Error &&
          (err.message.includes("NEXT_REDIRECT") || digest.startsWith("NEXT_REDIRECT"))
        ) {
          return;
        }
        setError(err instanceof Error ? err.message : "Une erreur est survenue.");
      }
    });
  }

  return (
    <div>
      <div className="mb-6 flex rounded-xl bg-zinc-100 p-1">
        <button
          type="button"
          onClick={() => setMode("login")}
          className={`flex-1 rounded-lg py-2.5 text-sm font-semibold ${
            mode === "login" ? "bg-white shadow-sm" : "text-zinc-500"
          }`}
        >
          Connexion
        </button>
        <button
          type="button"
          onClick={() => setMode("signup")}
          className={`flex-1 rounded-lg py-2.5 text-sm font-semibold ${
            mode === "signup" ? "bg-white shadow-sm" : "text-zinc-500"
          }`}
        >
          Inscription
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {mode === "signup" && (
          <div>
            <label htmlFor="full_name" className="mb-2 block text-sm font-semibold text-zinc-800">
              Nom complet
            </label>
            <input
              id="full_name"
              name="full_name"
              placeholder="Jean Dupont"
              className={inputClass}
            />
          </div>
        )}

        <div>
          <label htmlFor="email" className="mb-2 block text-sm font-semibold text-zinc-800">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="vous@entreprise.fr"
            className={inputClass}
          />
        </div>

        <div>
          <label htmlFor="password" className="mb-2 block text-sm font-semibold text-zinc-800">
            Mot de passe
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            placeholder="8 caractères minimum"
            className={inputClass}
          />
        </div>

        {error && (
          <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="min-h-14 w-full rounded-2xl bg-zinc-900 py-4 text-lg font-bold text-white hover:bg-zinc-800 disabled:opacity-50"
        >
          {isPending
            ? "Chargement…"
            : mode === "login"
              ? "Se connecter"
              : "Créer mon compte"}
        </button>
      </form>
    </div>
  );
}
