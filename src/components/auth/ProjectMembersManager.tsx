"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  addProjectMember,
  removeProjectMember,
  updateProjectMemberRole,
  type ProjectMemberWithProfile,
} from "@/lib/actions/members";
import {
  PROJECT_ROLE_DESCRIPTIONS,
  PROJECT_ROLE_LABELS,
  type ProjectRole,
} from "@/lib/types/database";

type ProjectMembersManagerProps = {
  projectId: string;
  members: ProjectMemberWithProfile[];
  canManage: boolean;
};

const ROLES: ProjectRole[] = [
  "admin",
  "gestionnaire",
  "financier",
  "terrain",
  "lecture",
];

const inputClass =
  "w-full rounded-xl border-2 border-zinc-200 bg-zinc-50 px-4 py-3 text-base text-zinc-800 focus:border-zinc-400 focus:bg-white focus:outline-none";

export function ProjectMembersManager({
  projectId,
  members,
  canManage,
}: ProjectMembersManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  function handleAdd(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const form = new FormData(e.currentTarget);
    const email = (form.get("email") as string).trim();
    const role = form.get("role") as ProjectRole;

    startTransition(async () => {
      try {
        await addProjectMember(projectId, email, role);
        e.currentTarget.reset();
        setSuccess("Membre ajouté.");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur.");
      }
    });
  }

  function handleRoleChange(memberId: string, role: ProjectRole) {
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      try {
        await updateProjectMemberRole(projectId, memberId, role);
        setSuccess("Rôle mis à jour.");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur.");
      }
    });
  }

  function handleRemove(memberId: string) {
    if (!confirm("Retirer l'accès de cette personne ?")) return;

    setError(null);
    setSuccess(null);

    startTransition(async () => {
      try {
        await removeProjectMember(projectId, memberId);
        setSuccess("Membre retiré.");
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur.");
      }
    });
  }

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm">
      <h2 className="mb-1 text-lg font-semibold text-zinc-900">
        Accès au projet
      </h2>
      <p className="mb-4 text-sm text-zinc-500">
        Chaque personne voit uniquement les projets auxquels elle est rattachée,
        avec un rôle qui définit ses droits.
      </p>

      {members.length === 0 ? (
        <p className="mb-4 rounded-xl bg-zinc-50 px-4 py-3 text-sm text-zinc-500">
          Aucun membre enregistré.
        </p>
      ) : (
        <ul className="mb-4 space-y-3">
          {members.map((member) => (
            <li
              key={member.id}
              className="rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="font-semibold text-zinc-900">
                    {member.profiles.full_name || member.profiles.email}
                  </p>
                  <p className="text-sm text-zinc-500">{member.profiles.email}</p>
                </div>
                {canManage ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={member.role}
                      disabled={isPending}
                      onChange={(e) =>
                        handleRoleChange(member.id, e.target.value as ProjectRole)
                      }
                      className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                    >
                      {ROLES.map((role) => (
                        <option key={role} value={role}>
                          {PROJECT_ROLE_LABELS[role]}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => handleRemove(member.id)}
                      disabled={isPending}
                      className="rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                    >
                      Retirer
                    </button>
                  </div>
                ) : (
                  <span className="rounded-full bg-zinc-200 px-3 py-1 text-xs font-semibold text-zinc-700">
                    {PROJECT_ROLE_LABELS[member.role]}
                  </span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {canManage && (
        <form onSubmit={handleAdd} className="space-y-3 border-t border-zinc-100 pt-4">
          <h3 className="font-semibold text-zinc-800">Ajouter une personne</h3>
          <p className="text-sm text-zinc-500">
            La personne doit déjà avoir créé un compte avec la même adresse email.
          </p>
          <input
            name="email"
            type="email"
            required
            placeholder="email@entreprise.fr"
            className={inputClass}
          />
          <select
            name="role"
            defaultValue="terrain"
            className={inputClass}
          >
            {ROLES.map((role) => (
              <option key={role} value={role}>
                {PROJECT_ROLE_LABELS[role]} — {PROJECT_ROLE_DESCRIPTIONS[role]}
              </option>
            ))}
          </select>
          <button
            type="submit"
            disabled={isPending}
            className="min-h-12 w-full rounded-xl bg-zinc-900 px-4 py-3 font-semibold text-white disabled:opacity-50"
          >
            {isPending ? "Ajout…" : "Ajouter l'accès"}
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
