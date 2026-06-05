import { ImageOrFallback } from '@/components/image-or-fallback';

type Props = {
  name: string;
  avatarUrl?: string | null;
  /** Extra classes for sizing/positioning; defaults to a 36px circle. */
  className?: string;
};

/** A player's avatar: their picture if set, otherwise their initial on a brand circle. */
export function PlayerAvatar({ name, avatarUrl, className = 'size-9' }: Props) {
  const letter = (name.trim()[0] ?? '?').toUpperCase();
  return (
    <span
      className={`grid shrink-0 place-items-center overflow-hidden rounded-full bg-primary font-display font-bold text-primary-foreground ${className}`}
      aria-hidden
    >
      <ImageOrFallback src={avatarUrl} fallback={letter} imgClassName="size-full object-cover" />
    </span>
  );
}
