"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  inviteEnterpriseUser,
  removeEnterpriseAccess,
  type EnterpriseAccessWithProfile,
} from "@/lib/actions/enterprise-access";
import type { Enterprise } from "@/lib/types/database";

type EnterpriseAccessManagerProps = {
  projectId: string;
  enterprises: Enterprise[];
  accessList: EnterpriseAccessWithProfile[];
  canManage: boolean;
};

const inputClass =
  "w-full rounded-xl border-2 border-zinc-200 bg-zinc-50 px-4 py-3 text-base text-zinc-800 focus:border-zinc-400 focus:bg-white focus:outline-none";

export function EnterpriseAccessManager({
  projectId,
  enterprises,
  accessList,
  canManage,
}: EnterpriseAccessManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function handleInvite(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const form = new FormData(e.currentTarget);
    const enterpriseId = form.get("enterprise_id") as string;
    const email = (form.get("email") as string).trim();
    const password = (form.get("password") as string) || undefined;

    startTransition(async () => {
      try {
        await inviteEnterpriseUser(projectId, enterpriseId, email, password);
        e.currentTarget.reset();
        setSuccess(
          "Accès entreprise créé. L'utilisateur peut se connecter sur l'interface Entreprise."
        );
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur.");
      }
    });
  }

  function handleRemove(memberId: string) {
    if (!confirm("Retirer cet accès entreprise ?")) return;
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      try {
        await removeEnterpriseAccess(projectId, memberId);
        setSuccess("Accès retiré.");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur.");
      }
    });
  }

  if (enterprises.length === 0) {
    return (
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-1 text-lg font-semibold text-zinc-900">
          Accès entreprises
        </h2>
        <p className="text-sm text-zinc-500">
          Ajoutez d&apos;abord une entreprise sur le chantier pour créer un
          compte sous-traitant.
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="mb-1 text-lg font-semibold text-zinc-900">
        Accès entreprises (sous-traitance)
      </h2>
      <p className="mb-4 text-sm text-zinc-500">
        Créez un compte pour qu&apos;une entreprise accède à l&apos;interface
        Entreprise, consulte les chantiers partagés et dépose ses demandes de
        sous-traitance.
      </p>

      {accessList.length > 0 && (
        <ul className="mb-4 space-y-3">
          {accessList.map((access) => (
            <li
              key={access.id}
              className="flex flex-col gap-2 rounded-xl border border-amber-100 bg-amber-50/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="font-semibold text-zinc-900">
                  {access.enterprises.name}
                  {access.enterprises.lot_number &&
                    ` — Lot ${access.enterprises.lot_number}`}
                </p>
                <p className="text-sm text-zinc-600">
                  {access.profiles.full_name || access.profiles.email}
                </p>
                <p className="text-xs text-zinc-400">{access.profiles.email}</p>
              </div>
              {canManage && (
                <button
                  type="button"
                  onClick={() => handleRemove(access.id)}
                  disabled={isPending}
                  className="shrink-0 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                >
                  Retirer
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canManage && (
        <form onSubmit={handleInvite} className="space-y-3 border-t border-zinc-100 pt-4">
          <h3 className="font-semibold text-zinc-800">
            Créer un accès entreprise
          </h3>
          <select
            name="enterprise_id"
            required
            defaultValue=""
            className={inputClass}
          >
            <option value="" disabled>
              Choisir l&apos;entreprise…
            </option>
            {enterprises.map((ent) => (
              <option key={ent.id} value={ent.id}>
                {ent.name}
                {ent.lot_number ? ` (Lot ${ent.lot_number})` : ""}
              </option>
            ))}
          </select>
          <input
            name="email"
            type="email"
            required
            placeholder="email@entreprise.fr"
            className={inputClass}
          />
          <input
            name="password"
            type="password"
            minLength={8}
            placeholder="Mot de passe (si nouveau compte — 8 car. min.)"
            className={inputClass}
          />
          <p className="text-xs text-zinc-500">
            Si le compte n&apos;existe pas, le mot de passe est obligatoire. Sinon,
            l&apos;email existant sera rattaché à l&apos;entreprise.
          </p>
          <button
            type="submit"
            disabled={isPending}
            className="min-h-12 w-full rounded-xl bg-amber-600 px-4 py-3 font-semibold text-white hover:bg-amber-500 disabled:opacity-50"
          >
            {isPending ? "Création…" : "Créer l'accès entreprise"}
          </button>
        </form>
      )}

      {error && (
        <p className="mt-4 rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
      {success && (
        <p className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          {success}
        </p>
      )}
    </section>
  );
}
