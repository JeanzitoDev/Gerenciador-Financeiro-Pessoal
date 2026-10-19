-- Meu Norte 2.0.0 — apply AFTER 202610180001_initial.sql. No existing records are removed.
begin;
alter table public.profiles drop constraint profiles_accent_check;
alter table public.profiles add constraint profiles_accent_check check(accent in ('violet','emerald','blue','rose','amber','teal','indigo','coral'));
alter table public.profiles drop constraint profiles_background_check;
alter table public.profiles add constraint profiles_background_check check(background in ('plain','gradient','dots','aurora','grid','waves'));
alter table public.recurrences add column auto_post boolean not null default false;
alter table public.recurrences add column auto_from date not null default (now() at time zone 'America/Sao_Paulo')::date;
create or replace function public.create_profile() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  insert into public.profiles(user_id,display_name) values(new.id,left(trim(coalesce(new.raw_user_meta_data->>'display_name','')),80)) on conflict do nothing;
  return new;
end $$;
-- Metadata is display-only; never used to decide authorization.
update public.profiles p set display_name=left(trim(u.raw_user_meta_data->>'display_name'),80)
from auth.users u where p.user_id=u.id and p.display_name='' and u.raw_user_meta_data->>'display_name' is not null;

create table public.loans (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check(length(trim(name)) between 1 and 80), institution text not null default '' check(length(institution)<=80),
  kind text not null check(kind in ('loan','financing')),
  principal_cents bigint check(principal_cents between 1 and 999999999999),
  installment_cents bigint not null check(installment_cents between 1 and 999999999999),
  total_installments integer not null check(total_installments between 1 and 1200),
  paid_before integer not null default 0 check(paid_before>=0 and paid_before<=total_installments),
  first_due_date date not null check(first_due_date between '2000-01-01' and '2100-12-31'),
  monthly_rate numeric(12,8) check(monthly_rate between 0 and 10),
  cet_annual_rate numeric(12,8) check(cet_annual_rate between 0 and 10),
  account_id uuid, created_at timestamptz not null default now(), unique(user_id,id),
  foreign key(user_id,account_id) references public.accounts(user_id,id) on delete restrict
);
create index loans_user_account on public.loans(user_id,account_id);
alter table public.loans enable row level security;
revoke all on public.loans from anon,authenticated;
grant select,insert,update,delete on public.loans to authenticated;
create policy own_select on public.loans for select to authenticated using((select auth.uid())=user_id);
create policy own_insert on public.loans for insert to authenticated with check((select auth.uid())=user_id);
create policy own_update on public.loans for update to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy own_delete on public.loans for delete to authenticated using((select auth.uid())=user_id);
create trigger lock_owner before insert or update or delete on public.loans for each row execute function public.lock_finance_owner();
alter table public.transactions add column loan_id uuid;
alter table public.transactions add column installment_number integer;
alter table public.transactions add constraint transactions_loan_owner_fk foreign key(user_id,loan_id) references public.loans(user_id,id) on delete restrict;
alter table public.transactions add constraint transactions_loan_pair check((loan_id is null and installment_number is null) or (loan_id is not null and installment_number is not null and installment_number between 1 and 1200 and kind='expense'));
create unique index transactions_loan_installment on public.transactions(loan_id,installment_number) where loan_id is not null;
create index transactions_user_loan on public.transactions(user_id,loan_id);

create function public.validate_loan_links() returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
begin
  if exists(select 1 from transactions t join loans l on l.user_id=t.user_id and l.id=t.loan_id
    where t.user_id=auth.uid() and (t.installment_number<=l.paid_before or t.installment_number>l.total_installments)) then
    raise exception 'As parcelas registradas não cabem no contrato. Ajuste os pagamentos antes de alterar o total ou o histórico.';
  end if;
  if exists(select 1 from loans l join accounts a on a.user_id=l.user_id and a.id=l.account_id where l.user_id=auth.uid() and a.kind='benefit') then
    raise exception 'Escolha uma conta em dinheiro para pagar as parcelas.';
  end if;
  return null;
end $$;
create trigger validate_loan_links after insert or update on public.loans for each row execute function public.validate_loan_links();
create trigger validate_loan_links after insert or update on public.transactions for each row execute function public.validate_loan_links();
revoke all on function public.validate_loan_links() from public,anon,authenticated;

-- Enabling automatic registration today never confirms the old backlog.
create function public.recurrence_auto_boundary() returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
begin
  if tg_op='INSERT' then new.auto_from:=(now() at time zone 'America/Sao_Paulo')::date;
  elsif new.auto_post and (not old.auto_post or (new.active and not old.active)) then new.auto_from:=(now() at time zone 'America/Sao_Paulo')::date;
  else new.auto_from:=old.auto_from;
  end if;
  return new;
end $$;
create trigger recurrence_auto_boundary before insert or update on public.recurrences for each row execute function public.recurrence_auto_boundary();
revoke all on function public.recurrence_auto_boundary() from public,anon,authenticated;

-- Set-based schedule; monetary mutations are serialized per owner by the existing lock.
-- Per-row exception blocks keep a failed auto debit pending without undoing other occurrences.
create function public.sync_recurrences() returns integer language plpgsql security invoker set search_path=public,pg_temp as $$
declare r record; d record; uid uuid:=auth.uid(); today_br date:=(now() at time zone 'America/Sao_Paulo')::date;
  horizon date:=least(((now() at time zone 'America/Sao_Paulo')::date+interval '1 month')::date,'2100-12-31'::date);
  n integer:=0; inserted integer;
begin
  if uid is null then raise exception 'Autenticação necessária.' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
  for r in select q.*,a.opening_date from recurrences q join accounts a on a.user_id=q.user_id and a.id=coalesce(q.source_account_id,q.target_account_id) where q.user_id=uid and q.active loop
    for d in
      select occurrence from (
        select case when r.frequency='weekly' then r.start_date+i*7
        else (date_trunc('month',r.start_date)+make_interval(months=>i*(case when r.frequency='yearly' then 12 else 1 end)))::date
          +least(extract(day from r.start_date)::integer,extract(day from date_trunc('month',r.start_date)+make_interval(months=>i*(case when r.frequency='yearly' then 12 else 1 end))+interval '1 month'-interval '1 day')::integer)-1 end as occurrence
        from generate_series(0,case when r.frequency='weekly' then greatest(0,(horizon-r.start_date)/7)
          else greatest(0,((extract(year from horizon)::integer-extract(year from r.start_date)::integer)*12+extract(month from horizon)::integer-extract(month from r.start_date)::integer)/(case when r.frequency='yearly' then 12 else 1 end)) end) i
      ) dates where occurrence between greatest(r.start_date,r.opening_date) and least(horizon,coalesce(r.end_date,horizon))
    loop
      insert into transactions(user_id,kind,description,amount_cents,date,status,source_account_id,target_account_id,category,recurrence_id,occurrence_date,source)
        values(uid,r.kind,r.description,r.amount_cents,d.occurrence,'planned',r.source_account_id,r.target_account_id,r.category,r.id,d.occurrence,'recurrence')
        on conflict(recurrence_id,occurrence_date) do nothing;
      get diagnostics inserted=row_count; n:=n+inserted;
    end loop;
    if r.auto_post then
      for d in select id from transactions where user_id=uid and recurrence_id=r.id and status='planned' and occurrence_date>=r.auto_from and occurrence_date<=today_br and date<=today_br loop
        begin
          update transactions set status='posted' where id=d.id and user_id=uid;
        exception when raise_exception or check_violation or numeric_value_out_of_range then
          -- Balance/reservation protection wins. The user can review this item in "Para confirmar".
          null;
        end;
      end loop;
    end if;
  end loop;
  return n;
end $$;
revoke all on function public.sync_recurrences() from public,anon;
grant execute on function public.sync_recurrences() to authenticated;

create function public.pay_loan_installment(p_id uuid,p_number integer,p_account uuid,p_date date,p_amount bigint) returns uuid
language plpgsql security invoker set search_path=public,pg_temp as $$
declare l loans%rowtype; uid uuid:=auth.uid(); result uuid;
begin
  if uid is null then raise exception 'Autenticação necessária.' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
  select * into l from loans where id=p_id and user_id=uid;
  if not found then raise exception 'Contrato não encontrado.'; end if;
  if p_number is null or p_number<=l.paid_before or p_number>l.total_installments then raise exception 'Parcela inválida.'; end if;
  if p_amount is null or p_amount<=0 or p_amount>999999999999 then raise exception 'Valor inválido.'; end if;
  if not exists(select 1 from accounts where id=p_account and user_id=uid and kind in ('checking','cash')) then raise exception 'Escolha uma conta em dinheiro.'; end if;
  select id into result from transactions where loan_id=p_id and installment_number=p_number and user_id=uid and status='posted';
  if result is not null then return result; end if;
  insert into transactions(user_id,kind,description,amount_cents,date,status,source_account_id,category,loan_id,installment_number)
    values(uid,'expense',left(l.name||' · Parcela '||p_number||'/'||l.total_installments,140),p_amount,p_date,'posted',p_account,'Empréstimos e financiamentos',p_id,p_number)
    on conflict(loan_id,installment_number) where loan_id is not null do update set status='posted',amount_cents=excluded.amount_cents,date=excluded.date,source_account_id=excluded.source_account_id
    returning id into result;
  return result;
end $$;
revoke all on function public.pay_loan_installment(uuid,integer,uuid,date,bigint) from public,anon;
grant execute on function public.pay_loan_installment(uuid,integer,uuid,date,bigint) to authenticated;

-- Small per-owner write budget shared by Vercel instances. No external rate-limit service.
create table public.write_budgets(user_id uuid primary key references auth.users(id) on delete cascade, window_at timestamptz not null,hits integer not null);
alter table public.write_budgets enable row level security;
revoke all on public.write_budgets from public,anon,authenticated;
create function public.consume_write_budget() returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid(); n integer;
begin
  if uid is null then return false; end if;
  insert into write_budgets values(uid,now(),1) on conflict(user_id) do update
    set hits=case when write_budgets.window_at<now()-interval '1 minute' then 1 else write_budgets.hits+1 end,
        window_at=case when write_budgets.window_at<now()-interval '1 minute' then now() else write_budgets.window_at end returning hits into n;
  return n<=120;
end $$;
revoke all on function public.consume_write_budget() from public,anon;
grant execute on function public.consume_write_budget() to authenticated;

-- Only the server's service_role can remove Auth + all financial rows atomically.
create function public.delete_account_completely(p_user uuid) returns void language plpgsql security definer set search_path=public,pg_temp as $$
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
