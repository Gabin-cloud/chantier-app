"use client";

import { useState } from "react";
import { PhaseManager } from "@/components/projects/PhaseManager";
import { ProjectMembersManager } from "@/components/auth/ProjectMembersManager";
import type { ProjectMemberWithProfile } from "@/lib/actions/members";
import type { PhaseChecklistItem, PhaseZone, VisitPhase } from "@/lib/types/database";

type OperationAdvancedSettingsProps = {
  projectId: string;
  members: ProjectMemberWithProfile[];
  phases: VisitPhase[];
  zones: PhaseZone[];
  checklistItems: PhaseChecklistItem[];
  planTypes: import("@/lib/types/work-control").WorkControlPlanType[];
  canManageMembers: boolean;
  canEditPlans: boolean;
  canEdit: boolean;
};

const tabBtn =
  "-mb-px border-b-2 px-2.5 py-1.5 text-[13px] font-medium transition-colors";

export function OperationAdvancedSettings({
  projectId,
  members,
  phases,
  zones,
  checklistItems,
  planTypes,
  canManageMembers,
  canEditPlans,
  canEdit,
}: OperationAdvancedSettingsProps) {
  const [tab, setTab] = useState<"membres" | "controles">("membres");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setTab("membres")}
          className={`${tabBtn} ${
            tab === "membres"
              ? "border-blue-600 text-blue-700"
              : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800"
          }`}
        >
          Membres
        </button>
        <button
          type="button"
          onClick={() => setTab("controles")}
          className={`${tabBtn} ${
            tab === "controles"
              ? "border-blue-600 text-blue-700"
              : "border-transparent text-slate-500 hover:border-slate-300 hover:text-slate-800"
          }`}
        >
          Panneaux de contrôle
        </button>
      </div>

      {tab === "membres" && (
        <ProjectMembersManager
          projectId={projectId}
          members={members.filter((m) => m.role !== "entreprise")}
          canManage={canManageMembers}
        />
      )}

      {tab === "controles" && canEditPlans && (
        <PhaseManager
          projectId={projectId}
          phases={phases}
          checklistItems={checklistItems}
          planTypes={planTypes}
          canEdit={canEdit}
        />
      )}
    </div>
  );
}
