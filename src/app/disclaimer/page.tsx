import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { DisclaimerScreen } from './disclaimer-screen';

export default async function DisclaimerPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  if (user.app_metadata?.disclaimer_accepted === true) redirect('/');

  return <DisclaimerScreen />;
}
