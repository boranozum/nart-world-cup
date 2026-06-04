import { createClient } from '@/lib/supabase/server';

/**
 * First-login onboarding. Full flow (username + avatar setup → intro slideshow →
 * guided tour, per SPEC.md §9.1) is built next. This placeholder confirms the
 * authenticated user landed here.
 */
export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
      <h1 className="text-2xl font-semibold">Welcome to Nart World Cup 👋</h1>
      <p className="max-w-md text-zinc-500">
        Let&apos;s set up your profile. ({user?.email})
      </p>
      <p className="text-xs text-zinc-400">Onboarding flow coming next.</p>
    </div>
  );
}
