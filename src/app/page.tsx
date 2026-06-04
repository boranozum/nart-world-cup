import { createClient } from '@/lib/supabase/server';
import { ThemeToggle } from '@/components/theme-toggle';

export default async function Home() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex items-center justify-between border-b border-border px-6 py-4">
        <span className="font-display text-xl font-bold tracking-wide">
          Nart <span className="text-accent">World Cup</span>
        </span>
        <ThemeToggle />
      </header>

      <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
        <h1 className="font-display text-4xl font-extrabold uppercase">Welcome back</h1>
        <p className="text-muted-foreground">
          Signed in as <span className="font-medium text-foreground">{user?.email}</span>
        </p>
        <form action="/auth/signout" method="post">
          <button className="rounded-full border border-border px-5 py-2 text-sm font-medium transition-colors hover:bg-muted">
            Sign out
          </button>
        </form>
      </main>
    </div>
  );
}
