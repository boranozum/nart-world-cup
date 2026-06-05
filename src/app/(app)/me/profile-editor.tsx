'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Camera, Check, Pencil, X } from 'lucide-react';
import { checkUsername } from '@/app/onboarding/actions';
import { updateProfile } from './actions';

type Avail = 'idle' | 'checking' | 'ok' | 'taken' | 'invalid';

const USERNAME_RE = /^[a-zA-Z0-9_]{3,20}$/;

export function ProfileEditor({
  initialUsername,
  initialAvatarUrl,
}: {
  initialUsername: string;
  initialAvatarUrl: string | null;
}) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [username, setUsername] = useState(initialUsername);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(initialAvatarUrl);
  const [avail, setAvail] = useState<Avail>('idle');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear any pending availability check on unmount.
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  // Live username availability, debounced (skip when unchanged from the saved value).
  function onUsernameChange(value: string) {
    setUsername(value);
    const name = value.trim();
    if (timer.current) clearTimeout(timer.current);
    if (name === initialUsername) {
      setAvail('idle');
      return;
    }
    if (!USERNAME_RE.test(name)) {
      setAvail('invalid');
      return;
    }
    setAvail('checking');
    timer.current = setTimeout(async () => {
      const { available } = await checkUsername(name);
      setAvail(available ? 'ok' : 'taken');
    }, 350);
  }

  function pickAvatar(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  function reset() {
    setUsername(initialUsername);
    setAvatarFile(null);
    setAvatarPreview(initialAvatarUrl);
    setAvail('idle');
    setError(null);
  }

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (avail === 'taken' || avail === 'invalid') {
      setError('Pick a valid, available username.');
      return;
    }
    const fd = new FormData();
    fd.set('username', username.trim());
    if (avatarFile) fd.set('avatar', avatarFile);
    startTransition(async () => {
      const res = await updateProfile(fd);
      if ('error' in res) {
        setError(res.error);
        return;
      }
      setOpen(false);
      setAvatarFile(null);
      router.refresh();
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-full border border-border px-3.5 py-1.5 text-sm font-medium transition hover:bg-muted"
      >
        <Pencil className="size-3.5" /> Edit profile
      </button>
    );
  }

  const letter = (username || initialUsername || '?').trim()[0]?.toUpperCase() ?? '?';

  return (
    <form onSubmit={onSubmit} className="w-full rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="group relative size-20 shrink-0 overflow-hidden rounded-full ring-2 ring-border transition hover:ring-accent"
        >
          {avatarPreview ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={avatarPreview} alt="" className="size-full object-cover" />
          ) : (
            <span className="grid size-full place-items-center bg-primary font-display text-2xl font-bold text-primary-foreground">
              {letter}
            </span>
          )}
          <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 bg-black/50 py-1 text-[10px] font-medium text-white opacity-0 transition group-hover:opacity-100">
            <Camera className="size-3" /> Change
          </span>
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          className="hidden"
          onChange={pickAvatar}
        />

        <div className="min-w-0 flex-1">
          <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Username
          </label>
          <div className="relative">
            <input
              value={username}
              onChange={(e) => onUsernameChange(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 pr-9 outline-none focus:border-primary"
            />
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2">
              {avail === 'ok' && <Check className="size-4 text-success" />}
              {(avail === 'taken' || avail === 'invalid') && <X className="size-4 text-danger" />}
            </span>
          </div>
          <p className="mt-1 h-4 text-xs">
            {avail === 'checking' && <span className="text-muted-foreground">Checking…</span>}
            {avail === 'taken' && <span className="text-danger">Already taken</span>}
            {avail === 'invalid' && (
              <span className="text-muted-foreground">3–20 letters, numbers or underscores</span>
            )}
            {avail === 'ok' && <span className="text-success">Available</span>}
          </p>
        </div>
      </div>

      {error && <p className="mt-3 text-sm text-danger">{error}</p>}

      <div className="mt-4 flex items-center gap-2">
        <button
          disabled={pending}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-60"
        >
          {pending ? 'Saving…' : 'Save changes'}
        </button>
        <button
          type="button"
          onClick={() => {
            reset();
            setOpen(false);
          }}
          className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm font-medium transition hover:bg-muted"
        >
          <X className="size-3.5" /> Cancel
        </button>
      </div>
    </form>
  );
}
