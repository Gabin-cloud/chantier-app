"use client";

import { useEffect, useState, useTransition } from "react";
import { OperationAdvancedSettings } from "@/components/projects/OperationAdvancedSettings";
import { getProjectConfigBundle } from "@/lib/actions/project-config";
import type { Project } from "@/lib/types/database";

type GlobalProjectConfigProps = {
  projects: Project[];
};

export function GlobalProjectConfig({ projects }: GlobalProjectConfigProps) {
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "");
  const [bundle, setBundle] = useState<Awaited<ReturnType<typeof getProjectConfigBundle>> | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!projectId) return;
    startTransition(async () => {
      const data = await getProjectConfigBundle(projectId);
      setBundle(data);
    });
  }, [projectId]);

  if (projects.length === 0) {
    return <p className="text-sm text-slate-500">Aucune opération disponible.</p>;
  }

  return (
    <div className="space-y-4">
      <div>
        <label className="mb-1.5 block text-sm font-semibold text-slate-700">
          Opération à configurer
        </label>
        <select
          className="w-full max-w-md rounded-xl border-2 border-slate-200 bg-slate-50 px-4 py-2.5 text-base"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
        >
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
      </div>

      {isPending && !bundle && (
        <p className="text-sm text-slate-500">Chargement…</p>
      )}

      {bundle && (
        <OperationAdvancedSettings
          projectId={projectId}
          members={bundle.members}
          phases={bundle.phases}
          zones={bundle.zones}
          checklistItems={bundle.checklistItems}
          planTypes={bundle.planTypes}
          canManageMembers={bundle.canManageMembers}
          canEditPlans={bundle.canEditPlans}
          canEdit={bundle.canEdit}
        />
      )}
    </div>
  );
}
