'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';

const MAX_LEN = 2000;

type Result = { error: string } | { ok: true };

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

  const { error } = await supabase.from('comments').insert({
    match_id: input.matchId,
    parent_id: input.parentId,
    body,
    user_id: user.id,
  });
  if (error) {
    return { error: /one level deep/i.test(error.message) ? 'Replies can’t be nested further.' : 'Could not post comment.' };
  }
  revalidatePath(`/match/${input.matchId}`);
  return { ok: true };
}

/** Edit your own comment. */
export async function editComment(input: {
  id: string;
  matchId: number;
  body: string;
}): Promise<Result> {
  const supabase = await createClient();
  const body = input.body.trim();
  if (!body) return { error: 'Comment can’t be empty.' };
  if (body.length > MAX_LEN) return { error: 'Comment is too long.' };

  const { error } = await supabase
    .from('comments')
    .update({ body, updated_at: new Date().toISOString() })
    .eq('id', input.id);
  if (error) return { error: 'Could not save your edit.' };
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
export async function toggleLike(input: {
  commentId: string;
  matchId: number;
}): Promise<Result> {
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
    await supabase
      .from('comment_likes')
      .delete()
      .eq('comment_id', input.commentId)
      .eq('user_id', user.id);
  } else {
    await supabase.from('comment_likes').insert({ comment_id: input.commentId, user_id: user.id });
  }
  revalidatePath(`/match/${input.matchId}`);
  return { ok: true };
}
