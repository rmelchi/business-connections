CREATE TABLE public.wildapricot_sync_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL DEFAULT 'full',
  status text NOT NULL DEFAULT 'running',
  trigger_source text NOT NULL DEFAULT 'manual',
  triggered_by text,
  contacts_seen integer NOT NULL DEFAULT 0,
  contacts_created integer NOT NULL DEFAULT 0,
  contacts_updated integer NOT NULL DEFAULT 0,
  contacts_failed integer NOT NULL DEFAULT 0,
  error_message text,
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.wildapricot_sync_runs TO authenticated;
GRANT ALL ON public.wildapricot_sync_runs TO service_role;
ALTER TABLE public.wildapricot_sync_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read sync runs" ON public.wildapricot_sync_runs
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.wildapricot_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_event_id text NOT NULL UNIQUE,
  event_type text NOT NULL,
  contact_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'pending',
  error_message text,
  processed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.wildapricot_events TO authenticated;
GRANT ALL ON public.wildapricot_events TO service_role;
ALTER TABLE public.wildapricot_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read wildapricot events" ON public.wildapricot_events
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE TABLE public.wildapricot_sync_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id uuid REFERENCES public.wildapricot_sync_runs(id) ON DELETE CASCADE,
  event_id uuid REFERENCES public.wildapricot_events(id) ON DELETE CASCADE,
  level text NOT NULL DEFAULT 'info',
  message text NOT NULL,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.wildapricot_sync_log TO authenticated;
GRANT ALL ON public.wildapricot_sync_log TO service_role;
ALTER TABLE public.wildapricot_sync_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins read sync log" ON public.wildapricot_sync_log
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_wa_sync_log_run ON public.wildapricot_sync_log(run_id);
CREATE INDEX idx_wa_events_contact ON public.wildapricot_events(contact_id);
CREATE INDEX idx_wa_sync_runs_started ON public.wildapricot_sync_runs(started_at DESC);

CREATE TRIGGER wildapricot_sync_runs_updated_at BEFORE UPDATE ON public.wildapricot_sync_runs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER wildapricot_events_updated_at BEFORE UPDATE ON public.wildapricot_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();