"use client";

import { useRouter } from "next/navigation";
import { ProjectForm } from "@/components/projects/ProjectForm";
import { createProject } from "@/lib/actions/projects";
import type { ProjectFormData } from "@/lib/types/database";

type CreateProjectFormProps = {
  basePath: "tablette" | "pc";
};

export function CreateProjectForm({ basePath }: CreateProjectFormProps) {
  const router = useRouter();

  async function handleCreate(formData: ProjectFormData) {
    const projectId = await createProject(formData);
    router.push(`/${basePath}/projets/${projectId}/parametres`);
    router.refresh();
  }

  return (
    <ProjectForm action={handleCreate} submitLabel="Créer le projet" />
  );
}
