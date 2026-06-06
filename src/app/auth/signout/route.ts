import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function siteUrl(request: Request) {
  return (process.env.SITE_URL ?? new URL(request.url).origin).replace(/\/$/, '');
}

export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  return NextResponse.redirect(`${siteUrl(request)}/login`, { status: 303 });
}

// Used when the proxy detects a blocked user — signs them out and shows the blocked message.
export async function GET(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const { searchParams } = new URL(request.url);
  const url = new URL('/login', siteUrl(request) + '/');
  if (searchParams.get('reason') === 'blocked') {
    url.searchParams.set('error', 'blocked');
  }
  return NextResponse.redirect(url, { status: 303 });
}
