"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  linkVisitReportToExecution,
  uploadWorkControlAttestation,
} from "@/lib/actions/work-control";
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

  if (!canAdmin) {
    return attestationUrl ? (
      <a
        href={attestationUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="text-violet-700 underline"
      >
        PDF
      </a>
    ) : (
      "—"
    );
  }

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
        {execution?.attestation_date && (
          <p className="mt-0.5 text-slate-500">{execution.attestation_date}</p>
        )}
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
      {attestationUrl && (
        <a
          href={attestationUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block text-[10px] text-emerald-700 underline"
        >
          Ouvrir attestation
        </a>
      )}
      {error && <p className="text-[10px] text-red-600">{error}</p>}
    </div>
  );
}
