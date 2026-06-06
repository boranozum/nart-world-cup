import { ImageOrFallback } from '@/components/image-or-fallback';

type Props = {
  name: string;
  faceUrl?: string | null;
  /** Extra classes for sizing; defaults to 32px. */
  className?: string;
};

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/** A player's face photo if set, otherwise their initials on a neutral round tile. */
export function PlayerFace({ name, faceUrl, className = 'size-8' }: Props) {
  return (
    <span
      className={`grid shrink-0 place-items-center overflow-hidden rounded-full bg-muted text-[10px] font-bold leading-none text-muted-foreground ${className}`}
      aria-hidden
    >
      <ImageOrFallback src={faceUrl} fallback={initials(name)} imgClassName="size-full object-cover" />
    </span>
  );
}
