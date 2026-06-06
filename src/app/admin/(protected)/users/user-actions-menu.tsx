'use client';

import { useEffect, useRef, useState, useTransition } from 'react';
import { MoreVertical, ShieldOff, ShieldCheck } from 'lucide-react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { blockUser, unblockUser } from './actions';

export function UserActionsMenu({
  userId,
  displayName,
  isBlocked,
}: {
  userId: string;
  displayName: string;
  isBlocked: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [menuOpen]);

  function openConfirm() {
    setMenuOpen(false);
    setError(null);
    setConfirmOpen(true);
  }

  function runAction() {
    setError(null);
    const fd = new FormData();
    fd.set('userId', userId);
    startTransition(async () => {
      const res = await (isBlocked ? unblockUser(fd) : blockUser(fd));
      if (res && 'error' in res) {
        setError(res.error);
        return;
      }
      setConfirmOpen(false);
    });
  }

  return (
    <div ref={menuRef} className="relative flex justify-end">
      <button
        type="button"
        aria-label="User actions"
        onClick={() => setMenuOpen((v) => !v)}
        className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
      >
        <MoreVertical className="size-4" />
      </button>

      {menuOpen && (
        <div className="absolute right-0 top-8 z-20 min-w-[160px] rounded-xl border border-border bg-card py-1 shadow-lg">
          <button
            type="button"
            onClick={openConfirm}
            className={`flex w-full items-center gap-2 px-3 py-2 text-sm font-medium transition hover:bg-muted ${
              isBlocked ? 'text-foreground' : 'text-danger'
            }`}
          >
            {isBlocked ? (
              <>
                <ShieldCheck className="size-4 text-green-500" />
                Unblock user
              </>
            ) : (
              <>
                <ShieldOff className="size-4" />
                Block user
              </>
            )}
          </button>
        </div>
      )}

      <ConfirmDialog
        open={confirmOpen}
        title={isBlocked ? 'Unblock user' : 'Block user'}
        message={
          error ??
          (isBlocked
            ? `Allow ${displayName} to sign in again?`
            : `Block ${displayName}? They will be signed out immediately and cannot log in until unblocked. Their points and predictions are preserved.`)
        }
        confirmLabel={isBlocked ? 'Unblock' : 'Block'}
        busyLabel={isBlocked ? 'Unblocking…' : 'Blocking…'}
        destructive={!isBlocked}
        busy={busy}
        onConfirm={runAction}
        onCancel={() => {
          setConfirmOpen(false);
          setError(null);
        }}
      />
    </div>
  );
}
