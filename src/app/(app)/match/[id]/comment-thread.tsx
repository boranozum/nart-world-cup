'use client';

import { Fragment, useEffect, useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Heart, MessageSquare, Pencil, Trash2 } from 'lucide-react';
import { PlayerAvatar } from '@/components/player-avatar';
import { LocalTime } from '@/components/local-time';
import { ConfirmDialog } from '@/components/confirm-dialog';
import {
  deleteComment,
  editComment,
  postComment,
  searchUsers,
  toggleLike,
} from './comment-actions';

export type ThreadComment = {
  id: string;
  userId: string;
  parentId: string | null;
  body: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  authorName: string;
  authorAvatar: string | null;
  likeCount: number;
  likedByMe: boolean;
};

type Sort = 'top' | 'new';

const MENTION_RE = /@([a-zA-Z0-9_]{3,20})/g;

/** Render a comment body, linking @usernames that resolve to a real player. */
function renderBody(body: string, targets: Record<string, string>) {
  const nodes: React.ReactNode[] = [];
  let last = 0;
  for (const m of body.matchAll(MENTION_RE)) {
    const idx = m.index ?? 0;
    if (idx > last) nodes.push(body.slice(last, idx));
    const id = targets[m[1].toLowerCase()];
    nodes.push(
      id ? (
        <Link key={idx} href={`/u/${id}`} className="font-medium text-accent hover:underline">
          @{m[1]}
        </Link>
      ) : (
        m[0]
      ),
    );
    last = idx + m[0].length;
  }
  if (last < body.length) nodes.push(body.slice(last));
  return nodes.map((n, i) => <Fragment key={i}>{n}</Fragment>);
}

export function CommentThread({
  matchId,
  currentUserId,
  comments,
  mentionTargets,
  predictionsSecret,
}: {
  matchId: number;
  currentUserId: string;
  comments: ThreadComment[];
  mentionTargets: Record<string, string>;
  predictionsSecret: boolean;
}) {
  const router = useRouter();
  const [sort, setSort] = useState<Sort>('top');
  const [, startTransition] = useTransition();

  const replies = new Map<string, ThreadComment[]>();
  for (const c of comments) {
    if (c.parentId) {
      const arr = replies.get(c.parentId) ?? replies.set(c.parentId, []).get(c.parentId)!;
      arr.push(c);
    }
  }
  for (const arr of replies.values()) arr.sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const visibleReplies = (id: string) => (replies.get(id) ?? []).filter((r) => !r.deletedAt);

  let topLevel = comments.filter((c) => !c.parentId);
  topLevel =
    sort === 'top'
      ? [...topLevel].sort((a, b) => b.likeCount - a.likeCount || b.createdAt.localeCompare(a.createdAt))
      : [...topLevel].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  topLevel = topLevel.filter((c) => !c.deletedAt || visibleReplies(c.id).length > 0);

  const total = comments.filter((c) => !c.deletedAt).length;

  function refresh() {
    startTransition(() => router.refresh());
  }

  return (
    <div>
      <div className="flex items-center justify-between">
        <h2 className="font-display text-xl font-bold uppercase tracking-tight">
          {total} {total === 1 ? 'comment' : 'comments'}
        </h2>
        <div className="flex gap-1 text-xs">
          {(['top', 'new'] as Sort[]).map((s) => (
            <button
              key={s}
              onClick={() => setSort(s)}
              className={`rounded-full px-3 py-1 font-semibold transition ${
                sort === s ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
              }`}
            >
              {s === 'top' ? 'Top' : 'Newest'}
            </button>
          ))}
        </div>
      </div>

      {predictionsSecret && (
        <p className="mt-3 rounded-lg bg-muted/60 px-3 py-2 text-xs text-muted-foreground">
          Picks stay secret until kickoff — please don’t reveal yours in the comments.
        </p>
      )}

      <div className="mt-4">
        <Composer matchId={matchId} parentId={null} onDone={refresh} placeholder="Add a comment… use @ to mention" />
      </div>

      {topLevel.length === 0 ? (
        <p className="mt-8 text-center text-sm text-muted-foreground">
          No comments yet. Start the conversation.
        </p>
      ) : (
        <ul className="mt-6 space-y-5">
          {topLevel.map((c) => (
            <li key={c.id}>
              <CommentItem
                comment={c}
                matchId={matchId}
                currentUserId={currentUserId}
                mentionTargets={mentionTargets}
                onDone={refresh}
              />
              {visibleReplies(c.id).length > 0 && (
                <ul className="mt-3 space-y-3 border-l border-border pl-4 sm:pl-6">
                  {visibleReplies(c.id).map((r) => (
                    <li key={r.id}>
                      <CommentItem
                        comment={r}
                        matchId={matchId}
                        currentUserId={currentUserId}
                        mentionTargets={mentionTargets}
                        onDone={refresh}
                        isReply
                      />
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function CommentItem({
  comment: c,
  matchId,
  currentUserId,
  mentionTargets,
  onDone,
  isReply = false,
}: {
  comment: ThreadComment;
  matchId: number;
  currentUserId: string;
  mentionTargets: Record<string, string>;
  onDone: () => void;
  isReply?: boolean;
}) {
  const router = useRouter();
  const [replying, setReplying] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(c.body);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [busy, startBusy] = useTransition();
  const mine = c.userId === currentUserId;

  if (c.deletedAt) {
    return <p className="text-sm italic text-muted-foreground">Comment deleted</p>;
  }

  function like() {
    startBusy(async () => {
      await toggleLike({ commentId: c.id, matchId });
      router.refresh();
    });
  }

  function saveEdit() {
    startBusy(async () => {
      const res = await editComment({ id: c.id, matchId, body: editText });
      if (!('error' in res)) {
        setEditing(false);
        onDone();
      }
    });
  }

  function remove() {
    startBusy(async () => {
      await deleteComment({ id: c.id, matchId });
      setConfirmingDelete(false);
      onDone();
    });
  }

  return (
    <div id={`comment-${c.id}`} className="flex scroll-mt-20 gap-3 target:rounded-lg target:bg-accent/5">
      <PlayerAvatar name={c.authorName} avatarUrl={c.authorAvatar} className="size-8 shrink-0 text-xs" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 text-sm">
          <span className="font-semibold">{c.authorName}</span>
          <span className="text-xs text-muted-foreground">
            <LocalTime iso={c.createdAt} />
            {c.updatedAt !== c.createdAt && ' (edited)'}
          </span>
        </div>

        {editing ? (
          <div className="mt-1.5">
            <Composer
              matchId={matchId}
              parentId={null}
              placeholder="Edit your comment…"
              initialBody={editText}
              submitLabel="Save"
              onText={setEditText}
              onSubmitOverride={saveEdit}
              busy={busy}
              onCancel={() => {
                setEditing(false);
                setEditText(c.body);
              }}
            />
          </div>
        ) : (
          <p className="mt-0.5 whitespace-pre-wrap break-words text-sm">
            {renderBody(c.body, mentionTargets)}
          </p>
        )}

        {!editing && (
          <div className="mt-1.5 flex items-center gap-4 text-xs text-muted-foreground">
            <button
              onClick={like}
              disabled={busy}
              className={`inline-flex items-center gap-1 transition hover:text-foreground ${
                c.likedByMe ? 'font-semibold text-accent' : ''
              }`}
            >
              <Heart className={`size-3.5 ${c.likedByMe ? 'fill-accent' : ''}`} />
              {c.likeCount > 0 && c.likeCount}
            </button>
            {!isReply && (
              <button
                onClick={() => setReplying((v) => !v)}
                className="inline-flex items-center gap-1 transition hover:text-foreground"
              >
                <MessageSquare className="size-3.5" /> Reply
              </button>
            )}
            {mine && (
              <>
                <button
                  onClick={() => setEditing(true)}
                  className="inline-flex items-center gap-1 transition hover:text-foreground"
                >
                  <Pencil className="size-3.5" /> Edit
                </button>
                <button
                  onClick={() => setConfirmingDelete(true)}
                  className="inline-flex items-center gap-1 transition hover:text-danger"
                >
                  <Trash2 className="size-3.5" /> Delete
                </button>
              </>
            )}
          </div>
        )}

        {replying && (
          <div className="mt-3">
            <Composer
              matchId={matchId}
              parentId={c.id}
              placeholder={`Reply to ${c.authorName}… use @ to mention`}
              onDone={() => {
                setReplying(false);
                onDone();
              }}
              autoFocus
            />
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmingDelete}
        title="Delete comment"
        message="Delete your comment permanently?"
        confirmLabel="Delete"
        busyLabel="Deleting…"
        busy={busy}
        onConfirm={remove}
        onCancel={() => setConfirmingDelete(false)}
      />
    </div>
  );
}

type MentionState = { start: number; query: string } | null;
type UserHit = { id: string; username: string; avatarUrl: string | null };

/** Finds an in-progress @mention immediately before the caret. */
function activeMention(value: string, caret: number): MentionState {
  let i = caret - 1;
  while (i >= 0 && /[a-zA-Z0-9_]/.test(value[i])) i--;
  if (i >= 0 && value[i] === '@' && (i === 0 || /\s/.test(value[i - 1]))) {
    return { start: i, query: value.slice(i + 1, caret) };
  }
  return null;
}

function Composer({
  matchId,
  parentId,
  placeholder,
  onDone,
  autoFocus = false,
  // Edit mode (controlled) overrides:
  initialBody = '',
  submitLabel,
  onText,
  onSubmitOverride,
  onCancel,
  busy: busyProp,
}: {
  matchId: number;
  parentId: string | null;
  placeholder: string;
  onDone?: () => void;
  autoFocus?: boolean;
  initialBody?: string;
  submitLabel?: string;
  onText?: (v: string) => void;
  onSubmitOverride?: () => void;
  onCancel?: () => void;
  busy?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [body, setBody] = useState(initialBody);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [mention, setMention] = useState<MentionState>(null);
  const [hits, setHits] = useState<UserHit[]>([]);
  const [hi, setHi] = useState(0);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function closeMenu() {
    setMention(null);
    setHits([]);
    setHi(0);
  }

  function onChange(e: React.ChangeEvent<HTMLTextAreaElement>) {
    const v = e.target.value;
    setBody(v);
    onText?.(v);
    const caret = e.target.selectionStart ?? v.length;
    const m = activeMention(v, caret);
    setMention(m);
    if (timer.current) clearTimeout(timer.current);
    if (!m) {
      setHits([]);
      return;
    }
    timer.current = setTimeout(async () => {
      const { users } = await searchUsers(m.query);
      setHits(users);
      setHi(0);
    }, 200);
  }

  function pick(u: UserHit) {
    if (!mention) return;
    const before = body.slice(0, mention.start);
    const after = body.slice(mention.start + 1 + mention.query.length);
    const insert = `@${u.username} `;
    const next = before + insert + after;
    setBody(next);
    onText?.(next);
    closeMenu();
    requestAnimationFrame(() => {
      const ta = ref.current;
      if (ta) {
        const pos = (before + insert).length;
        ta.focus();
        ta.setSelectionRange(pos, pos);
      }
    });
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!mention || hits.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHi((h) => (h + 1) % hits.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHi((h) => (h - 1 + hits.length) % hits.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      pick(hits[hi]);
    } else if (e.key === 'Escape') {
      closeMenu();
    }
  }

  function submit() {
    if (onSubmitOverride) {
      onSubmitOverride();
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await postComment({ matchId, parentId, body });
      if (res && 'error' in res) {
        setError(res.error);
        return;
      }
      setBody('');
      onDone?.();
    });
  }

  const isBusy = busyProp ?? pending;

  return (
    <div className="relative">
      <textarea
        ref={ref}
        value={body}
        autoFocus={autoFocus}
        onChange={onChange}
        onKeyDown={onKeyDown}
        placeholder={placeholder}
        rows={parentId ? 2 : 3}
        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
      />

      {mention && hits.length > 0 && (
        <ul className="absolute z-20 mt-1 w-64 overflow-hidden rounded-lg border border-border bg-card p-1 shadow-lg">
          {hits.map((u, i) => (
            <li key={u.id}>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  pick(u);
                }}
                className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition ${
                  i === hi ? 'bg-muted' : 'hover:bg-muted'
                }`}
              >
                <PlayerAvatar name={u.username} avatarUrl={u.avatarUrl} className="size-6 text-[10px]" />
                <span className="truncate">@{u.username}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="mt-1 text-xs text-danger">{error}</p>}

      <div className="mt-1.5 flex justify-end gap-2">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-full px-3.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted"
          >
            Cancel
          </button>
        )}
        <button
          onClick={submit}
          disabled={isBusy || !body.trim()}
          className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-50"
        >
          {isBusy ? 'Saving…' : submitLabel ?? (parentId ? 'Reply' : 'Comment')}
        </button>
      </div>
    </div>
  );
}
