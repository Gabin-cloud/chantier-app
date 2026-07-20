import type { ControlResult, Enterprise, VisitPhase } from "@/lib/types/database";

export type WorkControlPlanType = {
  id: string;
  project_id: string;
  name: string;
  sort_order: number;
  is_system: boolean;
  created_at: string;
};

export type WorkControlPlanLevel = {
  id: string;
  plan_id: string;
  name: string;
  sort_order: number;
  created_at: string;
};

export type WorkControlExecutionStatus = "pending" | ControlResult;

export type WorkControlExecution = {
  id: string;
  checklist_item_id: string;
  plan_level_id: string;
  enterprise_id: string | null;
  control_result: WorkControlExecutionStatus;
  control_date: string | null;
  visit_id: string | null;
  report_path: string | null;
  attestation_date: string | null;
  in_attestation: boolean;
  admin_waived: boolean;
  admin_waived_by: string | null;
  admin_waived_at: string | null;
  preset_comment: string | null;
  notes: string | null;
  report_file_name?: string | null;
  created_at: string;
  updated_at: string;
};

export type WorkControlItemStatus =
  | "pending"
  | "partial"
  | "conform"
  | "non_conform_open"
  | "non_conform_attestation"
  | "waived";

export const WORK_CONTROL_STATUS_LABELS: Record<WorkControlItemStatus, string> = {
  pending: "À contrôler",
  partial: "Partiellement contrôlé",
  conform: "Conforme",
  non_conform_open: "Non conforme — en attente",
  non_conform_attestation: "Non conforme — en attestation",
  waived: "Dispensé (admin)",
};

export function resolveWorkControlItemStatus(
  executions: Array<
    | Pick<
        WorkControlExecution,
        | "control_result"
        | "admin_waived"
        | "in_attestation"
        | "attestation_date"
      >
    | null
    | undefined
  >
): WorkControlItemStatus {
  if (!executions.length) return "pending";

  const isLevelDone = (
    e:
      | Pick<
          WorkControlExecution,
          "control_result" | "admin_waived" | "in_attestation"
        >
      | null
      | undefined
  ) => {
    if (!e) return false;
    if (e.admin_waived) return true;
    if (e.control_result === "ok") return true;
    if (e.control_result === "ko" && e.in_attestation) return true;
    return false;
  };

  const allDone = executions.every(isLevelDone);

  if (!allDone) {
    const hasOpenNc = executions.some(
      (e) =>
        e &&
        !e.admin_waived &&
        e.control_result === "ko" &&
        !e.in_attestation
    );
    if (hasOpenNc) return "non_conform_open";
    const someDone = executions.some(isLevelDone);
    if (someDone) return "partial";
    return "pending";
  }

  const defined = executions.filter(Boolean) as Pick<
    WorkControlExecution,
    "control_result" | "admin_waived" | "in_attestation"
  >[];

  if (defined.every((e) => e.admin_waived || e.control_result === "ok")) {
    return defined.some((e) => e.admin_waived) ? "waived" : "conform";
  }

  return "non_conform_attestation";
}

export function isWorkControlItemGreen(status: WorkControlItemStatus): boolean {
  return (
    status === "conform" ||
    status === "non_conform_attestation" ||
    status === "waived"
  );
}

export type WorkControlSynthesisCell = {
  conformCount: number;
  nonConformCount: number;
  totalControls: number;
  conformityRatio: number | null;
};

export type WorkControlSynthesisRow = {
  enterprise: Enterprise;
  total: WorkControlSynthesisCell;
  byPhase: Record<string, WorkControlSynthesisCell>;
};

export type WorkControlSynthesisData = {
  phases: VisitPhase[];
  rows: WorkControlSynthesisRow[];
  projectTotal: WorkControlSynthesisCell;
};

export type WorkControlPlanLevelView = {
  level: WorkControlPlanLevel;
  planId: string;
  planName: string;
  execution: WorkControlExecution | null;
};

export type WorkControlItemView = {
  id: string;
  label: string;
  phaseId: string;
  planTypeId: string | null;
  planTypeName: string | null;
  helpComment: string;
  presetComments: string[];
  sortOrder: number;
  status: WorkControlItemStatus;
  levels: WorkControlPlanLevelView[];
  summary: {
    conform: number;
    nonConform: number;
    pending: number;
    total: number;
  };
};

export type WorkControlPhaseView = {
  phase: VisitPhase;
  items: WorkControlItemView[];
  summary: {
    conform: number;
    nonConform: number;
    pending: number;
    total: number;
  };
};

export type WorkControlPanelData = {
  phases: WorkControlPhaseView[];
  planTypes: WorkControlPlanType[];
  enterprises: Enterprise[];
};

export type WorkPlanWithLevels = {
  id: string;
  name: string;
  plan_type_id: string | null;
  file_path: string;
  pdf_url: string;
  levels: WorkControlPlanLevel[];
  created_at: string;
};

export function computeSynthesisCell(
  executions: Pick<WorkControlExecution, "control_result" | "admin_waived">[]
): WorkControlSynthesisCell {
  let conformCount = 0;
  let nonConformCount = 0;

  for (const e of executions) {
    if (e.admin_waived) {
      conformCount++;
      continue;
    }
    if (e.control_result === "ok") {
      conformCount++;
    } else if (e.control_result === "ko") {
      nonConformCount++;
    }
  }

  const totalControls = conformCount + nonConformCount;
  const conformityRatio =
    totalControls > 0 ? Math.round((conformCount / totalControls) * 100) : null;

  return { conformCount, nonConformCount, totalControls, conformityRatio };
}
