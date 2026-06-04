import { createClient } from '@/lib/supabase/server';

export default async function MePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <section className="max-w-md">
      <h1 className="font-display text-3xl font-extrabold uppercase tracking-tight">Me</h1>
      <p className="mt-1 text-muted-foreground">Your profile, predictions and stats will live here.</p>

      <div className="mt-8 rounded-xl border border-border bg-card p-5">
        <p className="text-sm text-muted-foreground">Signed in as</p>
        <p className="font-medium">{user?.email}</p>

        <form action="/auth/signout" method="post" className="mt-5">
          <button className="rounded-full border border-border px-5 py-2 text-sm font-medium transition-colors hover:bg-muted">
            Sign out
          </button>
        </form>
      </div>
    </section>
  );
}
