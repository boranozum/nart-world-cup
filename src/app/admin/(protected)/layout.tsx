import { requireAdmin } from '@/lib/admin/session';
import { AdminShell } from '@/components/admin/admin-shell';

export default async function ProtectedAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await requireAdmin();
  return <AdminShell username={session.username}>{children}</AdminShell>;
}
