import type {
  ControlResult,
  MarkerStatus,
  TabletMarkerVisualState,
} from "@/lib/types/database";
import { getTabletMarkerVisualState } from "@/lib/types/database";

export type WorkControlExecutionLite = {
  checklist_item_id: string;
  plan_level_id: string;
  control_result: string;
  in_attestation: boolean;
  report_path: string | null;
  admin_waived: boolean;
};

export type MarkerListFilters = {
  enterpriseIds: string[];
  states: TabletMarkerVisualState[];
};

/** Par défaut : tout sauf Levée. */
export const DEFAULT_MARKER_FILTERS: MarkerListFilters = {
  enterpriseIds: [],
  states: ["ko", "ok", "pending"],
};

export const TABLET_FILTER_STATES: TabletMarkerVisualState[] = [
  "ko",
  "ok",
  "levee",
  "pending",
];

export function executionKey(checklistItemId: string, planLevelId: string | null) {
  if (!checklistItemId || !planLevelId) return null;
  return `${checklistItemId}:${planLevelId}`;
}

export function isAttestedByExecution(
  checklistItemId: string | null,
  planLevelId: string | null,
  executionMap: Map<string, WorkControlExecutionLite>
): boolean {
  const key = checklistItemId && planLevelId ? executionKey(checklistItemId, planLevelId) : null;
  if (!key) return false;
  const ex = executionMap.get(key);
  return Boolean(ex?.in_attestation && ex?.report_path);
}

export function matchesMarkerFilters(
  marker: {
    status: MarkerStatus;
    enterprise_id: string | null;
    control_result: ControlResult | null;
    checklist_item_id: string | null;
    plan_level_id: string | null;
  },
  filters: MarkerListFilters,
  executionMap: Map<string, WorkControlExecutionLite>
): boolean {
  if (
    filters.enterpriseIds.length > 0 &&
    (!marker.enterprise_id || !filters.enterpriseIds.includes(marker.enterprise_id))
  ) {
    return false;
  }

  if (isAttestedByExecution(marker.checklist_item_id, marker.plan_level_id, executionMap)) {
    if (!filters.states.includes("levee")) return false;
  }

  const visual = getTabletMarkerVisualState(marker.control_result, marker.status);
  if (filters.states.length === 0) return true;
  return filters.states.includes(visual);
}

export function isPriorVisitMarker(markerVisitId: string, currentVisitId: string) {
  return markerVisitId !== currentVisitId;
}

export function toggleFilterValue<T extends string>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}
