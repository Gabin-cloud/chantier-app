export type { VisitDraftInput } from "@/lib/notifications/merge-tags";
export {
  buildVisitEmailFromTemplates,
  DEFAULT_VISIT_EMAIL_BODY,
  DEFAULT_VISIT_EMAIL_SUBJECT,
} from "@/lib/notifications/merge-tags";

import {
  buildVisitEmailFromTemplates,
  DEFAULT_VISIT_EMAIL_BODY,
  DEFAULT_VISIT_EMAIL_SUBJECT,
  type VisitDraftInput,
} from "@/lib/notifications/merge-tags";

export function buildVisitEmailSubject(input: VisitDraftInput) {
  return buildVisitEmailFromTemplates(
    DEFAULT_VISIT_EMAIL_SUBJECT,
    DEFAULT_VISIT_EMAIL_BODY,
    input
  ).subject;
}

export function buildVisitEmailHtml(input: VisitDraftInput) {
  return buildVisitEmailFromTemplates(
    DEFAULT_VISIT_EMAIL_SUBJECT,
    DEFAULT_VISIT_EMAIL_BODY,
    input
  ).htmlBody;
}
