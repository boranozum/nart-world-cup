'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Heart, MessageSquare, Pencil, Trash2 } from 'lucide-react';
import { PlayerAvatar } from '@/components/player-avatar';
import { LocalTime } from '@/components/local-time';
import { deleteComment, editComment, postComment, toggleLike } from './comment-actions';

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

export function CommentThread({
  matchId,
  currentUserId,
  comments,
  predictionsSecret,
}: {
  matchId: number;
  currentUserId: string;
  comments: ThreadComment[];
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
  // Drop deleted top-level comments that have no surviving replies.
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
        <Composer matchId={matchId} parentId={null} onDone={refresh} placeholder="Add a comment…" />
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
  onDone,
  isReply = false,
}: {
  comment: ThreadComment;
  matchId: number;
  currentUserId: string;
  onDone: () => void;
  isReply?: boolean;
}) {
  const router = useRouter();
  const [replying, setReplying] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(c.body);
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
    if (!confirm('Delete this comment?')) return;
    startBusy(async () => {
      await deleteComment({ id: c.id, matchId });
      onDone();
    });
  }

  return (
    <div className="flex gap-3">
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
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              rows={2}
              className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            />
            <div className="mt-1.5 flex gap-2">
              <button
                disabled={busy}
                onClick={saveEdit}
                className="rounded-full bg-primary px-3.5 py-1.5 text-xs font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-60"
              >
                Save
              </button>
              <button
                onClick={() => {
                  setEditing(false);
                  setEditText(c.body);
                }}
                className="rounded-full px-3.5 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-muted"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-0.5 whitespace-pre-wrap break-words text-sm">{c.body}</p>
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
                  onClick={remove}
                  disabled={busy}
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
              placeholder={`Reply to ${c.authorName}…`}
              onDone={() => {
                setReplying(false);
                onDone();
              }}
              autoFocus
            />
          </div>
        )}
      </div>
    </div>
  );
}

function Composer({
  matchId,
  parentId,
  placeholder,
  onDone,
  autoFocus = false,
}: {
  matchId: number;
  parentId: string | null;
  placeholder: string;
  onDone: () => void;
  autoFocus?: boolean;
}) {
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    setError(null);
    startTransition(async () => {
      const res = await postComment({ matchId, parentId, body });
      if ('error' in res) {
        setError(res.error);
        return;
      }
      setBody('');
      onDone();
    });
  }

  return (
    <div>
      <textarea
        value={body}
        autoFocus={autoFocus}
        onChange={(e) => setBody(e.target.value)}
        placeholder={placeholder}
        rows={parentId ? 2 : 3}
        className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
      />
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
      <div className="mt-1.5 flex justify-end">
        <button
          onClick={submit}
          disabled={pending || !body.trim()}
          className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition hover:brightness-110 disabled:opacity-50"
        >
          {pending ? 'Posting…' : parentId ? 'Reply' : 'Comment'}
        </button>
      </div>
    </div>
  );
}
