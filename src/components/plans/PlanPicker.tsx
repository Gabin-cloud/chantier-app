"use client";

import { useMemo, useState } from "react";
import type { Plan, PlanFolder } from "@/lib/types/database";

type PlanWithUrl = Plan & { pdf_url: string };

type PlanPickerProps = {
  folders: PlanFolder[];
  plans: PlanWithUrl[];
  selectedPlanId: string;
  onSelect: (planId: string) => void;
  compact?: boolean;
};

type FolderNode = PlanFolder & { children: FolderNode[] };

function buildFolderTree(folders: PlanFolder[]): FolderNode[] {
  const map = new Map<string, FolderNode>();
  const roots: FolderNode[] = [];

  for (const folder of folders) {
    map.set(folder.id, { ...folder, children: [] });
  }

  for (const folder of folders) {
    const node = map.get(folder.id)!;
    if (folder.parent_id && map.has(folder.parent_id)) {
      map.get(folder.parent_id)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  return roots;
}

function FolderSection({
  node,
  depth,
  plans,
  selectedPlanId,
  onSelect,
  expanded,
  onToggle,
}: {
  node: FolderNode;
  depth: number;
  plans: PlanWithUrl[];
  selectedPlanId: string;
  onSelect: (planId: string) => void;
  expanded: Set<string>;
  onToggle: (id: string) => void;
}) {
  const folderPlans = plans.filter((p) => p.folder_id === node.id);
  const isOpen = expanded.has(node.id);

  return (
    <div>
      <button
        type="button"
        onClick={() => onToggle(node.id)}
        className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm font-semibold text-zinc-800 hover:bg-zinc-100"
        style={{ paddingLeft: `${8 + depth * 14}px` }}
      >
        <span className="text-base">{isOpen ? "📂" : "📁"}</span>
        <span className="truncate">{node.name}</span>
        <span className="ml-auto text-xs text-zinc-400">{folderPlans.length}</span>
      </button>

      {isOpen && (
        <div>
          {folderPlans.map((plan) => (
            <button
              key={plan.id}
              type="button"
              onClick={() => onSelect(plan.id)}
              className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm ${
                plan.id === selectedPlanId
                  ? "bg-emerald-600 font-semibold text-white"
                  : "text-zinc-700 hover:bg-zinc-100"
              }`}
              style={{ paddingLeft: `${22 + depth * 14}px` }}
            >
              <span>📄</span>
              <span className="truncate">{plan.name}</span>
            </button>
          ))}
          {node.children.map((child) => (
            <FolderSection
              key={child.id}
              node={child}
              depth={depth + 1}
              plans={plans}
              selectedPlanId={selectedPlanId}
              onSelect={onSelect}
              expanded={expanded}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function PlanPicker({
  folders,
  plans,
  selectedPlanId,
  onSelect,
  compact = false,
}: PlanPickerProps) {
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(folders.map((f) => f.id)));
  const tree = useMemo(() => buildFolderTree(folders), [folders]);
  const rootPlans = plans.filter((p) => !p.folder_id);

  function toggleFolder(id: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  return (
    <div className={compact ? "max-h-48 overflow-y-auto" : "min-h-0 flex-1 overflow-y-auto"}>
      {rootPlans.length > 0 && (
        <div className="mb-2">
          <p className="px-2 py-1 text-xs font-semibold uppercase tracking-wide text-zinc-400">
            Racine
          </p>
          {rootPlans.map((plan) => (
            <button
              key={plan.id}
              type="button"
              onClick={() => onSelect(plan.id)}
              className={`flex w-full items-center gap-2 rounded-lg px-2 py-2 text-left text-sm ${
                plan.id === selectedPlanId
                  ? "bg-emerald-600 font-semibold text-white"
                  : "text-zinc-700 hover:bg-zinc-100"
              }`}
            >
              <span>📄</span>
              <span className="truncate">{plan.name}</span>
            </button>
          ))}
        </div>
      )}

      {tree.map((node) => (
        <FolderSection
          key={node.id}
          node={node}
          depth={0}
          plans={plans}
          selectedPlanId={selectedPlanId}
          onSelect={onSelect}
          expanded={expanded}
          onToggle={toggleFolder}
        />
      ))}

      {plans.length === 0 && (
        <p className="px-2 py-4 text-sm text-zinc-500">Aucun plan importé.</p>
      )}
    </div>
  );
}
