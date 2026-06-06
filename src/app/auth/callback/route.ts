import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isAllowedEmail, isEmailProvider } from '@/lib/auth/domain';

/**
 * OAuth callback. Supabase redirects here after Google sign-in.
 * Exchanges the code for a session, enforces the @technarts.com gate, then
 * routes to onboarding (first login) or the requested destination.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (!code) {
    // No PKCE code — Supabase used implicit flow (tokens in URL hash fragment).
    // Server-side 307 redirects strip the hash, so serve a tiny HTML page that
    // forwards the hash to /auth/confirm via client-side navigation instead.
    return new Response(
      `<!doctype html><html><head><meta charset="utf-8">
<script>window.location.replace('/auth/confirm'+window.location.hash);</script>
</head><body></body></html>`,
      { status: 200, headers: { 'Content-Type': 'text/html; charset=utf-8' } },
    );
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Magic-link (email provider) users are admin-invited — skip the domain gate.
  // Google OAuth users must still be @technarts.com.
  if (!user || (!isEmailProvider(user.app_metadata) && !isAllowedEmail(user.email))) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=domain`);
  }

  // First login → onboarding. `onboarded_at` is set when the user finishes setup.
  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarded_at, blocked_at')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.blocked_at) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=blocked`);
  }

  const dest = profile?.onboarded_at ? next : '/onboarding';
  return NextResponse.redirect(`${origin}${dest}`);
}
