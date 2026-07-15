"use server";

import {
  canAccessField,
  canEditProject,
  canManageMembers,
  getProjectRole,
  requireProjectAccess,
} from "@/lib/auth/permissions";
import { getProjectChecklistItems } from "@/lib/actions/checklist";
import { getProjectMembers } from "@/lib/actions/members";
import { getProjectPhases } from "@/lib/actions/phases";
import { getProjectZones } from "@/lib/actions/zones";

export async function getProjectConfigBundle(projectId: string) {
  await requireProjectAccess(projectId);
  const [members, phases, zones, checklistItems, projectRole] = await Promise.all([
    getProjectMembers(projectId),
    getProjectPhases(projectId),
    getProjectZones(projectId),
    getProjectChecklistItems(projectId),
    getProjectRole(projectId),
  ]);

  return {
    members,
    phases,
    zones,
    checklistItems,
    canManageMembers: projectRole ? canManageMembers(projectRole) : false,
    canEditPlans: projectRole ? canAccessField(projectRole) : false,
    canEdit: projectRole ? canEditProject(projectRole) : false,
  };
}
