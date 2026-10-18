-- BRL amounts are integer cents. Run once in Supabase SQL Editor or with `supabase db push`.
begin;
create table public.profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check(length(display_name)<=80),
  theme text not null default 'system' check(theme in ('light','dark','system')),
  accent text not null default 'violet' check(accent in ('violet','emerald','blue','rose')),
  background text not null default 'gradient' check(background in ('plain','gradient','dots'))
);
create table public.accounts (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check(length(trim(name)) between 1 and 80),
  kind text not null check(kind in ('checking','cash','benefit','investment')),
  opening_cents bigint not null default 0 check(abs(opening_cents)<=999999999999),
  opening_date date not null, created_at timestamptz not null default now(), unique(user_id,id)
);
create table public.goals (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check(length(trim(name)) between 1 and 80),
  target_cents bigint not null check(target_cents between 1 and 999999999999), target_date date not null,
  priority integer not null default 1 check(priority between 1 and 99),
  monthly_budget_cents bigint check(monthly_budget_cents between 0 and 999999999999),
  created_at timestamptz not null default now(), unique(user_id,id)
);
create table public.investments (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  account_id uuid not null unique, name text not null check(length(trim(name)) between 1 and 80),
  annual_rate numeric(12,8) not null default 0 check(annual_rate > -1 and annual_rate<=10),
  inflation_rate numeric(12,8) not null default 0 check(inflation_rate > -1 and inflation_rate<=10),
  created_at timestamptz not null default now(), unique(user_id,id),
  foreign key(user_id,account_id) references public.accounts(user_id,id) on delete restrict
);
create table public.contributions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  goal_id uuid not null, account_id uuid not null,
  amount_cents bigint not null check(amount_cents between 1 and 999999999999), date date not null,
  note text not null default '' check(length(note)<=200), created_at timestamptz not null default now(), unique(user_id,id),
  foreign key(user_id,goal_id) references public.goals(user_id,id) on delete restrict,
  foreign key(user_id,account_id) references public.accounts(user_id,id) on delete restrict
);
create table public.recurrences (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check(kind in ('income','expense')), description text not null check(length(trim(description)) between 1 and 140),
  amount_cents bigint not null check(amount_cents between 1 and 999999999999),
  source_account_id uuid, target_account_id uuid, category text not null default 'Outros' check(length(category) between 1 and 60),
  frequency text not null check(frequency in ('monthly','weekly','yearly')), start_date date not null, end_date date,
  active boolean not null default true, created_at timestamptz not null default now(), unique(user_id,id),
  check(end_date is null or end_date>=start_date), check(start_date>='2000-01-01' and start_date<='2100-12-31'),
  check((kind='income' and source_account_id is null and target_account_id is not null) or (kind='expense' and source_account_id is not null and target_account_id is null)),
  foreign key(user_id,source_account_id) references public.accounts(user_id,id) on delete restrict,
  foreign key(user_id,target_account_id) references public.accounts(user_id,id) on delete restrict
);
-- Future import infrastructure: no MVP write API or parser is exposed.
create table public.import_batches (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  filename text not null, fingerprint text not null, status text not null default 'pending' check(status in ('pending','reviewed','confirmed','failed')),
  created_at timestamptz not null default now(), unique(user_id,id), unique(user_id,fingerprint)
);
create table public.categorization_rules (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  pattern text not null, category text not null, priority integer not null default 1, active boolean not null default true,
  created_at timestamptz not null default now(), unique(user_id,id)
);
create table public.transactions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check(kind in ('income','expense','transfer','yield')),
  description text not null check(length(trim(description)) between 1 and 140),
  amount_cents bigint not null check(amount_cents<>0 and abs(amount_cents)<=999999999999),
  date date not null, status text not null default 'posted' check(status in ('planned','posted','cancelled')),
  source_account_id uuid, target_account_id uuid,
  category text not null default 'Outros' check(length(category) between 1 and 60),
  gross_cents bigint check(gross_cents between 0 and 999999999999), deductions_cents bigint check(deductions_cents between 0 and 999999999999),
  recurrence_id uuid, occurrence_date date,
  source text not null default 'manual' check(source in ('manual','recurrence','import')),
  external_id text, import_batch_id uuid, categorization_rule_id uuid,
  created_at timestamptz not null default now(), unique(user_id,id),
  unique(recurrence_id,occurrence_date),
  check((kind='yield') or amount_cents>0),
  check((kind in ('income','yield') and source_account_id is null and target_account_id is not null)
    or (kind='expense' and source_account_id is not null and target_account_id is null)
    or (kind='transfer' and source_account_id is not null and target_account_id is not null and source_account_id<>target_account_id)),
  check((gross_cents is null and deductions_cents is null) or (kind='income' and gross_cents is not null and deductions_cents is not null and gross_cents-deductions_cents=amount_cents)),
  check((recurrence_id is null and occurrence_date is null) or (recurrence_id is not null and occurrence_date is not null)),
  foreign key(user_id,source_account_id) references public.accounts(user_id,id) on delete restrict,
  foreign key(user_id,target_account_id) references public.accounts(user_id,id) on delete restrict,
  foreign key(user_id,recurrence_id) references public.recurrences(user_id,id) on delete restrict,
  foreign key(user_id,import_batch_id) references public.import_batches(user_id,id) on delete restrict,
  foreign key(user_id,categorization_rule_id) references public.categorization_rules(user_id,id) on delete restrict
);
create unique index transactions_external_unique on public.transactions(user_id,source,external_id) where external_id is not null;
create index transactions_user_date on public.transactions(user_id,date desc);
create index transactions_source on public.transactions(user_id,source_account_id);
create index transactions_target on public.transactions(user_id,target_account_id);
create index transactions_recurrence on public.transactions(user_id,recurrence_id);
create index transactions_import_batch on public.transactions(user_id,import_batch_id);
create index transactions_categorization on public.transactions(user_id,categorization_rule_id);
create index contributions_account on public.contributions(user_id,account_id);
create index contributions_goal on public.contributions(user_id,goal_id);
create index recurrences_user_active on public.recurrences(user_id,active);
create index recurrences_source on public.recurrences(user_id,source_account_id);
create index recurrences_target on public.recurrences(user_id,target_account_id);
create index investments_user_account on public.investments(user_id,account_id);

-- Explicit grants + RLS. Composite foreign keys close cross-owner relationship paths.
do $$ declare t text; begin
  foreach t in array array['profiles','accounts','goals','investments','contributions','recurrences','transactions','import_batches','categorization_rules'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from anon, authenticated',t);
    execute format('grant select on public.%I to authenticated',t);
    execute format('create policy own_select on public.%I for select to authenticated using ((select auth.uid())=user_id)',t);
    if t not in ('import_batches','categorization_rules') then
      execute format('grant insert,update,delete on public.%I to authenticated',t);
      execute format('create policy own_insert on public.%I for insert to authenticated with check ((select auth.uid())=user_id)',t);
      execute format('create policy own_update on public.%I for update to authenticated using ((select auth.uid())=user_id) with check ((select auth.uid())=user_id)',t);
      execute format('create policy own_delete on public.%I for delete to authenticated using ((select auth.uid())=user_id)',t);
    end if;
  end loop;
end $$;

create function public.create_profile() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin insert into public.profiles(user_id) values(new.id) on conflict do nothing; return new; end $$;
revoke all on function public.create_profile() from public,anon,authenticated;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.create_profile();

create function public.lock_finance_owner() returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
declare owner_id uuid; begin
  owner_id:=case when tg_op='DELETE' then old.user_id else new.user_id end;
  if owner_id is distinct from auth.uid() then raise exception 'Acesso negado.' using errcode='42501'; end if;
  if tg_op='UPDATE' and (old.user_id<>new.user_id or old.id<>new.id) then raise exception 'Identidade imutável.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(owner_id::text,0));
  if tg_op='DELETE' then return old; end if; return new;
end $$;

create function public.check_finance_integrity() returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
declare uid uuid:=auth.uid(); today_br date:=(now() at time zone 'America/Sao_Paulo')::date; account_row record; current_balance numeric; allocated numeric;
begin
  if exists(select 1 from accounts where user_id=uid and opening_date>today_br) then raise exception 'A abertura da conta não pode ser futura.'; end if;
  if exists(select 1 from transactions t where t.user_id=uid and t.status<>'cancelled' and (
    (t.status='posted' and t.date>today_br)
    or exists(select 1 from accounts a where a.user_id=uid and a.id in (t.source_account_id,t.target_account_id) and t.date<a.opening_date)
  )) then raise exception 'Data inválida: realizado futuro ou movimento anterior à abertura.'; end if;
  if exists(select 1 from transactions t join accounts a on a.user_id=t.user_id and a.id=t.target_account_id where t.user_id=uid and t.kind='yield' and a.kind<>'investment') then raise exception 'Rendimento exige conta de investimento.'; end if;
  if exists(select 1 from transactions t join accounts s on s.id=t.source_account_id and s.user_id=t.user_id join accounts d on d.id=t.target_account_id and d.user_id=t.user_id where t.user_id=uid and t.kind='transfer' and ((s.kind='benefit')<>(d.kind='benefit'))) then raise exception 'Benefícios não podem ser convertidos em dinheiro livre.'; end if;
  if exists(select 1 from investments i join accounts a on a.id=i.account_id and a.user_id=i.user_id where i.user_id=uid and a.kind<>'investment') then raise exception 'Aplicação exige conta do tipo investimento.'; end if;
  if exists(select 1 from contributions c join accounts a on a.id=c.account_id and a.user_id=c.user_id where c.user_id=uid and (a.kind='benefit' or c.date>today_br or c.date<a.opening_date)) then raise exception 'Aporte exige recurso livre e data válida.'; end if;
  if exists(select 1 from goals g join contributions c on c.goal_id=g.id and c.user_id=g.user_id where g.user_id=uid group by g.id,g.target_cents having sum(c.amount_cents)>g.target_cents) then raise exception 'Os aportes excedem o valor da meta.'; end if;
  for account_row in select * from accounts where user_id=uid loop
    select account_row.opening_cents+coalesce(sum((case when target_account_id=account_row.id then amount_cents else 0 end)-(case when source_account_id=account_row.id then amount_cents else 0 end)),0)
      into current_balance from transactions where user_id=uid and status='posted' and date<=today_br and (source_account_id=account_row.id or target_account_id=account_row.id);
    select coalesce(sum(amount_cents),0) into allocated from contributions where user_id=uid and account_id=account_row.id;
    if abs(current_balance)>999999999999 then raise exception 'Saldo fora do limite permitido.'; end if;
    if account_row.kind in ('benefit','investment') and current_balance<0 then raise exception 'Benefício ou investimento sem saldo suficiente.'; end if;
    if allocated>greatest(current_balance,0) then raise exception 'Saldo insuficiente: ajuste as reservas das metas antes desta operação.'; end if;
  end loop;
  return null;
end $$;

do $$ declare t text; begin
  foreach t in array array['accounts','goals','investments','contributions','recurrences','transactions'] loop
    execute format('create trigger lock_owner before insert or update or delete on public.%I for each row execute function public.lock_finance_owner()',t);
    execute format('create trigger validate_finance after insert or update or delete on public.%I for each row execute function public.check_finance_integrity()',t);
  end loop;
end $$;
revoke all on function public.lock_finance_owner() from public,anon,authenticated;
revoke all on function public.check_finance_integrity() from public,anon,authenticated;

-- One RPC/transaction. Re-execution never duplicates or resurrects cancelled occurrences.
create function public.generate_recurrences(p_from date,p_until date) returns integer language plpgsql security invoker set search_path=public,pg_temp as $$
declare r record; i integer; occurrence date; base date; inserted integer; total integer:=0; uid uuid:=auth.uid(); begin
  if uid is null then raise exception 'Autenticação necessária.' using errcode='42501'; end if;
  if p_from is null or p_until is null or p_until<p_from or p_until>(p_from+interval '12 months')::date or p_from<'2000-01-01' or p_until>'2101-12-31' then raise exception 'Janela inválida: máximo 12 meses.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(uid::text,0));
  for r in select * from recurrences where user_id=uid and active loop
    for i in 0..6000 loop
      if r.frequency='weekly' then occurrence:=r.start_date+i*7;
      else
        base:=(date_trunc('month',r.start_date)+make_interval(months=>i*(case when r.frequency='yearly' then 12 else 1 end)))::date;
        occurrence:=base+(least(extract(day from r.start_date)::integer,extract(day from base+interval '1 month'-interval '1 day')::integer)-1);
      end if;
      exit when occurrence>p_until or (r.end_date is not null and occurrence>r.end_date);
      if occurrence>=p_from then
        insert into transactions(user_id,kind,description,amount_cents,date,status,source_account_id,target_account_id,category,recurrence_id,occurrence_date,source)
          values(uid,r.kind,r.description,r.amount_cents,occurrence,'planned',r.source_account_id,r.target_account_id,r.category,r.id,occurrence,'recurrence')
          on conflict(recurrence_id,occurrence_date) do nothing;
        get diagnostics inserted=row_count; total:=total+inserted;
      end if;
    end loop;
  end loop;
  return total;
end $$;
create function public.delete_recurrence(p_id uuid) returns void language plpgsql security invoker set search_path=public,pg_temp as $$
begin
  if auth.uid() is null then raise exception 'Autenticação necessária.' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text,0));
  update transactions set recurrence_id=null,occurrence_date=null where user_id=auth.uid() and recurrence_id=p_id;
  delete from recurrences where user_id=auth.uid() and id=p_id;
end $$;
revoke all on function public.generate_recurrences(date,date) from public,anon;
revoke all on function public.delete_recurrence(uuid) from public,anon;
grant execute on function public.generate_recurrences(date,date) to authenticated;
grant execute on function public.delete_recurrence(uuid) to authenticated;
commit;
