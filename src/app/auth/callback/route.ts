import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isAllowedEmail } from '@/lib/auth/domain';

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
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(`${origin}/login?error=auth`);
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Defense in depth: reject any non-company account that slipped through.
  if (!user || !isAllowedEmail(user.email)) {
    await supabase.auth.signOut();
    return NextResponse.redirect(`${origin}/login?error=domain`);
  }

  // First login → onboarding. `onboarded_at` is set when the user finishes setup.
  const { data: profile } = await supabase
    .from('profiles')
    .select('onboarded_at')
    .eq('id', user.id)
    .maybeSingle();

  const dest = profile?.onboarded_at ? next : '/onboarding';
  return NextResponse.redirect(`${origin}${dest}`);
}
