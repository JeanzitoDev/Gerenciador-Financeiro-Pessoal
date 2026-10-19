-- OPTIONAL but recommended for automatic registration while the app is closed.
-- Supabase's pg_cron runs entirely in PostgreSQL; no SMTP or paid external service.
-- Enable pg_cron in Database > Extensions first, then run this file once.
-- 03:10 UTC = 00:10 in São Paulo. Transactions still use their scheduled BR date.
create or replace function public.sync_all_recurrences() returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare owner_row record;
begin
  for owner_row in select distinct user_id from recurrences where active loop
    begin
      perform set_config('request.jwt.claim.sub',owner_row.user_id::text,true);
      perform set_config('request.jwt.claims',json_build_object('sub',owner_row.user_id,'role','authenticated')::text,true);
      perform public.sync_recurrences();
    exception when others then
      raise warning 'Meu Norte: recorrência pendente para usuário %. SQLSTATE %',owner_row.user_id,sqlstate;
    end;
  end loop;
  perform set_config('request.jwt.claim.sub','',true);
  perform set_config('request.jwt.claims','{}',true);
end $$;
revoke all on function public.sync_all_recurrences() from public,anon,authenticated,service_role;
-- Re-running replaces the same named job rather than creating duplicate jobs.
select cron.schedule('meu-norte-recorrencias','10 3 * * *',$$select public.sync_all_recurrences();$$);
