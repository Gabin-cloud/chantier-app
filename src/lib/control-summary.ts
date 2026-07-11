import type { ControlResult, VisitControlSummary } from "@/lib/types/database";

type MarkerControl = {
  checklist_item_id: string | null;
  control_result: ControlResult | null;
};

export function computeVisitControlSummary(
  markers: MarkerControl[]
): VisitControlSummary {
  const results = markers
    .filter((m) => m.checklist_item_id)
    .map((m) => m.control_result)
    .filter((r): r is ControlResult => Boolean(r));

  if (results.length === 0) return "pending";
  if (results.every((r) => r === "ok")) return "ok";
  if (results.every((r) => r === "ko")) return "ko";
  return "partial";
}
