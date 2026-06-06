import { TopBar } from '@/components/shell/top-bar';
import { BottomTabs } from '@/components/shell/bottom-tabs';
import { FinalizeAnimationShell } from '@/components/finalize-animation-shell';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />
      <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-24 pt-6 sm:px-6 md:pb-10">
        {children}
      </main>
      <BottomTabs />
      <FinalizeAnimationShell />
    </div>
  );
}
