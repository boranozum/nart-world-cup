'use client';

/** Renders an ISO timestamp in the viewer's local timezone. */
export function LocalTime({
  iso,
  options,
}: {
  iso: string;
  options?: Intl.DateTimeFormatOptions;
}) {
  const formatted = new Date(iso).toLocaleString(
    undefined,
    options ?? { dateStyle: 'medium', timeStyle: 'short' },
  );
  return (
    <time dateTime={iso} suppressHydrationWarning>
      {formatted}
    </time>
  );
}
