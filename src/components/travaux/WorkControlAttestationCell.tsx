"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  linkVisitReportToExecution,
  uploadWorkControlAttestation,
} from "@/lib/actions/work-control";
import { DocumentLink } from "@/components/documents/DocumentLink";
import type { WorkControlExecution } from "@/lib/types/work-control";

type WorkControlAttestationCellProps = {
  projectId: string;
  checklistItemId: string;
  planLevelId: string;
  execution: WorkControlExecution | null;
  visitId: string | null;
  canAdmin: boolean;
  attestationUrl: string | null;
};

function fileLabel(execution: WorkControlExecution | null): string | null {
  if (!execution?.report_path) return null;
  const raw =
    execution.report_file_name ??
    execution.report_path.split("/").pop() ??
    "Attestation.pdf";
  if (
    execution.notes === "Levée terrain" ||
    /rapport/i.test(raw) ||
    !execution.report_path.includes("/work-control/")
  ) {
    return "Rapport de visite";
  }
  return raw;
}

export function WorkControlAttestationCell({
  projectId,
  checklistItemId,
  planLevelId,
  execution,
  visitId,
  canAdmin,
  attestationUrl,
}: WorkControlAttestationCellProps) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const name = fileLabel(execution);
  const date = execution?.attestation_date ?? null;

  function uploadFile(file: File) {
    setError(null);
    const formData = new FormData();
    formData.set("file", file);
    startTransition(async () => {
      try {
        await uploadWorkControlAttestation(
          projectId,
          checklistItemId,
          planLevelId,
          formData
        );
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur upload.");
      }
    });
  }

  function linkVisitReport() {
    if (!visitId) {
      setError("Aucune visite terrain liée.");
      return;
    }
    setError(null);
    startTransition(async () => {
      try {
        await linkVisitReportToExecution(
          projectId,
          checklistItemId,
          planLevelId,
          visitId
        );
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Erreur.");
      }
    });
  }

  if (name && attestationUrl) {
    return (
      <div className="min-w-[9rem] space-y-1">
        <DocumentLink
          url={attestationUrl}
          title={name}
          className="block truncate text-[11px] font-semibold text-emerald-800 underline"
        >
          {name}
        </DocumentLink>
        {date && <p className="text-[10px] text-slate-500">{date}</p>}
        {canAdmin && (
          <button
            type="button"
            disabled={isPending}
            onClick={() => inputRef.current?.click()}
            className="text-[10px] text-violet-700 hover:underline disabled:opacity-40"
          >
            Remplacer
          </button>
        )}
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          disabled={isPending}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) uploadFile(file);
          }}
        />
        {error && <p className="text-[10px] text-red-600">{error}</p>}
      </div>
    );
  }

  if (!canAdmin) return <span className="text-slate-400">—</span>;

  return (
    <div className="min-w-[10rem] space-y-1">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const file = e.dataTransfer.files[0];
          if (file) uploadFile(file);
        }}
        className={`rounded border border-dashed px-2 py-2 text-center text-[10px] ${
          dragOver
            ? "border-violet-400 bg-violet-50"
            : "border-slate-300 bg-slate-50"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          disabled={isPending}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) uploadFile(file);
          }}
        />
        <button
          type="button"
          disabled={isPending}
          onClick={() => inputRef.current?.click()}
          className="font-semibold text-violet-700 hover:underline disabled:opacity-40"
        >
          Déposer PDF
        </button>
      </div>
      {visitId && (
        <button
          type="button"
          disabled={isPending}
          onClick={linkVisitReport}
          className="w-full text-[10px] font-medium text-slate-600 hover:underline disabled:opacity-40"
        >
          Lier rapport visite
        </button>
      )}
      {error && <p className="text-[10px] text-red-600">{error}</p>}
    </div>
  );
}
