'use client';

import { useRef, useState, useTransition } from 'react';
import { Link2, Copy, Check, X } from 'lucide-react';
import { generateMagicLink } from './actions';

export function InviteForm() {
  const [pending, startTransition] = useTransition();
  const [link, setLink] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  function submit(fd: FormData) {
    setError(null);
    setLink(null);
    startTransition(async () => {
      const result = await generateMagicLink(fd);
      if ('error' in result) {
        setError(result.error);
      } else {
        setLink(result.link);
        formRef.current?.reset();
      }
    });
  }

  function copyLink() {
    if (!link) return;
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function dismiss() {
    setLink(null);
    setError(null);
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <div className="mb-3 flex items-center gap-2">
        <Link2 className="size-4 text-muted-foreground" />
        <h2 className="text-sm font-semibold">Invite with magic link</h2>
      </div>

      <form ref={formRef} action={submit} className="flex items-start gap-2">
        <input
          name="email"
          type="email"
          required
          placeholder="guest@example.com"
          className="h-9 flex-1 rounded-lg border border-border bg-background px-3 text-sm outline-none ring-primary/40 transition focus:border-primary/60 focus:ring-2"
        />
        <button
          type="submit"
          disabled={pending}
          className="h-9 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-60"
        >
          {pending ? 'Generating…' : 'Generate link'}
        </button>
      </form>

      {error && (
        <p className="mt-2 text-xs text-danger">{error}</p>
      )}

      {link && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
          <p className="flex-1 truncate font-mono text-xs text-muted-foreground">{link}</p>
          <button
            type="button"
            onClick={copyLink}
            title="Copy link"
            className="shrink-0 rounded p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            {copied ? <Check className="size-3.5 text-green-500" /> : <Copy className="size-3.5" />}
          </button>
          <button
            type="button"
            onClick={dismiss}
            title="Dismiss"
            className="shrink-0 rounded p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      <p className="mt-2 text-xs text-muted-foreground">
        Link is single-use and expires in 1 hour. Share it directly — no email is sent automatically.
      </p>
    </div>
  );
}
