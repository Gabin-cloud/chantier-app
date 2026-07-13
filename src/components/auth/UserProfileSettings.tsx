"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import {
  disconnectMicrosoftAccount,
  updateProfileSettings,
  type ProfileSettingsData,
} from "@/lib/actions/profile";

type UserProfileSettingsProps = {
  profile: ProfileSettingsData;
  basePath: "pc" | "tablette";
  outlookManifestUrl?: string;
};

const inputClass =
  "w-full rounded-xl border-2 border-zinc-200 bg-zinc-50 px-4 py-3 text-base text-zinc-800 placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white focus:outline-none";

export function UserProfileSettings({
  profile,
  basePath,
  outlookManifestUrl,
}: UserProfileSettingsProps) {
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [fullName, setFullName] = useState(profile.full_name ?? "");
  const [notifyNewProjects, setNotifyNewProjects] = useState(
    profile.notify_new_projects
  );

  useEffect(() => {
    const status = searchParams.get("microsoft");
    const message = searchParams.get("message");

    if (status === "connected") {
      setSuccess("Compte Microsoft 365 connecté.");
      setError(null);
    } else if (status === "error") {
      setError(message ?? "Connexion Microsoft échouée.");
      setSuccess(null);
    }
  }, [searchParams]);

  function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      try {
        await updateProfileSettings({
          full_name: fullName,
        });
        setSuccess("Profil mis à jour.");
      } catch (saveError) {
        setError(
          saveError instanceof Error ? saveError.message : "Erreur de sauvegarde."
        );
      }
    });
  }

  function handleDisconnect() {
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      try {
        await disconnectMicrosoftAccount();
        setSuccess("Compte Microsoft 365 déconnecté.");
      } catch (disconnectError) {
        setError(
          disconnectError instanceof Error
            ? disconnectError.message
            : "Déconnexion impossible."
        );
      }
    });
  }

  const accentText =
    basePath === "pc" ? "text-slate-600 hover:text-slate-800" : "text-emerald-700 hover:text-emerald-900";
  const accentButton =
    basePath === "pc"
      ? "bg-slate-900 text-white hover:bg-slate-800"
      : "bg-emerald-700 text-white hover:bg-emerald-800";
  const cardBorder =
    basePath === "pc" ? "border-slate-200" : "border-zinc-200";

  const connectUrl = `/api/auth/microsoft?returnTo=/${basePath}/profil`;

  return (
    <div className="space-y-6">
      {error && (
        <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {success}
        </div>
      )}

      <section className={`rounded-2xl border ${cardBorder} bg-white p-5 shadow-sm`}>
        <h2 className="text-lg font-semibold text-zinc-900">Informations personnelles</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Votre identité dans l&apos;application.
        </p>

        <form onSubmit={handleSaveProfile} className="mt-4 space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium text-zinc-700">
              Adresse e-mail
            </label>
            <input
              type="email"
              value={profile.email}
              disabled
              className={`${inputClass} cursor-not-allowed opacity-70`}
            />
          </div>

          <div>
            <label htmlFor="full_name" className="mb-1 block text-sm font-medium text-zinc-700">
              Nom complet
            </label>
            <input
              id="full_name"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className={inputClass}
              placeholder="Votre nom"
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className={`rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-50 ${accentButton}`}
          >
            Enregistrer
          </button>
        </form>
      </section>

      <section className={`rounded-2xl border ${cardBorder} bg-white p-5 shadow-sm`}>
        <h2 className="text-lg font-semibold text-zinc-900">Notifications</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Recevoir un e-mail lorsqu&apos;un nouveau projet est créé.
        </p>

        {!profile.capabilities.notifications && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Les notifications automatiques ne sont pas encore configurées côté serveur
            (alias + Microsoft Graph).
          </p>
        )}

        <form
          onSubmit={(e) => {
            e.preventDefault();
            setError(null);
            setSuccess(null);
            startTransition(async () => {
              try {
                await updateProfileSettings({ notify_new_projects: notifyNewProjects });
                setSuccess("Préférences de notification enregistrées.");
              } catch (saveError) {
                setError(
                  saveError instanceof Error ? saveError.message : "Erreur de sauvegarde."
                );
              }
            });
          }}
          className="mt-4 space-y-4"
        >
          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={notifyNewProjects}
              onChange={(e) => setNotifyNewProjects(e.target.checked)}
              className="mt-1 h-4 w-4 rounded border-zinc-300"
            />
            <span className="text-sm text-zinc-700">
              M&apos;avertir par e-mail quand un nouveau projet est créé
            </span>
          </label>

          <button
            type="submit"
            disabled={isPending}
            className={`rounded-xl px-4 py-3 text-sm font-semibold disabled:opacity-50 ${accentButton}`}
          >
            Enregistrer les notifications
          </button>
        </form>
      </section>

      <section className={`rounded-2xl border ${cardBorder} bg-white p-5 shadow-sm`}>
        <h2 className="text-lg font-semibold text-zinc-900">Microsoft 365</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Connectez votre compte pour préparer des brouillons Outlook (mails type avec
          destinataires et pièces jointes — à relire avant envoi).
        </p>

        {!profile.capabilities.microsoftOAuth && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            La connexion M365 n&apos;est pas configurée (Azure AD + clé de chiffrement).
          </p>
        )}

        {profile.m365.connected ? (
          <div className="mt-4 space-y-3">
            <div className="rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
              Connecté en tant que <strong>{profile.m365.msEmail}</strong>
              {profile.m365.connectedAt && (
                <span className="block text-emerald-700/80">
                  Depuis le{" "}
                  {new Date(profile.m365.connectedAt).toLocaleDateString("fr-FR", {
                    dateStyle: "medium",
                  })}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={handleDisconnect}
              disabled={isPending}
              className="rounded-xl border border-zinc-200 px-4 py-3 text-sm font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-50"
            >
              Déconnecter Microsoft 365
            </button>
          </div>
        ) : (
          profile.capabilities.microsoftOAuth &&
          profile.capabilities.tokenStorage && (
            <Link
              href={connectUrl}
              className={`mt-4 inline-flex rounded-xl px-4 py-3 text-sm font-semibold ${accentButton}`}
            >
              Connecter mon compte Microsoft 365
            </Link>
          )
        )}
      </section>

      {basePath === "pc" && outlookManifestUrl && (
        <section className={`rounded-2xl border ${cardBorder} bg-white p-5 shadow-sm`}>
          <h2 className="text-lg font-semibold text-zinc-900">
            Complément Outlook
          </h2>
          <p className="mt-1 text-sm text-zinc-500">
            Ajoutez le bouton <strong>Classer</strong> dans la barre d&apos;outils
            d&apos;Outlook pour trier les pièces jointes du mail ouvert.
          </p>
          <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-zinc-600">
            <li>Outlook → Fichier → Obtenir des compléments</li>
            <li>Mes compléments → + Ajouter un complément personnalisé</li>
            <li>Ajouter à partir d&apos;une URL → collez l&apos;URL ci-dessous</li>
          </ol>
          <div className="mt-3 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-700 break-all">
            {outlookManifestUrl}
          </div>
        </section>
      )}

      <p className="text-sm">
        <Link href={`/${basePath}`} className={`font-medium ${accentText}`}>
          ← Retour aux projets
        </Link>
      </p>
    </div>
  );
}
