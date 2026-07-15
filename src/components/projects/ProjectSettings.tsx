"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { LocationManager } from "@/components/projects/LocationManager";
import { PhaseManager } from "@/components/projects/PhaseManager";
import { PlanManager } from "@/components/projects/PlanManager";
import { SharePointPathSettings } from "@/components/projects/SharePointPathSettings";
import { ProjectForm } from "@/components/projects/ProjectForm";
import { ProjectMembersManager } from "@/components/auth/ProjectMembersManager";
import { EnterpriseAccessManager } from "@/components/entreprise/EnterpriseAccessManager";
import type { EnterpriseAccessWithProfile } from "@/lib/actions/enterprise-access";
import type { ProjectMemberWithProfile } from "@/lib/actions/members";
import {
  addEnterprise,
  deleteEnterprise,
  updateProject,
} from "@/lib/actions/projects";
import type { Enterprise, Plan, PlanFolder, PhaseChecklistItem, Project, ProjectFormData, ProjectLocation, PhaseZone, VisitPhase } from "@/lib/types/database";

type PlanWithUrl = Plan & { pdf_url: string };

type ProjectSettingsProps = {
  project: Project;
  enterprises: Enterprise[];
  plans: PlanWithUrl[];
  planFolders?: PlanFolder[];
  phases?: VisitPhase[];
  zones?: PhaseZone[];
  checklistItems?: PhaseChecklistItem[];
  locations: ProjectLocation[];
  members: ProjectMemberWithProfile[];
  enterpriseAccess?: EnterpriseAccessWithProfile[];
  basePath: "tablette" | "pc";
  canEdit: boolean;
  canManageMembers: boolean;
  canEditPlans: boolean;
  showProjectInfo?: boolean;
  showSharePoint?: boolean;
};

const inputClass =
  "w-full rounded-xl border-2 border-zinc-200 bg-zinc-50 px-4 py-3 text-base text-zinc-800 placeholder:text-zinc-400 focus:border-zinc-400 focus:bg-white focus:outline-none";

export function ProjectSettings({
  project,
  enterprises,
  plans,
  planFolders = [],
  phases = [],
  zones = [],
  checklistItems = [],
  locations,
  members,
  enterpriseAccess = [],
  basePath,
  canEdit,
  canManageMembers,
  canEditPlans,
  showProjectInfo = true,
  showSharePoint = true,
}: ProjectSettingsProps) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const initialData: ProjectFormData = {
    name: project.name,
    address: project.address ?? undefined,
    city: project.city ?? undefined,
    postal_code: project.postal_code ?? undefined,
    description: project.description ?? undefined,
  };

  async function handleUpdateProject(data: ProjectFormData) {
    await updateProject(project.id, data);
    setSuccess("Projet mis à jour.");
    setError(null);
  }

  function handleAddEnterprise(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    const form = new FormData(e.currentTarget);
    const name = (form.get("enterprise_name") as string).trim();

    if (!name) {
      setError("Le nom de l'entreprise est obligatoire.");
      return;
    }

    startTransition(async () => {
      try {
        await addEnterprise(project.id, {
          name,
          trade: (form.get("trade") as string).trim() || undefined,
          contact_name: (form.get("contact_name") as string).trim() || undefined,
          contact_email: (form.get("contact_email") as string).trim() || undefined,
          contact_phone: (form.get("contact_phone") as string).trim() || undefined,
        });
        e.currentTarget.reset();
        setSuccess("Entreprise ajoutée.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Une erreur est survenue.");
      }
    });
  }

  function handleDeleteEnterprise(enterpriseId: string) {
    setError(null);
    setSuccess(null);

    startTransition(async () => {
      try {
        await deleteEnterprise(project.id, enterpriseId);
        setSuccess("Entreprise supprimée.");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Une erreur est survenue.");
      }
    });
  }

  return (
    <div className="space-y-6">
      <ProjectMembersManager
        projectId={project.id}
        members={members.filter((m) => m.role !== "entreprise")}
        canManage={canManageMembers}
      />

      <EnterpriseAccessManager
        projectId={project.id}
        enterprises={enterprises}
        accessList={enterpriseAccess}
        canManage={canManageMembers || canEdit}
      />

      {canEdit && (
      <>
      {showProjectInfo && (
      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-4 text-lg font-semibold text-zinc-900">
          Informations du projet
        </h2>
        <ProjectForm
          action={handleUpdateProject}
          submitLabel="Enregistrer les modifications"
          initialData={initialData}
        />
      </section>
      )}

      {canEditPlans && showSharePoint && (
        <SharePointPathSettings project={project} canEdit={canEdit} />
      )}

      {canEditPlans && (
        <PlanManager
          projectId={project.id}
          initialPlans={plans}
          initialFolders={planFolders}
        />
      )}

      {canEditPlans && (
        <PhaseManager
          projectId={project.id}
          phases={phases}
          zones={zones}
          checklistItems={checklistItems}
          canEdit={canEdit}
        />
      )}

      {canEditPlans && (
        <LocationManager
          projectId={project.id}
          locations={locations}
          canEdit={canEdit}
        />
      )}

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="mb-1 text-lg font-semibold text-zinc-900">
          Entreprises sur le chantier
        </h2>
        <p className="mb-4 text-sm text-zinc-500">
          Ajoutez les entreprises intervenant sur ce projet.
        </p>

        {enterprises.length === 0 ? (
          <p className="mb-4 rounded-xl bg-zinc-50 px-4 py-3 text-sm text-zinc-500">
            Aucune entreprise renseignée pour l&apos;instant.
          </p>
        ) : (
          <ul className="mb-4 space-y-3">
            {enterprises.map((enterprise) => (
              <li
                key={enterprise.id}
                className="flex items-start justify-between gap-3 rounded-xl border border-zinc-100 bg-zinc-50 px-4 py-3"
              >
                <div>
                  <p className="font-semibold text-zinc-900">{enterprise.name}</p>
                  {enterprise.trade && (
                    <p className="text-sm text-zinc-500">{enterprise.trade}</p>
                  )}
                  {enterprise.contact_name && (
                    <p className="mt-1 text-sm text-zinc-600">
                      {enterprise.contact_name}
                      {enterprise.contact_phone && ` · ${enterprise.contact_phone}`}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => handleDeleteEnterprise(enterprise.id)}
                  disabled={isPending}
                  className="shrink-0 rounded-lg px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                >
                  Supprimer
                </button>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={handleAddEnterprise} className="space-y-3 border-t border-zinc-100 pt-4">
          <h3 className="font-semibold text-zinc-800">Ajouter une entreprise</h3>
          <input
            name="enterprise_name"
            required
            placeholder="Nom de l'entreprise *"
            className={inputClass}
          />
          <input name="trade" placeholder="Corps de métier" className={inputClass} />
          <input name="contact_name" placeholder="Nom du contact" className={inputClass} />
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <input
              name="contact_email"
              type="email"
              placeholder="Email"
              className={inputClass}
            />
            <input name="contact_phone" placeholder="Téléphone" className={inputClass} />
          </div>
          <button
            type="submit"
            disabled={isPending}
            className="min-h-12 w-full rounded-xl bg-emerald-600 px-4 py-3 font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:bg-emerald-300"
          >
            {isPending ? "Ajout…" : "Ajouter l'entreprise"}
          </button>
        </form>
      </section>
      </>
      )}

      {!canEdit && canEditPlans && (
        <PlanManager
          projectId={project.id}
          initialPlans={plans}
          initialFolders={planFolders}
        />
      )}

      {error && (
        <p className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </p>
      )}
      {success && (
        <p className="rounded-xl bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          {success}
        </p>
      )}

      <Link
        href={`/${basePath}/projets/${project.id}`}
        className="block text-center text-sm font-medium text-zinc-500 hover:text-zinc-700"
      >
        ← Retour au projet
      </Link>
    </div>
  );
}
