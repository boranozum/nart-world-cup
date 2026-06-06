/** The only email domain allowed to sign in via Google SSO (company-wide, Google Workspace). */
export const ALLOWED_DOMAIN = 'technarts.com';

/** True only for `@technarts.com` addresses. Gate for Google OAuth sign-in. */
export function isAllowedEmail(email?: string | null): boolean {
  return !!email && email.toLowerCase().endsWith(`@${ALLOWED_DOMAIN}`);
}

/** True when the user authenticated via email magic link rather than Google OAuth.
 * Magic-link users bypass the domain restriction — they are admin-invited. */
export function isEmailProvider(appMetadata?: Record<string, unknown> | null): boolean {
  return appMetadata?.provider === 'email';
}
