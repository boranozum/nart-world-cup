/** The only email domain allowed to sign in (company-wide, Google Workspace). */
export const ALLOWED_DOMAIN = 'technarts.com';

/** True only for `@technarts.com` addresses. Used as a defense-in-depth gate on
 * top of Google's "Internal" consent type. */
export function isAllowedEmail(email?: string | null): boolean {
  return !!email && email.toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`);
}
