"use server";

import { revalidatePath } from "next/cache";
import { requireProjectAccess, requireProjectRoles, requireUser } from "@/lib/auth/permissions";
import { createClient } from "@/lib/supabase/server";
import type { Enterprise, VisitPhase } from "@/lib/types/database";
import type { ControlResult } from "@/lib/types/database";
import {
  computeSynthesisCell,
  resolveWorkControlItemStatus,
  type WorkControlExecution,
  type WorkControlPanelData,
  type WorkControlPhaseView,
  type WorkControlPlanLevel,
  type WorkControlPlanType,
  type WorkControlSynthesisData,
  type WorkPlanWithLevels,
  type WorkControlExecutionStatus,
} from "@/lib/types/work-control";

const PLANS_BUCKET = "plans";

function revalidateWorkControl(projectId: string) {
  const base = `/pc/projets/${projectId}/suivi-travaux`;
  revalidatePath(`${base}/synthese`);
  revalidatePath(`${base}/controle`);
  revalidatePath(`${base}/rapport`);
  revalidatePath(`${base}/plans`);
  revalidatePath(`/pc/projets/${projectId}/tableau-de-bord`);
  revalidatePath(`/pc/projets/${projectId}/controles`);
}

const DEFAULT_PLAN_TYPES = [
  "Plans architecte",
  "Plans béton",
  "Plans électricité (ELEX)",
  "Plans plomberie",
  "Autres plans",
];

export async function ensureWorkControlPlanTypes(
  projectId: string
): Promise<WorkControlPlanType[]> {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("work_control_plan_types")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true });

  if (existing?.length) return existing;

  const rows = DEFAULT_PLAN_TYPES.map((name, index) => ({
    project_id: projectId,
    name,
    sort_order: index + 1,
    is_system: true,
  }));

  const { data, error } = await supabase
    .from("work_control_plan_types")
    .insert(rows)
    .select("*");

  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function getWorkControlPlanTypes(
  projectId: string
): Promise<WorkControlPlanType[]> {
  await requireProjectAccess(projectId);
  return ensureWorkControlPlanTypes(projectId);
}

export async function addWorkControlPlanType(projectId: string, name: string) {
  await requireProjectRoles(projectId, ["admin", "gestionnaire"]);
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Le nom du type de plan est obligatoire.");

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("work_control_plan_types")
    .select("sort_order")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("work_control_plan_types")
    .insert({
      project_id: projectId,
      name: trimmed,
      sort_order: (last?.sort_order ?? 0) + 1,
      is_system: false,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  revalidateWorkControl(projectId);
  return data;
}

export async function ensurePlanDefaultLevel(
  planId: string,
  planName: string
): Promise<WorkControlPlanLevel> {
  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("work_control_plan_levels")
    .select("*")
    .eq("plan_id", planId)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existing) return existing;

  const { data, error } = await supabase
    .from("work_control_plan_levels")
    .insert({
      plan_id: planId,
      name: planName,
      sort_order: 0,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function addPlanLevel(
  projectId: string,
  planId: string,
  name: string
): Promise<WorkControlPlanLevel> {
  await requireProjectRoles(projectId, ["admin", "gestionnaire", "terrain"]);
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Le nom du niveau est obligatoire.");

  const supabase = await createClient();
  const { data: last } = await supabase
    .from("work_control_plan_levels")
    .select("sort_order")
    .eq("plan_id", planId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("work_control_plan_levels")
    .insert({
      plan_id: planId,
      name: trimmed,
      sort_order: (last?.sort_order ?? 0) + 1,
    })
    .select("*")
    .single();

  if (error) throw new Error(error.message);
  revalidateWorkControl(projectId);
  return data;
}

export async function deletePlanLevel(projectId: string, levelId: string) {
  await requireProjectRoles(projectId, ["admin", "gestionnaire"]);
  const supabase = await createClient();

  const { data: level } = await supabase
    .from("work_control_plan_levels")
    .select("plan_id")
    .eq("id", levelId)
    .single();

  if (!level) throw new Error("Niveau introuvable.");

  const { count: levelCount } = await supabase
    .from("work_control_plan_levels")
    .select("id", { count: "exact", head: true })
    .eq("plan_id", level.plan_id);

  if ((levelCount ?? 0) <= 1) {
    throw new Error("Impossible de supprimer le dernier niveau d'un plan.");
  }

  const { error } = await supabase
    .from("work_control_plan_levels")
    .delete()
    .eq("id", levelId);

  if (error) throw new Error(error.message);
  revalidateWorkControl(projectId);
  revalidatePath(`/tablette/projets/${projectId}/parametres`);
  revalidatePath(`/pc/projets/${projectId}/parametres`);
  revalidatePath(`/pc/parametres`);
}

async function loadProjectWorkControlContext(projectId: string) {
  const supabase = await createClient();

  const [
    { data: phases },
    { data: enterprises },
    planTypes,
    { data: items },
    { data: plans },
    { data: levels },
    { data: executions },
  ] = await Promise.all([
    supabase
      .from("visit_phases")
      .select("*")
      .eq("project_id", projectId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("enterprises")
      .select("*")
      .eq("project_id", projectId)
      .order("sort_order", { ascending: true }),
    ensureWorkControlPlanTypes(projectId),
    supabase
      .from("phase_checklist_items")
      .select("*")
      .in(
        "phase_id",
        (
          await supabase
            .from("visit_phases")
            .select("id")
            .eq("project_id", projectId)
        ).data?.map((p) => p.id) ?? []
      )
      .order("sort_order", { ascending: true }),
    supabase
      .from("plans")
      .select("*")
      .eq("project_id", projectId)
      .order("sort_order", { ascending: true }),
    supabase
      .from("work_control_plan_levels")
      .select("*")
      .in(
        "plan_id",
        (
          await supabase.from("plans").select("id").eq("project_id", projectId)
        ).data?.map((p) => p.id) ?? []
      )
      .order("sort_order", { ascending: true }),
    supabase
      .from("work_control_executions")
      .select("*"),
  ]);

  const phaseList = (phases ?? []) as VisitPhase[];
  const enterpriseList = (enterprises ?? []) as Enterprise[];
  const itemList = items ?? [];
  const planList = plans ?? [];
  const levelList = (levels ?? []) as WorkControlPlanLevel[];
  const executionList = (executions ?? []) as WorkControlExecution[];

  const planTypeMap = new Map(planTypes.map((t) => [t.id, t]));
  const plansByType = new Map<string, typeof planList>();
  for (const plan of planList) {
    const typeId = plan.plan_type_id ?? "none";
    if (!plansByType.has(typeId)) plansByType.set(typeId, []);
    plansByType.get(typeId)!.push(plan);
  }

  const levelsByPlan = new Map<string, WorkControlPlanLevel[]>();
  for (const level of levelList) {
    if (!levelsByPlan.has(level.plan_id)) levelsByPlan.set(level.plan_id, []);
    levelsByPlan.get(level.plan_id)!.push(level);
  }

  const executionByKey = new Map<string, WorkControlExecution>();
  for (const ex of executionList) {
    executionByKey.set(`${ex.checklist_item_id}:${ex.plan_level_id}`, ex);
  }

  return {
    supabase,
    phases: phaseList,
    enterprises: enterpriseList,
    planTypes,
    items: itemList,
    plans: planList,
    levelsByPlan,
    plansByType,
    planTypeMap,
    executionByKey,
    executionList,
  };
}

function getLevelsForItem(
  item: { plan_type_id: string | null },
  plansByType: Map<string, { id: string; name: string }[]>,
  levelsByPlan: Map<string, WorkControlPlanLevel[]>
): { planId: string; planName: string; level: WorkControlPlanLevel }[] {
  if (!item.plan_type_id) return [];

  const plans = plansByType.get(item.plan_type_id) ?? [];
  const result: { planId: string; planName: string; level: WorkControlPlanLevel }[] = [];

  for (const plan of plans) {
    const planLevels = levelsByPlan.get(plan.id) ?? [];
    for (const level of planLevels) {
      result.push({ planId: plan.id, planName: plan.name, level });
    }
  }

  return result;
}

export async function getWorkControlSynthesis(
  projectId: string
): Promise<WorkControlSynthesisData> {
  await requireProjectAccess(projectId);
  const ctx = await loadProjectWorkControlContext(projectId);
  const { phases, enterprises, items, executionList } = ctx;

  const projectTotal = computeSynthesisCell(
    executionList.filter((e) => e.control_result !== "pending" || e.admin_waived)
  );

  const rows = enterprises.map((enterprise) => {
    const enterpriseExecutions = executionList.filter(
      (e) =>
        e.enterprise_id === enterprise.id &&
        (e.control_result === "ok" ||
          e.control_result === "ko" ||
          e.admin_waived)
    );

    const total = computeSynthesisCell(enterpriseExecutions);

    const byPhase: Record<string, ReturnType<typeof computeSynthesisCell>> = {};
    for (const phase of phases) {
      const phaseItemIds = new Set(
        items.filter((i) => i.phase_id === phase.id).map((i) => i.id)
      );
      const phaseExecutions = enterpriseExecutions.filter((e) =>
        phaseItemIds.has(e.checklist_item_id)
      );
      byPhase[phase.id] = computeSynthesisCell(phaseExecutions);
    }

    return { enterprise, total, byPhase };
  });

  return { phases, rows, projectTotal };
}

export async function getWorkControlPanel(
  projectId: string
): Promise<WorkControlPanelData> {
  await requireProjectAccess(projectId);
  const ctx = await loadProjectWorkControlContext(projectId);
  const {
    phases,
    enterprises,
    planTypes,
    items,
    plansByType,
    levelsByPlan,
    planTypeMap,
    executionByKey,
  } = ctx;

  for (const plan of ctx.plans) {
    if (!levelsByPlan.has(plan.id)) {
      const level = await ensurePlanDefaultLevel(plan.id, plan.name);
      if (!levelsByPlan.has(plan.id)) levelsByPlan.set(plan.id, []);
      levelsByPlan.get(plan.id)!.push(level);
    }
  }

  // Levées terrain : rattacher le rapport de visite si report_path manquant
  const visitIdsNeedingReport = [
    ...new Set(
      [...executionByKey.values()]
        .filter((ex) => ex.visit_id && !ex.report_path)
        .map((ex) => ex.visit_id as string)
    ),
  ];
  if (visitIdsNeedingReport.length > 0) {
    const { data: reports } = await ctx.supabase
      .from("visit_reports")
      .select("visit_id, file_path")
      .in("visit_id", visitIdsNeedingReport);
    const reportByVisit = new Map(
      (reports ?? []).map((r) => [r.visit_id as string, r.file_path as string])
    );
    for (const [key, ex] of executionByKey) {
      if (ex.report_path || !ex.visit_id) continue;
      const path = reportByVisit.get(ex.visit_id);
      if (!path) continue;
      executionByKey.set(key, {
        ...ex,
        report_path: path,
        report_file_name: path.split("/").pop() ?? "rapport-visite.pdf",
      });
    }
  }

  const phaseViews: WorkControlPhaseView[] = phases.map((phase) => {
    const phaseItems = items.filter((i) => i.phase_id === phase.id);

    const itemViews = phaseItems.map((item) => {
      const levelEntries = getLevelsForItem(item, plansByType, levelsByPlan);
      const executions = levelEntries.map(({ level }) =>
        executionByKey.get(`${item.id}:${level.id}`)
      ).filter(Boolean) as WorkControlExecution[];

      const levels = levelEntries.map(({ planId, planName, level }) => ({
        level,
        planId,
        planName,
        execution: executionByKey.get(`${item.id}:${level.id}`) ?? null,
      }));

      const status = resolveWorkControlItemStatus(
        levels.map((l) => l.execution)
      );

      let conform = 0;
      let nonConform = 0;
      let pending = 0;

      for (const l of levels) {
        const ex = l.execution;
        if (!ex || ex.control_result === "pending") {
          if (!ex?.admin_waived) pending++;
          else conform++;
        } else if (ex.admin_waived || ex.control_result === "ok") {
          conform++;
        } else if (ex.control_result === "ko") {
          nonConform++;
        } else {
          pending++;
        }
      }

      const presetComments = Array.isArray(item.preset_comments)
        ? (item.preset_comments as string[])
        : [];

      return {
        id: item.id,
        label: item.label,
        phaseId: item.phase_id,
        planTypeId: item.plan_type_id,
        planTypeName: item.plan_type_id
          ? planTypeMap.get(item.plan_type_id)?.name ?? null
          : null,
        helpComment: item.help_comment ?? "",
        presetComments,
        sortOrder: item.sort_order,
        status,
        levels,
        summary: {
          conform,
          nonConform,
          pending,
          total: levels.length,
        },
      };
    });

    const summary = itemViews.reduce(
      (acc, item) => {
        acc.conform += item.summary.conform;
        acc.nonConform += item.summary.nonConform;
        acc.pending += item.summary.pending;
        acc.total += item.summary.total;
        return acc;
      },
      { conform: 0, nonConform: 0, pending: 0, total: 0 }
    );

    return { phase, items: itemViews, summary };
  });

  return { phases: phaseViews, planTypes, enterprises };
}

export async function upsertWorkControlItem(
  projectId: string,
  data: {
    phaseId: string;
    label: string;
    planTypeId?: string | null;
    helpComment?: string;
    presetComments?: string[];
    itemId?: string;
    zoneId?: string | null;
    zoneName?: string | null;
  }
) {
  await requireProjectRoles(projectId, ["admin", "gestionnaire"]);
  const supabase = await createClient();
  const trimmed = data.label.trim();
  if (!trimmed) throw new Error("Le nom du contrôle est obligatoire.");

  const payload: Record<string, unknown> = {
    phase_id: data.phaseId,
    label: trimmed,
    plan_type_id: data.planTypeId || null,
    help_comment: data.helpComment?.trim() ?? "",
    preset_comments: data.presetComments ?? [],
  };

  if (data.zoneId !== undefined) payload.zone_id = data.zoneId;
  if (data.zoneName !== undefined) payload.zone_name = data.zoneName;

  if (data.itemId) {
    const { error } = await supabase
      .from("phase_checklist_items")
      .update(payload)
      .eq("id", data.itemId);
    if (error) throw new Error(error.message);
  } else {
    const { data: last } = await supabase
      .from("phase_checklist_items")
      .select("sort_order")
      .eq("phase_id", data.phaseId)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    const { error } = await supabase.from("phase_checklist_items").insert({
      ...payload,
      zone_id: data.zoneId ?? null,
      zone_name: data.zoneName ?? null,
      sort_order: (last?.sort_order ?? 0) + 1,
    });
    if (error) throw new Error(error.message);
  }

  revalidateWorkControl(projectId);
  revalidatePath(`/tablette/projets/${projectId}/parametres`);
  revalidatePath(`/pc/projets/${projectId}/parametres`);
  revalidatePath(`/pc/parametres`);
}

export async function deleteWorkControlItem(projectId: string, itemId: string) {
  await requireProjectRoles(projectId, ["admin", "gestionnaire"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("phase_checklist_items")
    .delete()
    .eq("id", itemId);
  if (error) throw new Error(error.message);
  revalidateWorkControl(projectId);
  revalidatePath(`/tablette/projets/${projectId}/parametres`);
  revalidatePath(`/pc/projets/${projectId}/parametres`);
  revalidatePath(`/pc/parametres`);
}

/** Saisie terrain (tablette) → exécution de contrôle sur le tableau PC. */
export async function syncWorkControlExecutionFromMarker(
  projectId: string,
  data: {
    checklistItemId: string;
    planLevelId: string;
    controlResult: ControlResult;
    enterpriseId?: string | null;
    visitId: string;
    controlDate: string;
    presetComment?: string | null;
    notes?: string | null;
    /** Lier le PDF de rapport de visite (levée terrain). */
    attachVisitReport?: boolean;
  }
) {
  await requireProjectRoles(projectId, ["admin", "gestionnaire", "terrain"]);
  const supabase = await createClient();

  const enterpriseId =
    data.controlResult === "ko" || data.controlResult === "ok"
      ? data.enterpriseId ?? null
      : null;

  const payload: Record<string, unknown> = {
    checklist_item_id: data.checklistItemId,
    plan_level_id: data.planLevelId,
    enterprise_id: enterpriseId,
    control_result: data.controlResult,
    control_date: data.controlDate,
    visit_id: data.visitId,
    preset_comment: data.presetComment?.trim() || null,
    notes: data.notes?.trim() || null,
    updated_at: new Date().toISOString(),
  };

  if (data.attachVisitReport) {
    const { data: report } = await supabase
      .from("visit_reports")
      .select("file_path")
      .eq("visit_id", data.visitId)
      .maybeSingle();
    if (report?.file_path) {
      payload.report_path = report.file_path;
      payload.report_file_name =
        report.file_path.split("/").pop() ?? "rapport-visite.pdf";
    }
  }

  const { error } = await supabase
    .from("work_control_executions")
    .upsert(payload, { onConflict: "checklist_item_id,plan_level_id" });

  if (error) throw new Error(error.message);
  revalidateWorkControl(projectId);
  revalidatePath(`/tablette/projets/${projectId}/parametres`);
  revalidatePath(`/pc/projets/${projectId}/parametres`);
  revalidatePath(`/pc/parametres`);
}

export async function resolvePlanLevelId(
  planId: string,
  planLevelId: string | null | undefined
): Promise<string> {
  if (planLevelId) return planLevelId;
  const level = await ensurePlanDefaultLevel(planId, "Plan");
  return level.id;
}

/** Mise à jour PC : dispense admin, attestation et rapport PDF. */
export async function updateWorkControlExecutionAdmin(
  projectId: string,
  data: {
    checklistItemId: string;
    planLevelId: string;
    inAttestation?: boolean;
    attestationDate?: string | null;
    adminWaived?: boolean;
    reportPath?: string | null;
    reportFileName?: string | null;
    visitId?: string | null;
  },
  options?: { skipRevalidate?: boolean }
) {
  await requireProjectRoles(projectId, ["admin", "gestionnaire", "financier"]);

  const supabase = await createClient();
  const { data: existing } = await supabase
    .from("work_control_executions")
    .select("id")
    .eq("checklist_item_id", data.checklistItemId)
    .eq("plan_level_id", data.planLevelId)
    .maybeSingle();

  const payload: Record<string, unknown> = {
    checklist_item_id: data.checklistItemId,
    plan_level_id: data.planLevelId,
    updated_at: new Date().toISOString(),
  };

  if (data.inAttestation !== undefined) payload.in_attestation = data.inAttestation;
  if (data.attestationDate !== undefined)
    payload.attestation_date = data.attestationDate;
  if (data.reportPath !== undefined) payload.report_path = data.reportPath;
  if (data.reportFileName !== undefined)
    payload.report_file_name = data.reportFileName;
  if (data.visitId !== undefined) payload.visit_id = data.visitId;

  if (data.adminWaived !== undefined) {
    payload.admin_waived = data.adminWaived;
    if (data.adminWaived) {
      const user = await requireUser();
      payload.admin_waived_by = user.id;
      payload.admin_waived_at = new Date().toISOString();
    } else {
      payload.admin_waived_by = null;
      payload.admin_waived_at = null;
    }
  }

  if (existing) {
    const { error } = await supabase
      .from("work_control_executions")
      .update(payload)
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("work_control_executions").insert(payload);
    if (error) throw new Error(error.message);
  }

  if (!options?.skipRevalidate) {
    revalidateWorkControl(projectId);
    revalidatePath(`/tablette/projets/${projectId}/parametres`);
    revalidatePath(`/pc/projets/${projectId}/parametres`);
    revalidatePath(`/pc/parametres`);
  }
}

export async function getWorkPlansByType(
  projectId: string
): Promise<{ planTypes: WorkControlPlanType[]; plans: WorkPlanWithLevels[] }> {
  await requireProjectAccess(projectId);
  const supabase = await createClient();
  const planTypes = await ensureWorkControlPlanTypes(projectId);

  const { data: plans, error } = await supabase
    .from("plans")
    .select("*")
    .eq("project_id", projectId)
    .order("sort_order", { ascending: true });

  if (error) throw new Error(error.message);

  const { data: levels } = await supabase
    .from("work_control_plan_levels")
    .select("*")
    .in("plan_id", (plans ?? []).map((p) => p.id))
    .order("sort_order", { ascending: true });

  const levelsByPlan = new Map<string, WorkControlPlanLevel[]>();
  for (const level of levels ?? []) {
    if (!levelsByPlan.has(level.plan_id)) levelsByPlan.set(level.plan_id, []);
    levelsByPlan.get(level.plan_id)!.push(level);
  }

  const result: WorkPlanWithLevels[] = [];
  for (const plan of plans ?? []) {
    let planLevels = levelsByPlan.get(plan.id);
    if (!planLevels?.length) {
      const defaultLevel = await ensurePlanDefaultLevel(plan.id, plan.name);
      planLevels = [defaultLevel];
    }

    result.push({
      id: plan.id,
      name: plan.name,
      plan_type_id: plan.plan_type_id,
      file_path: plan.file_path,
      pdf_url: `/api/plans/${plan.id}/pdf?projectId=${projectId}`,
      levels: planLevels,
      created_at: plan.created_at,
    });
  }

  return { planTypes, plans: result };
}

export async function setPlanType(
  projectId: string,
  planId: string,
  planTypeId: string | null
) {
  await requireProjectRoles(projectId, ["admin", "gestionnaire", "terrain"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("plans")
    .update({ plan_type_id: planTypeId })
    .eq("id", planId)
    .eq("project_id", projectId);
  if (error) throw new Error(error.message);
  revalidateWorkControl(projectId);
  revalidatePath(`/tablette/projets/${projectId}/parametres`);
  revalidatePath(`/pc/projets/${projectId}/parametres`);
  revalidatePath(`/pc/parametres`);
}

export async function getProjectWorkControlTotals(projectId: string) {
  await requireProjectAccess(projectId);
  const synthesis = await getWorkControlSynthesis(projectId);

  const { conformCount, nonConformCount, totalControls } = synthesis.projectTotal;
  const nonConformRatio =
    totalControls > 0
      ? Math.round((nonConformCount / totalControls) * 100)
      : null;

  return { conformCount, nonConformCount, nonConformRatio, totalControls };
}

export async function getEnterpriseWorkControlTotals(
  projectId: string,
  enterpriseId: string
) {
  const synthesis = await getWorkControlSynthesis(projectId);
  const row = synthesis.rows.find((r) => r.enterprise.id === enterpriseId);
  if (!row) {
    return {
      conformCount: 0,
      nonConformCount: 0,
      nonConformRatio: null as number | null,
    };
  }
  const { conformCount, nonConformCount, totalControls } = row.total;
  const nonConformRatio =
    totalControls > 0
      ? Math.round((nonConformCount / totalControls) * 100)
      : null;
  return { conformCount, nonConformCount, nonConformRatio };
}

const ATTESTATION_BUCKET = "visit-photos";

export type WorkControlExecutionMapEntry = {
  checklist_item_id: string;
  plan_level_id: string;
  control_result: string;
  enterprise_id: string | null;
  in_attestation: boolean;
  report_path: string | null;
  admin_waived: boolean;
  visit_id: string | null;
};

export async function getWorkControlExecutionsForProject(
  projectId: string
): Promise<WorkControlExecutionMapEntry[]> {
  await requireProjectAccess(projectId);
  const ctx = await loadProjectWorkControlContext(projectId);
  const itemIds = new Set(ctx.items.map((i) => i.id));
  return ctx.executionList
    .filter((e) => itemIds.has(e.checklist_item_id))
    .map((e) => ({
      checklist_item_id: e.checklist_item_id,
      plan_level_id: e.plan_level_id,
      control_result: e.control_result,
      enterprise_id: e.enterprise_id,
      in_attestation: e.in_attestation,
      report_path: e.report_path,
      admin_waived: e.admin_waived,
      visit_id: e.visit_id,
    }));
}

async function closeMarkersAfterAttestation(
  supabase: Awaited<ReturnType<typeof createClient>>,
  checklistItemId: string,
  planLevelId: string
) {
  await supabase
    .from("markers")
    .update({ status: "levee", updated_at: new Date().toISOString() })
    .eq("checklist_item_id", checklistItemId)
    .eq("plan_level_id", planLevelId)
    .neq("status", "levee");
}

export async function uploadWorkControlAttestation(
  projectId: string,
  checklistItemId: string,
  planLevelId: string,
  formData: FormData,
  options?: { skipRevalidate?: boolean }
) {
  // Outlook / finance : admin, gestionnaire et financier
  await requireProjectRoles(projectId, ["admin", "gestionnaire", "financier"]);
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("Fichier PDF invalide.");
  }

  const supabase = await createClient();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const filePath = `${projectId}/work-control/${checklistItemId}/${planLevelId}/${Date.now()}_${safeName}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  const { error: uploadError } = await supabase.storage
    .from(ATTESTATION_BUCKET)
    .upload(filePath, buffer, {
      contentType: file.type || "application/pdf",
      upsert: true,
    });

  if (uploadError) throw new Error(uploadError.message);

  const today = new Date().toISOString().slice(0, 10);
  await updateWorkControlExecutionAdmin(projectId, {
    checklistItemId,
    planLevelId,
    reportPath: filePath,
    reportFileName: file.name,
    inAttestation: true,
    attestationDate: today,
  }, { skipRevalidate: options?.skipRevalidate });

  await closeMarkersAfterAttestation(supabase, checklistItemId, planLevelId);
  if (!options?.skipRevalidate) {
    revalidatePath(`/tablette/projets/${projectId}/visites`);
    revalidatePath(`/pc/projets/${projectId}/suivi-travaux/controle`);
  }
}

export async function linkVisitReportToExecution(
  projectId: string,
  checklistItemId: string,
  planLevelId: string,
  visitId: string
) {
  await requireProjectRoles(projectId, ["admin", "gestionnaire"]);
  const supabase = await createClient();

  const { data: report, error } = await supabase
    .from("visit_reports")
    .select("file_path")
    .eq("visit_id", visitId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!report?.file_path) {
    throw new Error("Aucun rapport PDF pour cette visite.");
  }

  const fileName = report.file_path.split("/").pop() ?? "rapport-visite.pdf";

  await updateWorkControlExecutionAdmin(projectId, {
    checklistItemId,
    planLevelId,
    reportPath: report.file_path,
    reportFileName: fileName,
    visitId,
    inAttestation: true,
    attestationDate: new Date().toISOString().slice(0, 10),
  });

  await closeMarkersAfterAttestation(supabase, checklistItemId, planLevelId);
  revalidatePath(`/tablette/projets/${projectId}/visites`);
}

export async function getOpenNcExecutionsForOutlook(
  projectId: string
): Promise<
  Array<{
    checklistItemId: string;
    planLevelId: string;
    itemLabel: string;
    planName: string;
    levelName: string;
    enterpriseId: string | null;
    enterpriseName: string | null;
    controlDate: string | null;
  }>
> {
  await requireProjectAccess(projectId);
  const supabase = await createClient();
  const panel = await getWorkControlPanel(projectId);
  const rows: Array<{
    checklistItemId: string;
    planLevelId: string;
    itemLabel: string;
    planName: string;
    levelName: string;
    enterpriseId: string | null;
    enterpriseName: string | null;
    controlDate: string | null;
  }> = [];
  const seen = new Set<string>();

  for (const phase of panel.phases) {
    for (const item of phase.items) {
      for (const lv of item.levels) {
        const ex = lv.execution;
        if (!ex || ex.admin_waived) continue;
        if (ex.control_result !== "ko" || ex.in_attestation) continue;
        const key = `${item.id}:${lv.level.id}`;
        if (seen.has(key)) continue;
        seen.add(key);
        const enterpriseName = ex.enterprise_id
          ? panel.enterprises.find((e) => e.id === ex.enterprise_id)?.name ?? null
          : null;
        rows.push({
          checklistItemId: item.id,
          planLevelId: lv.level.id,
          itemLabel: item.label,
          planName: lv.planName,
          levelName: lv.level.name,
          enterpriseId: ex.enterprise_id,
          enterpriseName,
          controlDate: ex.control_date,
        });
      }
    }
  }

  // Fallback : pastilles terrain « À lever » non encore synchronisées / non levées
  const { data: visits } = await supabase
    .from("visits")
    .select("id")
    .eq("project_id", projectId);
  const visitIds = (visits ?? []).map((v) => v.id);
  if (visitIds.length) {
    const { data: markers } = await supabase
      .from("markers")
      .select(
        "checklist_item_id, plan_id, plan_level_id, enterprise_id, control_result, status, updated_at"
      )
      .in("visit_id", visitIds)
      .eq("control_result", "ko")
      .neq("status", "levee")
      .not("checklist_item_id", "is", null)
      .order("updated_at", { ascending: false });

    const itemLabelById = new Map(
      panel.phases.flatMap((p) => p.items.map((i) => [i.id, i.label] as const))
    );
    const enterpriseById = new Map(panel.enterprises.map((e) => [e.id, e.name]));

    for (const marker of markers ?? []) {
      if (!marker.checklist_item_id || !marker.plan_id) continue;
      let planLevelId = marker.plan_level_id as string | null;
      if (!planLevelId) {
        try {
          planLevelId = await resolvePlanLevelId(marker.plan_id, null);
        } catch {
          continue;
        }
      }
      const key = `${marker.checklist_item_id}:${planLevelId}`;
      if (seen.has(key)) continue;
      seen.add(key);

      let planName = "Plan";
      let levelName = "Niveau";
      for (const phase of panel.phases) {
        for (const item of phase.items) {
          if (item.id !== marker.checklist_item_id) continue;
          const lv = item.levels.find((l) => l.level.id === planLevelId);
          if (lv) {
            planName = lv.planName;
            levelName = lv.level.name;
          }
        }
      }

      rows.push({
        checklistItemId: marker.checklist_item_id,
        planLevelId,
        itemLabel: itemLabelById.get(marker.checklist_item_id) ?? "Point de contrôle",
        planName,
        levelName,
        enterpriseId: marker.enterprise_id,
        enterpriseName: marker.enterprise_id
          ? enterpriseById.get(marker.enterprise_id) ?? null
          : null,
        controlDate: null,
      });
    }
  }

  return rows.sort((a, b) => a.itemLabel.localeCompare(b.itemLabel, "fr"));
}
