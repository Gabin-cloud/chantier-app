"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { PhaseManager } from "@/components/projects/PhaseManager";
import { OperationSheet } from "@/components/projects/OperationSheet";
import {
  confirmLeaveIfDirty,
  useUnsavedChangesWarning,
} from "@/hooks/useUnsavedChangesWarning";
import type {
  CompanyDirectoryEntry,
  Enterprise,
  OwnerDirectoryEntry,
  PhaseChecklistItem,
  PhaseZone,
  Project,
  VisitPhase,
} from "@/lib/types/database";
import type { WorkControlPlanType } from "@/lib/types/work-control";

type OperationParametresViewProps = {
  project: Project;
  enterprises: Enterprise[];
  directory: CompanyDirectoryEntry[];
  ownerDirectory: OwnerDirectoryEntry[];
  canEdit: boolean;
  invitationMap: Record<string, Record<string, string>>;
  backHref: string;
  phases?: VisitPhase[];
  zones?: PhaseZone[];
  checklistItems?: PhaseChecklistItem[];
  planTypes?: WorkControlPlanType[];
  canEditControls?: boolean;
  initialTab?: "fiche" | "controles";
};

export function OperationParametresView({
  project,
  enterprises,
  directory,
  ownerDirectory,
  canEdit,
  invitationMap,
  backHref,
  phases = [],
  zones = [],
  checklistItems = [],
  planTypes = [],
  canEditControls = false,
  initialTab = "fiche",
}: OperationParametresViewProps) {
  const [dirty, setDirty] = useState(false);
  const [tab, setTab] = useState<"fiche" | "controles">(initialTab);
  useUnsavedChangesWarning(dirty);

  const stableInvitationMap = useMemo(() => invitationMap, [invitationMap]);

  return (
    <>
      <Link
        href={backHref}
        onClick={(event) => {
          if (!confirmLeaveIfDirty(dirty)) {
            event.preventDefault();
          }
        }}
        className="text-sm font-medium text-slate-400 hover:text-slate-600"
      >
        ← Retour à l&apos;opération
      </Link>
      <header className="mb-4 mt-3 rounded-xl border border-slate-200 bg-white px-6 py-4 shadow-sm">
        <h1 className="text-2xl font-semibold text-slate-900">Fiche opération</h1>
        <p className="mt-1 text-slate-500">
          {project.name} — configuration complète de l&apos;opération.
        </p>
        {dirty && (
          <p className="mt-2 text-sm font-medium text-violet-700">
            Modifications non enregistrées — texte en violet.
          </p>
        )}
      </header>

      <div className="mb-4 flex gap-1 border-b border-slate-200">
        <button
          type="button"
          onClick={() => setTab("fiche")}
          className={`rounded-t px-4 py-2 text-sm font-semibold ${
            tab === "fiche"
              ? "bg-white text-slate-900 ring-1 ring-slate-200"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Fiche opération
        </button>
        <button
          type="button"
          onClick={() => setTab("controles")}
          className={`rounded-t px-4 py-2 text-sm font-semibold ${
            tab === "controles"
              ? "bg-white text-emerald-800 ring-1 ring-slate-200"
              : "text-slate-500 hover:text-slate-800"
          }`}
        >
          Panneau de contrôle
        </button>
      </div>

      {tab === "fiche" && (
        <OperationSheet
          project={project}
          enterprises={enterprises}
          directory={directory}
          ownerDirectory={ownerDirectory}
          canEdit={canEdit}
          isOperationConfigured={project.is_operation_configured}
          invitationMap={stableInvitationMap}
          onDirtyChange={setDirty}
        />
      )}

      {tab === "controles" && (
        canEditControls ? (
          <PhaseManager
            projectId={project.id}
            phases={phases}
            checklistItems={checklistItems}
            planTypes={planTypes}
            canEdit={canEditControls}
          />
        ) : (
          <p className="text-sm text-slate-500">
            Droits insuffisants pour configurer les points de contrôle.
          </p>
        )
      )}
    </>
  );
}
