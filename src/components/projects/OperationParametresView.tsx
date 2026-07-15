"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { OperationSheet } from "@/components/projects/OperationSheet";
import {
  confirmLeaveIfDirty,
  useUnsavedChangesWarning,
} from "@/hooks/useUnsavedChangesWarning";
import type {
  CompanyDirectoryEntry,
  Enterprise,
  OwnerDirectoryEntry,
  Project,
} from "@/lib/types/database";

type OperationParametresViewProps = {
  project: Project;
  enterprises: Enterprise[];
  directory: CompanyDirectoryEntry[];
  ownerDirectory: OwnerDirectoryEntry[];
  canEdit: boolean;
  invitationMap: Record<string, Record<string, string>>;
  backHref: string;
};

export function OperationParametresView({
  project,
  enterprises,
  directory,
  ownerDirectory,
  canEdit,
  invitationMap,
  backHref,
}: OperationParametresViewProps) {
  const [dirty, setDirty] = useState(false);
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
    </>
  );
}
