'use client';

import { useEffect, useState } from 'react';
import { getFinalizationData } from '@/app/(app)/finalize-check-action';
import { FinalizeAnimation } from '@/components/finalize-animation';
import type { FinalizationData } from '@/app/(app)/finalize-check-action';

/**
 * Mounted once in the app layout. On first load checks for an unseen
 * match-day finalization and triggers the animation overlay if needed.
 * Runs entirely client-side so it adds zero SSR latency to any page.
 */
export function FinalizeAnimationShell() {
  const [data, setData] = useState<FinalizationData | null>(null);

  useEffect(() => {
    getFinalizationData().then(setData);
  }, []);

  if (!data) return null;
  return <FinalizeAnimation {...data} />;
}
