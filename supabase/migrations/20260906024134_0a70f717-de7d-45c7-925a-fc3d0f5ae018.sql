ALTER TABLE public.wildapricot_events
  ADD COLUMN IF NOT EXISTS action text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS account_id text;

CREATE INDEX IF NOT EXISTS wildapricot_events_created_at_idx
  ON public.wildapricot_events (created_at DESC);