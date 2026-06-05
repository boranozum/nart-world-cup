import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { ProfileView } from '@/components/profile/profile-view';

export default async function MePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  return (
    <section className="max-w-2xl">
      <h1 className="font-display text-3xl font-extrabold uppercase tracking-tight">Me</h1>
      <div className="mt-6">
        <ProfileView userId={user.id} isOwn />
      </div>
    </section>
  );
}
