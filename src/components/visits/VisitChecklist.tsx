"use client";

import { useState, useTransition } from "react";
import { saveVisitChecklistResponse } from "@/lib/actions/checklist";
import type {
  ChecklistItemStatus,
  PhaseChecklistItem,
  VisitChecklistResponse,
} from "@/lib/types/database";
import { CHECKLIST_STATUS_LABELS } from "@/lib/types/database";

const STATUS_OPTIONS: ChecklistItemStatus[] = ["pending", "ok", "partial", "ko"];

const STATUS_COLORS: Record<ChecklistItemStatus, string> = {
  pending: "bg-zinc-100 text-zinc-700",
  ok: "bg-emerald-100 text-emerald-800",
  partial: "bg-amber-100 text-amber-800",
  ko: "bg-red-100 text-red-800",
};

type VisitChecklistProps = {
  projectId: string;
  visitId: string;
  items: PhaseChecklistItem[];
  initialResponses: VisitChecklistResponse[];
  readOnly?: boolean;
};

export function VisitChecklist({
  projectId,
  visitId,
  items,
  initialResponses,
  readOnly = false,
}: VisitChecklistProps) {
  const [responses, setResponses] = useState(() => {
    const map = new Map<string, VisitChecklistResponse>();
    for (const r of initialResponses) map.set(r.checklist_item_id, r);
    return map;
  });
  const [isPending, startTransition] = useTransition();
  const [expanded, setExpanded] = useState(true);

  if (items.length === 0) return null;

  function getStatus(itemId: string): ChecklistItemStatus {
    return responses.get(itemId)?.status ?? "pending";
  }

  function handleStatusChange(itemId: string, status: ChecklistItemStatus) {
    if (readOnly) return;
    startTransition(async () => {
      const saved = await saveVisitChecklistResponse(
        visitId,
        projectId,
        itemId,
        status
      );
      setResponses((prev) => {
        const next = new Map(prev);
        next.set(itemId, saved);
        return next;
      });
    });
  }

  const doneCount = items.filter((i) => getStatus(i.id) !== "pending").length;

  return (
    <div className="border-b border-zinc-100">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3 text-left"
      >
        <div>
          <p className="text-sm font-bold text-zinc-900">Points de contrôle</p>
          <p className="text-xs text-zinc-500">
            {doneCount}/{items.length} contrôlés
          </p>
        </div>
        <span className="text-xs text-zinc-400">{expanded ? "▲" : "▼"}</span>
      </button>

      {expanded && (
        <ul className="space-y-2 px-3 pb-3">
          {items.map((item) => {
            const status = getStatus(item.id);
            return (
              <li key={item.id} className="rounded-xl bg-zinc-50 p-2.5">
                <p className="mb-2 text-sm font-medium text-zinc-900">{item.label}</p>
                <div className="flex flex-wrap gap-1">
                  {STATUS_OPTIONS.filter((s) => s !== "pending").map((option) => (
                    <button
                      key={option}
                      type="button"
                      disabled={readOnly || isPending}
                      onClick={() => handleStatusChange(item.id, option)}
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                        status === option
                          ? STATUS_COLORS[option]
                          : "bg-white text-zinc-600 ring-1 ring-zinc-200"
                      }`}
                    >
                      {CHECKLIST_STATUS_LABELS[option]}
                    </button>
                  ))}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
