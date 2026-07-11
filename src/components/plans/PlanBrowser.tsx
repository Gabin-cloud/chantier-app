"use client";

import { useState } from "react";
import { PlanPicker } from "@/components/plans/PlanPicker";
import { PlanViewer } from "@/components/visits/PlanViewer";
import type { Plan, PlanFolder } from "@/lib/types/database";

type PlanWithUrl = Plan & { pdf_url: string };

type PlanBrowserProps = {
  projectId: string;
  folders: PlanFolder[];
  plans: PlanWithUrl[];
};

export function PlanBrowser({ projectId, folders, plans }: PlanBrowserProps) {
  const [selectedPlanId, setSelectedPlanId] = useState(plans[0]?.id ?? "");

  return (
    <div className="flex min-h-[70vh] flex-col overflow-hidden rounded-2xl bg-white shadow-sm md:flex-row">
      <aside className="flex w-full flex-col border-b border-zinc-200 md:w-72 md:border-b-0 md:border-r">
        <div className="border-b border-zinc-100 px-4 py-3">
          <h2 className="text-base font-bold text-zinc-900">Plans du chantier</h2>
          <p className="text-xs text-zinc-500">{plans.length} plan(s)</p>
        </div>
        <PlanPicker
          folders={folders}
          plans={plans}
          selectedPlanId={selectedPlanId}
          onSelect={setSelectedPlanId}
        />
      </aside>

      <div className="relative min-h-[50vh] flex-1 bg-zinc-100">
        {selectedPlanId ? (
          <PlanViewer
            key={selectedPlanId}
            projectId={projectId}
            planId={selectedPlanId}
            markers={[]}
            readOnly
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-zinc-500">
            Sélectionnez un plan dans la liste.
          </div>
        )}
      </div>
    </div>
  );
}
