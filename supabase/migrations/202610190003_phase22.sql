-- Phase 2.2: new accounts start in dark mode. Existing preferences stay intact.
begin;
alter table public.profiles alter column theme set default 'dark';
commit;
