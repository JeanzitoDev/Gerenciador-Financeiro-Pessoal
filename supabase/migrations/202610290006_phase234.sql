-- Phase 2.3.4 — Overdraft limit (Cheque Especial) on Checking Accounts.
-- Preserves all existing accounts, balances, history and RLS policies.
begin;

alter table public.accounts
  add column if not exists overdraft_cents bigint not null default 0;

alter table public.accounts
  drop constraint if exists accounts_overdraft_cents_check;
alter table public.accounts
  add constraint accounts_overdraft_cents_check
  check (overdraft_cents between 0 and 999999999999);

alter table public.accounts
  drop constraint if exists accounts_overdraft_kind_check;
alter table public.accounts
  add constraint accounts_overdraft_kind_check
  check (kind = 'checking' or overdraft_cents = 0);

create or replace function public.check_finance_integrity() returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
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
    if account_row.kind='checking' and coalesce(account_row.overdraft_cents,0)>0 and current_balance < -account_row.overdraft_cents then
      raise exception 'Saldo insuficiente: o lançamento ultrapassa o saldo e o limite do cheque especial desta conta.';
    end if;
    if allocated>greatest(current_balance,0) then raise exception 'Saldo insuficiente: ajuste as reservas das metas antes desta operação.'; end if;
  end loop;
  return null;
end $$;

revoke all on function public.check_finance_integrity() from public,anon,authenticated;

commit;

