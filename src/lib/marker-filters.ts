import type { ControlResult, MarkerStatus } from "@/lib/types/database";

export type WorkControlExecutionLite = {
  checklist_item_id: string;
  plan_level_id: string;
  control_result: string;
  in_attestation: boolean;
  report_path: string | null;
  admin_waived: boolean;
};

export type MarkerFilterState = "open" | "all" | ControlResult | "levee" | "attested";

export type MarkerListFilters = {
  enterpriseId: string;
  state: MarkerFilterState;
};

export const DEFAULT_MARKER_FILTERS: MarkerListFilters = {
  enterpriseId: "",
  state: "open",
};

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

export function isMarkerOpen(
  marker: {
    status: MarkerStatus;
    checklist_item_id: string | null;
    plan_level_id: string | null;
  },
  executionMap: Map<string, WorkControlExecutionLite>
): boolean {
  if (marker.status === "levee") return false;
  if (
    isAttestedByExecution(
      marker.checklist_item_id,
      marker.plan_level_id,
      executionMap
    )
  ) {
    return false;
  }
  return true;
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
  if (filters.enterpriseId && marker.enterprise_id !== filters.enterpriseId) {
    return false;
  }

  const attested = isAttestedByExecution(
    marker.checklist_item_id,
    marker.plan_level_id,
    executionMap
  );

  switch (filters.state) {
    case "all":
      return true;
    case "open":
      return isMarkerOpen(marker, executionMap);
    case "levee":
      return marker.status === "levee";
    case "attested":
      return attested;
    case "ok":
    case "ko":
    case "deferred":
    case "pending":
      return marker.control_result === filters.state;
    default:
      return true;
  }
}

export function isPriorVisitMarker(markerVisitId: string, currentVisitId: string) {
  return markerVisitId !== currentVisitId;
}
