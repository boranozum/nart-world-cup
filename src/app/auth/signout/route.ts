import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  // 303 so the browser follows with a GET.
  return NextResponse.redirect(new URL('/login', request.url), { status: 303 });
}

// Used when the proxy detects a blocked user — signs them out and shows the blocked message.
export async function GET(request: Request) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const url = new URL('/login', request.url);
  const { searchParams } = new URL(request.url);
  if (searchParams.get('reason') === 'blocked') {
    url.searchParams.set('error', 'blocked');
  }
  return NextResponse.redirect(url, { status: 303 });
}
