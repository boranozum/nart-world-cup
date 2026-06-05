type Props = {
  name: string;
  shortName?: string | null;
  badgeUrl?: string | null;
  /** Extra classes for sizing; defaults to 32px. */
  className?: string;
};

/** A team's crest if set, otherwise its short code / initials on a neutral tile. */
export function TeamBadge({ name, shortName, badgeUrl, className = 'size-8' }: Props) {
  const label = (shortName?.trim() || name.trim().slice(0, 3)).toUpperCase();
  return (
    <span
      className={`grid shrink-0 place-items-center overflow-hidden rounded-md bg-muted text-[10px] font-bold leading-none text-muted-foreground ${className}`}
      aria-hidden
    >
      {badgeUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={badgeUrl} alt="" className="size-full object-contain" />
      ) : (
        label
      )}
    </span>
  );
}
