'use client';

import { useState, useTransition } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';

/**
 * A button that confirms via a modal before invoking a server action.
 * `fields` are submitted to the action as FormData (matching the action's
 * formData.get(...) keys).
 */
export function ConfirmActionButton({
  action,
  fields,
  title,
  message,
  confirmLabel,
  busyLabel,
  destructive = true,
  className,
  ariaLabel,
  disabled,
  children,
}: {
  action: (fd: FormData) => Promise<{ error: string } | void>;
  fields: Record<string, string | number>;
  title: string;
  message?: string;
  confirmLabel?: string;
  busyLabel?: string;
  destructive?: boolean;
  className?: string;
  ariaLabel?: string;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, startTransition] = useTransition();

  function run() {
    setError(null);
    const fd = new FormData();
    for (const [k, v] of Object.entries(fields)) fd.set(k, String(v));
    startTransition(async () => {
      const res = await action(fd);
      if (res && 'error' in res) {
        setError(res.error);
        return;
      }
      setOpen(false);
    });
  }

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        onClick={() => setOpen(true)}
        className={className}
      >
        {children}
      </button>
      <ConfirmDialog
        open={open}
        title={title}
        message={error ?? message}
        confirmLabel={confirmLabel}
        busyLabel={busyLabel}
        destructive={destructive}
        busy={busy}
        onConfirm={run}
        onCancel={() => {
          setOpen(false);
          setError(null);
        }}
      />
    </>
  );
}
