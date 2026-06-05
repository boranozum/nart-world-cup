'use client';

import { useState } from 'react';

/**
 * Renders an <img>, but swaps to `fallback` if the source is missing or fails
 * to load (e.g. a broken/expired badge or avatar URL). Keeps the parent a
 * server component while still handling onError on the client.
 */
export function ImageOrFallback({
  src,
  fallback,
  imgClassName,
}: {
  src?: string | null;
  fallback: React.ReactNode;
  imgClassName?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <>{fallback}</>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className={imgClassName} onError={() => setFailed(true)} />
  );
}
