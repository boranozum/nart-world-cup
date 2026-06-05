import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import { ProfileView } from '@/components/profile/profile-view';

export default async function PlayerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Viewing your own profile? Use the canonical /me page (with edit controls).
  if (user && user.id === id) redirect('/me');

  return (
    <section className="max-w-2xl">
      <Link
        href="/league"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> League
      </Link>
      <div className="mt-6">
        <ProfileView userId={id} isOwn={false} />
      </div>
    </section>
  );
}
