"use client";

import type { WorkControlPlanType, WorkPlanWithLevels } from "@/lib/types/work-control";

type WorkPlansTrackingProps = {
  planTypes: WorkControlPlanType[];
  plans: WorkPlanWithLevels[];
};

export function WorkPlansTracking({
  planTypes,
  plans,
}: WorkPlansTrackingProps) {
  const byType = planTypes.map((type) => ({
    type,
    plans: plans.filter((p) => p.plan_type_id === type.id),
  }));

  const unclassified = plans.filter((p) => !p.plan_type_id);

  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <header className="border-b border-slate-200 px-3 py-2">
        <h2 className="text-sm font-semibold text-slate-900">
          Suivi des plans par discipline
        </h2>
        <p className="text-[11px] text-slate-500">
          Vue d&apos;ensemble des plans importés et de leurs subdivisions.
        </p>
      </header>

      <div className="divide-y divide-slate-100">
        {byType.map(({ type, plans: typePlans }) => (
          <div key={type.id} className="px-3 py-3">
            <h3 className="text-xs font-semibold text-slate-800">{type.name}</h3>
            {typePlans.length === 0 ? (
              <p className="mt-1 text-xs text-slate-400">Aucun plan</p>
            ) : (
              <ul className="mt-2 space-y-2">
                {typePlans.map((plan) => (
                  <li
                    key={plan.id}
                    className="flex items-center justify-between rounded bg-slate-50 px-2 py-1.5 text-xs"
                  >
                    <span className="font-medium">{plan.name}</span>
                    <span className="text-slate-500">
                      {plan.levels.length} niveau(x)
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}

        {unclassified.length > 0 && (
          <div className="px-3 py-3">
            <h3 className="text-xs font-semibold text-amber-800">Non classés</h3>
            <ul className="mt-2 space-y-1">
              {unclassified.map((plan) => (
                <li key={plan.id} className="text-xs text-slate-600">
                  {plan.name}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
