import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { OnboardingFlow } from './onboarding-flow';

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, onboarded_at, avatar_url')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.onboarded_at) redirect('/');

  const suggested = (user.email?.split('@')[0] ?? '')
    .replace(/[^a-zA-Z0-9_]/g, '')
    .slice(0, 20);
  const googleAvatar = (user.user_metadata?.avatar_url as string | undefined) ?? null;

  return (
    <OnboardingFlow
      email={user.email ?? ''}
      suggestedUsername={suggested}
      initialAvatarUrl={profile?.avatar_url ?? googleAvatar}
    />
  );
}
