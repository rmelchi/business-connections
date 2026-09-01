
REVOKE ALL ON FUNCTION public.current_profile_id() FROM public, anon;
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.current_profile_id() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
REVOKE ALL ON public.member_directory FROM anon;
REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM public, anon;
