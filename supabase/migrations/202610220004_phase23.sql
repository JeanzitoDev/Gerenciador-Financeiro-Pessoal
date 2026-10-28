-- Phase 2.3. Preserves balances, history and all previous preference choices.
begin;
alter table public.profiles add column onboarding_dismissed boolean not null default false;
alter table public.profiles add column onboarding_step integer not null default 0 check(onboarding_step between 0 and 4);
update public.profiles p set onboarding_step=4 where exists(select 1 from public.accounts a where a.user_id=p.user_id);
alter table public.goals add column completed boolean not null default false;
alter table public.goals add column dependencies jsonb not null default '[]'::jsonb;

-- Existing lock_owner trigger serializes graph changes for each authenticated owner.
-- Run graph validation in the database too, including direct PostgREST writes.
create function public.validate_goal_dependencies() returns trigger
language plpgsql security invoker set search_path=public,pg_temp as $$
declare owner_id uuid; item jsonb; parent_id uuid; minimum numeric; parent_target bigint; seen uuid[]:='{}';
begin
  owner_id:=case when tg_op='DELETE' then old.user_id else new.user_id end;
  if owner_id is distinct from auth.uid() then raise exception 'Acesso negado.' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(owner_id::text,0));
  if tg_op='DELETE' then
    if exists(select 1 from goals g cross join lateral jsonb_array_elements(g.dependencies) d where g.user_id=owner_id and g.id<>old.id and d->>'goal_id'=old.id::text) then
      raise exception 'Remova esta meta das condições das outras metas antes de excluir.';
    end if;
    return old;
  end if;
  if jsonb_typeof(new.dependencies)<>'array' then raise exception 'Condições de metas inválidas.'; end if;
  if jsonb_array_length(new.dependencies)>20 then raise exception 'Use até 20 condições por meta.'; end if;
  for item in select value from jsonb_array_elements(new.dependencies) loop
    if jsonb_typeof(item)<>'object' or jsonb_typeof(item->'goal_id') is distinct from 'string' or not(item ? 'minimum_cents') then
      raise exception 'Condição de meta inválida.';
    end if;
    begin parent_id:=(item->>'goal_id')::uuid; exception when invalid_text_representation then raise exception 'Escolha uma meta válida.'; end;
    if parent_id=new.id or parent_id=any(seen) then raise exception 'Uma meta não pode depender dela mesma nem repetir uma condição.'; end if;
    seen:=array_append(seen,parent_id);
    select target_cents into parent_target from goals where user_id=owner_id and id=parent_id;
    if not found then raise exception 'Escolha uma meta da sua conta como condição.'; end if;
    if item->'minimum_cents'<>'null'::jsonb then
      if jsonb_typeof(item->'minimum_cents')<>'number' then raise exception 'Informe um valor válido para a condição.'; end if;
      minimum:=(item->>'minimum_cents')::numeric;
      if minimum<>trunc(minimum) or minimum<1 or minimum>parent_target then raise exception 'O valor da condição não pode passar do valor da meta escolhida.'; end if;
    end if;
  end loop;
  select coalesce(jsonb_agg(jsonb_build_object('goal_id',(d->>'goal_id')::uuid,'minimum_cents',d->'minimum_cents')),'[]'::jsonb) into new.dependencies from jsonb_array_elements(new.dependencies) d;
  if exists(
    with recursive edges as (
      select g.id, (d->>'goal_id')::uuid parent_id from goals g cross join lateral jsonb_array_elements(g.dependencies) d where g.user_id=owner_id and g.id<>new.id
      union all select new.id, (d->>'goal_id')::uuid from jsonb_array_elements(new.dependencies) d
    ), reach(id) as (
      select e.parent_id from edges e where e.id=new.id
      union select e.parent_id from edges e join reach r on e.id=r.id
    ) select 1 from reach where id=new.id
  ) then raise exception 'As condições das metas não podem formar um ciclo.'; end if;
  if exists(select 1 from goals g cross join lateral jsonb_array_elements(g.dependencies) d where g.user_id=owner_id and g.id<>new.id and d->>'goal_id'=new.id::text and d->'minimum_cents'<>'null'::jsonb and (d->>'minimum_cents')::numeric>new.target_cents) then
    raise exception 'Outra meta exige um valor maior que este. Ajuste a condição primeiro.';
  end if;
  return new;
end $$;
create trigger validate_goal_dependencies before insert or update or delete on public.goals for each row execute function public.validate_goal_dependencies();
revoke all on function public.validate_goal_dependencies() from public,anon,authenticated;

-- Investment forecasting settings are legacy metadata. Account balances remain intact.
alter table public.investments drop constraint investments_user_id_account_id_fkey;
alter table public.investments add constraint investments_user_id_account_id_fkey foreign key(user_id,account_id) references public.accounts(user_id,id) on delete cascade;

-- Clear graph links before deleting a user's goals; only service_role can call this RPC.
create or replace function public.delete_account_completely(p_user uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if p_user is null then raise exception 'Usuário obrigatório.'; end if;
  perform set_config('request.jwt.claim.sub',p_user::text,true);
  perform set_config('request.jwt.claims',json_build_object('sub',p_user,'role','authenticated')::text,true);
  perform pg_advisory_xact_lock(hashtextextended(p_user::text,0));
  delete from transactions where user_id=p_user;
  delete from contributions where user_id=p_user;
  delete from investments where user_id=p_user;
  delete from recurrences where user_id=p_user;
  delete from loans where user_id=p_user;
  delete from accounts where user_id=p_user;
  update goals set dependencies='[]'::jsonb where user_id=p_user;
  delete from goals where user_id=p_user;
  delete from import_batches where user_id=p_user;
  delete from categorization_rules where user_id=p_user;
  delete from profiles where user_id=p_user;
  delete from write_budgets where user_id=p_user;
  delete from auth.users where id=p_user;
end $$;
revoke all on function public.delete_account_completely(uuid) from public,anon,authenticated;
grant execute on function public.delete_account_completely(uuid) to service_role;
commit;
