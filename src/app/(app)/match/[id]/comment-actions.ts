'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';

const MAX_LEN = 2000;
const MENTION_RE = /@([a-zA-Z0-9_]{3,20})/g;

type Result = { error: string } | { ok: true };

function extractMentions(body: string): string[] {
  const out = new Set<string>();
  for (const m of body.matchAll(MENTION_RE)) out.add(m[1].toLowerCase());
  return [...out];
}

/**
 * Resolve @usernames in a comment body, sync the comment_mentions rows, and
 * send a notification to each *newly* mentioned user (never the author).
 * Uses the service role because comment_mentions / notifications have no
 * client insert policy.
 */
async function syncMentions(opts: { commentId: string; matchId: number; authorId: string; body: string }) {
  const { commentId, matchId, authorId, body } = opts;
  const admin = createAdminClient();
  const usernames = extractMentions(body);

  let resolved: { id: string }[] = [];
  if (usernames.length) {
    // usernames match [a-zA-Z0-9_]{3,20}, safe to inline in the or() filter.
    const { data } = await admin
      .from('profiles')
      .select('id, username')
      .or(usernames.map((u) => `username.ilike.${u}`).join(','));
    resolved = (data ?? []).filter((p) => p.username);
  }
  const resolvedIds = new Set(resolved.map((r) => r.id));

  const { data: existingRows } = await admin
    .from('comment_mentions')
    .select('mentioned_user_id')
    .eq('comment_id', commentId);
  const existing = new Set((existingRows ?? []).map((r) => r.mentioned_user_id));

  const toAdd = [...resolvedIds].filter((id) => !existing.has(id));
  const toRemove = [...existing].filter((id) => !resolvedIds.has(id));

  if (toRemove.length) {
    await admin.from('comment_mentions').delete().eq('comment_id', commentId).in('mentioned_user_id', toRemove);
  }
  if (!toAdd.length) return;

  await admin
    .from('comment_mentions')
    .insert(toAdd.map((id) => ({ comment_id: commentId, mentioned_user_id: id })));

  const recipients = toAdd.filter((id) => id !== authorId);
  if (!recipients.length) return;

  const { data: actor } = await admin
    .from('profiles')
    .select('username, avatar_url, email')
    .eq('id', authorId)
    .maybeSingle();
  const actorName = actor?.username?.trim() || actor?.email?.split('@')[0] || 'Someone';
  const snippet = body.length > 90 ? `${body.slice(0, 90)}…` : body;

  await admin.from('notifications').insert(
    recipients.map((id) => ({
      user_id: id,
      type: 'mention',
      payload: {
        comment_id: commentId,
        match_id: matchId,
        actor_id: authorId,
        actor_name: actorName,
        actor_avatar: actor?.avatar_url ?? null,
        snippet,
      },
    })),
  );
}

/** Typeahead search over @technarts.com usernames for the mention picker. */
export async function searchUsers(
  query: string,
): Promise<{ users: { id: string; username: string; avatarUrl: string | null }[] }> {
  const q = query.trim().replace(/[%,()*]/g, '');
  if (!q) return { users: [] };
  const supabase = await createClient();
  const { data } = await supabase
    .from('profiles')
    .select('id, username, avatar_url')
    .ilike('username', `${q}%`)
    .not('username', 'is', null)
    .limit(6);
  return {
    users: (data ?? []).map((p) => ({ id: p.id, username: p.username as string, avatarUrl: p.avatar_url })),
  };
}

/** Post a top-level comment or a reply (depth-1 enforced by a DB trigger). */
export async function postComment(input: {
  matchId: number;
  parentId: string | null;
  body: string;
}): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not signed in.' };

  const body = input.body.trim();
  if (!body) return { error: 'Write something first.' };
  if (body.length > MAX_LEN) return { error: 'Comment is too long.' };

  const { data: inserted, error } = await supabase
    .from('comments')
    .insert({ match_id: input.matchId, parent_id: input.parentId, body, user_id: user.id })
    .select('id')
    .single();
  if (error || !inserted) {
    return { error: /one level deep/i.test(error?.message ?? '') ? 'Replies can’t be nested further.' : 'Could not post comment.' };
  }

  await syncMentions({ commentId: inserted.id, matchId: input.matchId, authorId: user.id, body });
  revalidatePath(`/match/${input.matchId}`);
  return { ok: true };
}

/** Edit your own comment. */
export async function editComment(input: { id: string; matchId: number; body: string }): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not signed in.' };

  const body = input.body.trim();
  if (!body) return { error: 'Comment can’t be empty.' };
  if (body.length > MAX_LEN) return { error: 'Comment is too long.' };

  const { error } = await supabase
    .from('comments')
    .update({ body, updated_at: new Date().toISOString() })
    .eq('id', input.id);
  if (error) return { error: 'Could not save your edit.' };

  await syncMentions({ commentId: input.id, matchId: input.matchId, authorId: user.id, body });
  revalidatePath(`/match/${input.matchId}`);
  return { ok: true };
}

/** Soft-delete your own comment (keeps the thread intact). */
export async function deleteComment(input: { id: string; matchId: number }): Promise<Result> {
  const supabase = await createClient();
  const { error } = await supabase
    .from('comments')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', input.id);
  if (error) return { error: 'Could not delete the comment.' };
  revalidatePath(`/match/${input.matchId}`);
  return { ok: true };
}

/** Toggle a like on a comment. */
export async function toggleLike(input: { commentId: string; matchId: number }): Promise<Result> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: 'Not signed in.' };

  const { data: existing } = await supabase
    .from('comment_likes')
    .select('comment_id')
    .eq('comment_id', input.commentId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (existing) {
    await supabase.from('comment_likes').delete().eq('comment_id', input.commentId).eq('user_id', user.id);
  } else {
    await supabase.from('comment_likes').insert({ comment_id: input.commentId, user_id: user.id });
  }
  revalidatePath(`/match/${input.matchId}`);
  return { ok: true };
}
