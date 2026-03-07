export const COURSE_ISSUE_ADMIN_EMAILS = new Set([
  'victory7500@hotmail.com',
  'jwhallstrom@gmail.com',
]);

export function isCourseIssueAdminEmail(email?: string | null): boolean {
  return Boolean(email && COURSE_ISSUE_ADMIN_EMAILS.has(email.trim().toLowerCase()));
}
