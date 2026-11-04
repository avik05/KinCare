-- BR3/BR5: check for missed check-ins every minute with pg_cron (available on Supabase's free plan).
-- Wrapped so that setup still succeeds if pg_cron cannot be enabled; the app also calls
-- check_no_shows() every time a screen refreshes, so alerts still fire while someone has the app open.
do $do$
begin
  create extension if not exists pg_cron with schema pg_catalog;
  grant usage on schema cron to postgres;
  perform cron.unschedule(jobid) from cron.job where jobname = 'kincare-no-show-check';
  perform cron.schedule('kincare-no-show-check', '* * * * *', 'select public.check_no_shows()');
exception when others then
  raise notice 'pg_cron not enabled (%). Enable it under Database > Extensions, then run this file again.', sqlerrm;
end
$do$;
