'use client';

import { useEffect, useLayoutEffect, useRef, useState, useTransition } from 'react';
import { createPortal } from 'react-dom';
import { MoreVertical, ShieldOff, ShieldCheck, Link2, Copy, Check } from 'lucide-react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { blockUser, unblockUser, generateMagicLink } from './actions';

type MenuPos = { top: number; right: number };

export function UserActionsMenu({
  userId,
  email,
  displayName,
  isBlocked,
}: {
  userId: string;
  email: string;
  displayName: string;
  isBlocked: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [linkError, setLinkError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pos, setPos] = useState<MenuPos | null>(null);
  const [busy, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Anchor the portal menu to the trigger button.
  useLayoutEffect(() => {
    if (!menuOpen) return;
    function update() {
      const el = triggerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setPos({
        top: rect.bottom + 4,
        right: window.innerWidth - rect.right,
      });
    }
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) return;
    function onClickOutside(e: MouseEvent) {
      if (
        !triggerRef.current?.contains(e.target as Node) &&
        !menuRef.current?.contains(e.target as Node)
      ) {
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

  function runBlockAction() {
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

  function openLinkDialog() {
    setMenuOpen(false);
    setGeneratedLink(null);
    setLinkError(null);
    setCopied(false);
    setLinkDialogOpen(true);
    const fd = new FormData();
    fd.set('email', email);
    startTransition(async () => {
      const res = await generateMagicLink(fd);
      if ('error' in res) {
        setLinkError(res.error);
      } else {
        setGeneratedLink(res.link);
      }
    });
  }

  function copyLink() {
    if (!generatedLink) return;
    navigator.clipboard.writeText(generatedLink).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <>
      <div className="flex justify-end">
        <button
          ref={triggerRef}
          type="button"
          aria-label="User actions"
          onClick={() => setMenuOpen((v) => !v)}
          className="rounded-md p-1.5 text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <MoreVertical className="size-4" />
        </button>
      </div>

      {menuOpen &&
        pos &&
        createPortal(
          <div
            ref={menuRef}
            className="fixed z-50 min-w-[180px] rounded-xl border border-border bg-card py-1 shadow-lg"
            style={{ top: pos.top, right: pos.right }}
          >
            <button
              type="button"
              onClick={openLinkDialog}
              className="flex w-full items-center gap-2 px-3 py-2 text-sm font-medium text-foreground transition hover:bg-muted"
            >
              <Link2 className="size-4 text-muted-foreground" />
              Generate magic link
            </button>
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
          </div>,
          document.body,
        )}

      {/* Magic link dialog */}
      {linkDialogOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center p-4" role="dialog" aria-modal="true">
          <button
            type="button"
            aria-label="Close"
            tabIndex={-1}
            onClick={() => setLinkDialogOpen(false)}
            className="absolute inset-0 bg-black/50"
          />
          <div className="relative w-full max-w-md rounded-2xl border border-border bg-card p-5 shadow-xl">
            <h3 className="font-display text-lg font-bold uppercase tracking-tight">Magic link</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              For <span className="font-medium text-foreground">{email}</span>
            </p>

            <div className="mt-4">
              {busy && !generatedLink && !linkError && (
                <p className="text-sm text-muted-foreground">Generating…</p>
              )}
              {linkError && (
                <p className="text-sm text-danger">{linkError}</p>
              )}
              {generatedLink && (
                <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2">
                  <p className="flex-1 truncate font-mono text-xs text-muted-foreground">
                    {generatedLink}
                  </p>
                  <button
                    type="button"
                    onClick={copyLink}
                    title="Copy link"
                    className="shrink-0 rounded p-1 text-muted-foreground transition hover:bg-muted hover:text-foreground"
                  >
                    {copied ? (
                      <Check className="size-3.5 text-green-500" />
                    ) : (
                      <Copy className="size-3.5" />
                    )}
                  </button>
                </div>
              )}
            </div>

            <p className="mt-3 text-xs text-muted-foreground">
              Single-use, expires in 1 hour. The recipient must{' '}
              <strong className="font-semibold text-foreground">open this URL in their browser</strong>
              {' '}— not paste it into the login form.
            </p>

            <div className="mt-5 flex justify-end gap-2">
              {generatedLink && (
                <button
                  type="button"
                  onClick={copyLink}
                  className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:brightness-110"
                >
                  {copied ? 'Copied!' : 'Copy link'}
                </button>
              )}
              <button
                type="button"
                onClick={() => setLinkDialogOpen(false)}
                className="rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition hover:bg-muted"
              >
                Close
              </button>
            </div>
          </div>
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
        onConfirm={runBlockAction}
        onCancel={() => {
          setConfirmOpen(false);
          setError(null);
        }}
      />
    </>
  );
}
