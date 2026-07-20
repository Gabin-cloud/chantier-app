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
        (e.control_result === "ko" ||
          e.control_result === "partial" ||
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
        levels.map((l) => l.execution).filter(Boolean) as WorkControlExecution[]
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
        } else {
          nonConform++;
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
  }
) {
  await requireProjectRoles(projectId, ["admin", "gestionnaire", "terrain"]);
  const supabase = await createClient();

  const enterpriseId =
    data.controlResult === "ko" || data.controlResult === "partial"
      ? data.enterpriseId ?? null
      : null;

  const payload = {
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

/** Mise à jour PC : dispense admin et suivi attestation uniquement. */
export async function updateWorkControlExecutionAdmin(
  projectId: string,
  data: {
    checklistItemId: string;
    planLevelId: string;
    inAttestation?: boolean;
    attestationDate?: string | null;
    adminWaived?: boolean;
  }
) {
  await requireProjectRoles(projectId, ["admin", "gestionnaire"]);

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

  revalidateWorkControl(projectId);
  revalidatePath(`/tablette/projets/${projectId}/parametres`);
  revalidatePath(`/pc/projets/${projectId}/parametres`);
  revalidatePath(`/pc/parametres`);
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
