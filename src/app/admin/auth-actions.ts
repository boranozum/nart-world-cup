'use server';

import { redirect } from 'next/navigation';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { db, schema } from '@/lib/db';
import { createAdminSession, clearAdminSession } from '@/lib/admin/session';

export async function adminLogin(
  _prev: { error: string } | null,
  formData: FormData,
): Promise<{ error: string } | null> {
  const username = String(formData.get('username') ?? '').trim();
  const password = String(formData.get('password') ?? '');
  if (!username || !password) return { error: 'Enter your username and password.' };

  const [admin] = await db
    .select()
    .from(schema.admins)
    .where(eq(schema.admins.username, username))
    .limit(1);

  if (!admin || !(await bcrypt.compare(password, admin.passwordHash))) {
    return { error: 'Invalid credentials.' };
  }

  await createAdminSession({ adminId: admin.id, username: admin.username });
  redirect('/admin');
}

export async function adminLogout() {
  await clearAdminSession();
  redirect('/admin/login');
}
