-- Custom SQL migration: auth.users FK, RLS policies, triggers, seed row.
-- (Things drizzle-kit does not generate from the schema.)

-- profiles.id references the Supabase-managed auth.users table.
ALTER TABLE "profiles"
  ADD CONSTRAINT "profiles_id_auth_users_fk"
  FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;
--> statement-breakpoint

-- Auto-create a profile row when a new auth user signs up.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email) VALUES (NEW.id, NEW.email)
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
--> statement-breakpoint

-- Keep updated_at fresh on edits.
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;
--> statement-breakpoint
CREATE TRIGGER predictions_touch_updated BEFORE UPDATE ON public.predictions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
--> statement-breakpoint
CREATE TRIGGER comments_touch_updated BEFORE UPDATE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
--> statement-breakpoint

-- Comments may nest only one level (a reply's parent must be top-level).
CREATE OR REPLACE FUNCTION public.enforce_comment_depth()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.parent_id IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM public.comments c WHERE c.id = NEW.parent_id AND c.parent_id IS NOT NULL) THEN
      RAISE EXCEPTION 'Comments can only be nested one level deep';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER comments_depth_guard BEFORE INSERT OR UPDATE ON public.comments
  FOR EACH ROW EXECUTE FUNCTION public.enforce_comment_depth();
--> statement-breakpoint

-- Booster cap: at most league_settings.booster_total active boosters per user,
-- counting only non-cancelled matches (cancellation refunds the booster).
CREATE OR REPLACE FUNCTION public.enforce_booster_cap()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE cap int; used int;
BEGIN
  IF NEW.booster_applied THEN
    SELECT booster_total INTO cap FROM public.league_settings WHERE id = true;
    SELECT count(*) INTO used
      FROM public.predictions p
      JOIN public.matches m ON m.id = p.match_id
      WHERE p.user_id = NEW.user_id
        AND p.booster_applied
        AND m.status <> 'cancelled'
        AND p.id <> NEW.id;
    IF used + 1 > coalesce(cap, 5) THEN
      RAISE EXCEPTION 'Booster limit (%) exceeded', coalesce(cap, 5);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER predictions_booster_cap BEFORE INSERT OR UPDATE ON public.predictions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_booster_cap();
--> statement-breakpoint

-- Seed the singleton league settings row.
INSERT INTO public.league_settings (id) VALUES (true) ON CONFLICT (id) DO NOTHING;
--> statement-breakpoint

-- ============================ Row-Level Security ============================
-- Service role bypasses RLS, so admin/server writes are unaffected. Policies
-- below govern player (authenticated) access.

-- profiles: public read, edit own.
ALTER TABLE "profiles" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "profiles_select_all" ON "profiles" FOR SELECT TO authenticated USING (true);
--> statement-breakpoint
CREATE POLICY "profiles_update_own" ON "profiles" FOR UPDATE TO authenticated
  USING (id = auth.uid()) WITH CHECK (id = auth.uid());
--> statement-breakpoint

-- predictions: manage your own; read others' only after kickoff (the secrecy rule).
ALTER TABLE "predictions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "predictions_own_all" ON "predictions" FOR ALL TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
--> statement-breakpoint
CREATE POLICY "predictions_reveal_after_kickoff" ON "predictions" FOR SELECT TO authenticated
  USING (
    user_id <> auth.uid() AND EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = predictions.match_id
        AND (m.kickoff_utc <= now() OR m.status IN ('live','concluded'))
    )
  );
--> statement-breakpoint

-- comments: public read, write/edit/delete own.
ALTER TABLE "comments" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "comments_select_all" ON "comments" FOR SELECT TO authenticated USING (true);
--> statement-breakpoint
CREATE POLICY "comments_insert_own" ON "comments" FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
--> statement-breakpoint
CREATE POLICY "comments_update_own" ON "comments" FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
--> statement-breakpoint
CREATE POLICY "comments_delete_own" ON "comments" FOR DELETE TO authenticated USING (user_id = auth.uid());
--> statement-breakpoint

-- comment_likes / comment_reactions: public read, manage own.
ALTER TABLE "comment_likes" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "comment_likes_select_all" ON "comment_likes" FOR SELECT TO authenticated USING (true);
--> statement-breakpoint
CREATE POLICY "comment_likes_insert_own" ON "comment_likes" FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
--> statement-breakpoint
CREATE POLICY "comment_likes_delete_own" ON "comment_likes" FOR DELETE TO authenticated USING (user_id = auth.uid());
--> statement-breakpoint
ALTER TABLE "comment_reactions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "comment_reactions_select_all" ON "comment_reactions" FOR SELECT TO authenticated USING (true);
--> statement-breakpoint
CREATE POLICY "comment_reactions_insert_own" ON "comment_reactions" FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
--> statement-breakpoint
CREATE POLICY "comment_reactions_delete_own" ON "comment_reactions" FOR DELETE TO authenticated USING (user_id = auth.uid());
--> statement-breakpoint

-- comment_mentions: public read (created server-side).
ALTER TABLE "comment_mentions" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "comment_mentions_select_all" ON "comment_mentions" FOR SELECT TO authenticated USING (true);
--> statement-breakpoint

-- notifications: read/update only your own.
ALTER TABLE "notifications" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "notifications_own_select" ON "notifications" FOR SELECT TO authenticated USING (user_id = auth.uid());
--> statement-breakpoint
CREATE POLICY "notifications_own_update" ON "notifications" FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
--> statement-breakpoint

-- Reference / read-only tables: authenticated read; writes happen via service role.
ALTER TABLE "teams" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "teams_select_all" ON "teams" FOR SELECT TO authenticated USING (true);
--> statement-breakpoint
ALTER TABLE "players" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "players_select_all" ON "players" FOR SELECT TO authenticated USING (true);
--> statement-breakpoint
ALTER TABLE "match_days" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "match_days_select_all" ON "match_days" FOR SELECT TO authenticated USING (true);
--> statement-breakpoint
ALTER TABLE "matches" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "matches_select_all" ON "matches" FOR SELECT TO authenticated USING (true);
--> statement-breakpoint
ALTER TABLE "match_results" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "match_results_select_all" ON "match_results" FOR SELECT TO authenticated USING (true);
--> statement-breakpoint
ALTER TABLE "prediction_scores" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "prediction_scores_select_all" ON "prediction_scores" FOR SELECT TO authenticated USING (true);
--> statement-breakpoint
ALTER TABLE "standings_snapshots" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "standings_snapshots_select_all" ON "standings_snapshots" FOR SELECT TO authenticated USING (true);
--> statement-breakpoint
ALTER TABLE "standings_snapshot_rows" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "standings_snapshot_rows_select_all" ON "standings_snapshot_rows" FOR SELECT TO authenticated USING (true);
--> statement-breakpoint
ALTER TABLE "league_settings" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
CREATE POLICY "league_settings_select_all" ON "league_settings" FOR SELECT TO authenticated USING (true);
--> statement-breakpoint

-- admins: RLS on, no policy → no access for anon/authenticated (service role only).
ALTER TABLE "admins" ENABLE ROW LEVEL SECURITY;
