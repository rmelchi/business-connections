CREATE TABLE public.role_change_audit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_profile_id text NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  actor_profile_id text REFERENCES public.profiles(id) ON DELETE SET NULL,
  old_role app_role NOT NULL,
  new_role app_role NOT NULL,
  reason text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

GRANT SELECT ON public.role_change_audit TO authenticated;
GRANT ALL ON public.role_change_audit TO service_role;

ALTER TABLE public.role_change_audit ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins read role change audit"
ON public.role_change_audit FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

CREATE INDEX role_change_audit_created_at_idx ON public.role_change_audit (created_at DESC);

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.member_roles mr
    JOIN public.profiles p ON p.id = mr.profile_id
    WHERE p.auth_user_id = _user_id
      AND mr.role = _role
      AND (mr.role <> 'admin'::app_role OR p.membership_status = 'active'::membership_status)
  )
$function$;