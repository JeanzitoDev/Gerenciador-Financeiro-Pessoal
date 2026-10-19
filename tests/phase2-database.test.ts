import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
const A = "11111111-1111-4111-8111-111111111111",
  B = "22222222-2222-4222-8222-222222222222";
const bank = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  other = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  investment = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
const rule = "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  auto = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  debit = "ffffffff-ffff-4fff-8fff-ffffffffffff",
  loan = "99999999-9999-4999-8999-999999999999";
let db: PGlite;
async function user(id: string) {
  await db.exec(
    `set role authenticated;select set_config('request.jwt.claim.sub','${id}',false);`,
  );
}
async function rows<T = Record<string, unknown>>(s: string) {
  return (await db.query<T>(s)).rows;
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}'::jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to authenticated,anon;grant usage on schema public to service_role;grant execute on function auth.uid() to authenticated,anon;`,
  );
  await db.exec(
    readFileSync("supabase/migrations/202610180001_initial.sql", "utf8"),
  );
  await db.exec(
    `insert into auth.users(id,raw_user_meta_data) values('${A}','{"display_name":"Jean"}'),('${B}','{"display_name":"Outro usuário"}');`,
  );
  await db.exec(
    readFileSync("supabase/migrations/202610180002_phase2.sql", "utf8"),
  );
  await db.exec(
    readFileSync("supabase/migrations/202610190003_phase22.sql", "utf8"),
  );
  await user(A);
  await db.exec(
    `insert into accounts(id,user_id,name,kind,opening_cents,opening_date)values('${bank}','${A}','Banco','checking',1000000,'2020-01-01'),('${investment}','${A}','Aplicação','investment',0,'2020-01-01');`,
  );
  await user(B);
  await db.exec(
    `insert into accounts(id,user_id,name,kind,opening_cents,opening_date)values('${other}','${B}','Outro banco','checking',1000,'2020-01-01');`,
  );
  await user(A);
});
afterAll(async () => {
  await db?.close();
});
describe.sequential("fase 2 — migração, automação e contratos", () => {
  it("fase 2.2 define escuro para novos usuários e preserva escolhas existentes", async () => {
    expect(
      (await rows<{ theme: string }>("select theme from profiles"))[0].theme,
    ).toBe("system");
    const newcomer = "33333333-3333-4333-8333-333333333333";
    await db.exec(
      `reset role;insert into auth.users(id) values('${newcomer}');`,
    );
    expect(
      (
        await rows<{ theme: string }>(
          `select theme from profiles where user_id='${newcomer}'`,
        )
      )[0].theme,
    ).toBe("dark");
    await db.exec(`delete from auth.users where id='${newcomer}'`);
    await user(A);
  });
  it("preserva usuários existentes e aproveita o nome apenas para exibição", async () => {
    expect(
      (
        await rows<{ display_name: string }>(
          "select display_name from profiles",
        )
      )[0].display_name,
    ).toBe("Jean");
  });
  it("novas preferências continuam isoladas", async () => {
    await db.exec("update profiles set accent='coral',background='aurora'");
    await user(B);
    expect(
      (await rows<{ accent: string }>(`select accent from profiles`))[0].accent,
    ).toBe("violet");
    await user(A);
  });
  it("inclui recorrência retroativa sem confirmar recebimentos", async () => {
    await db.exec(
      `insert into recurrences(id,user_id,kind,description,amount_cents,target_account_id,frequency,start_date)values('${rule}','${A}','income','Retroativa',10000,'${bank}','monthly',((now() at time zone 'America/Sao_Paulo')::date-interval '2 months')::date);select sync_recurrences();`,
    );
    const result = await rows<{ status: string }>(
      `select status from transactions where recurrence_id='${rule}'`,
    );
    expect(result.length).toBeGreaterThanOrEqual(3);
    expect(result.every((r) => r.status === "planned")).toBe(true);
  });
  it("recarregar nunca duplica e uma ocorrência pulada não reaparece", async () => {
    const before = await rows("select id from transactions");
    await db.exec(
      `update transactions set status='cancelled' where id=(select id from transactions where recurrence_id='${rule}' order by date limit 1);select sync_recurrences();select sync_recurrences();`,
    );
    expect(await rows("select id from transactions")).toHaveLength(
      before.length,
    );
    expect(
      await rows("select id from transactions where status='cancelled'"),
    ).toHaveLength(1);
  });
  it("automação confirma hoje, deixa futuro previsto e não confirma o passado", async () => {
    await db.exec(
      `insert into recurrences(id,user_id,kind,description,amount_cents,target_account_id,frequency,start_date,auto_post,auto_from)values('${auto}','${A}','income','Automática',10000,'${bank}','monthly',((now() at time zone 'America/Sao_Paulo')::date-interval '1 month')::date,true,'2000-01-01');select sync_recurrences();`,
    );
    const result = await rows<{
      date: string;
      status: string;
      auto_from: string;
      today: string;
    }>(
      `select t.date::text,t.status,r.auto_from::text,(now() at time zone 'America/Sao_Paulo')::date::text today from transactions t join recurrences r on r.id=t.recurrence_id where r.id='${auto}' order by t.date`,
    );
    expect(result[0].status).toBe("planned");
    expect(result.find((r) => r.date === r.today)?.status).toBe("posted");
    expect(result.at(-1)?.status).toBe("planned");
    expect(result[0].auto_from).toBe(result[0].today);
  });
  it("pagamento antes do vencimento atualiza o saldo uma vez e não reaparece como previsto", async () => {
    const early = "77777777-7777-4777-8777-777777777777";
    const total = async () =>
      (
        await rows<{ value: number }>(
          `select coalesce(sum(amount_cents),0)::integer as value from transactions where source_account_id='${bank}' and status='posted' and date <= (now() at time zone 'America/Sao_Paulo')::date`,
        )
      )[0].value;
    const before = await total();
    await db.exec(
      `insert into recurrences(id,user_id,kind,description,amount_cents,source_account_id,frequency,start_date) values('${early}','${A}','expense','Adiantada',5000,'${bank}','monthly',(now() at time zone 'America/Sao_Paulo')::date+2);select sync_recurrences();`,
    );
    const count = (
      await rows(`select id from transactions where recurrence_id='${early}'`)
    ).length;
    await db.exec(
      `update transactions set status='posted',date=(now() at time zone 'America/Sao_Paulo')::date where id=(select id from transactions where recurrence_id='${early}' order by occurrence_date limit 1);select sync_recurrences();select sync_recurrences();`,
    );
    expect(
      (await rows(`select id from transactions where recurrence_id='${early}'`))
        .length,
    ).toBe(count);
    expect(
      (
        await rows<{ early: boolean; status: string }>(
          `select date < occurrence_date as early,status from transactions where recurrence_id='${early}' order by occurrence_date limit 1`,
        )
      )[0],
    ).toMatchObject({ early: true, status: "posted" });
    expect(await total()).toBe(before + 5000);
  });
  it("não deixa cliente falsificar a fronteira de automação", async () => {
    await db.exec(
      `update recurrences set auto_from='2000-01-01' where id='${auto}';`,
    );
    expect(
      (
        await rows<{ ok: boolean }>(
          `select auto_from=(now() at time zone 'America/Sao_Paulo')::date ok from recurrences where id='${auto}'`,
        )
      )[0].ok,
    ).toBe(true);
  });
  it("mantém débito automático sem saldo pendente", async () => {
    await db.exec(
      `insert into recurrences(id,user_id,kind,description,amount_cents,source_account_id,frequency,start_date,auto_post)values('${debit}','${A}','expense','Sem saldo',1000,'${investment}','monthly',(now() at time zone 'America/Sao_Paulo')::date,true);select sync_recurrences();`,
    );
    const r = await rows<{ status: string }>(
      `select status from transactions where recurrence_id='${debit}'`,
    );
    expect(r.every((e) => e.status === "planned")).toBe(true);
  });
  it("pausar impede a automação; novas execuções de B não tocam em A", async () => {
    await db.exec(`update recurrences set active=false where id='${auto}';`);
    await user(B);
    await db.exec("select sync_recurrences()");
    expect(await rows("select * from transactions")).toHaveLength(0);
    await user(A);
  });
  it("gera dia 31 sem derivar para dia 28 nos meses seguintes", async () => {
    await db.exec(
      `insert into recurrences(user_id,kind,description,amount_cents,target_account_id,frequency,start_date,end_date)values('${A}','income','Dia 31',100,'${bank}','monthly','2026-01-31','2026-03-31');select sync_recurrences();`,
    );
    expect(
      (
        await rows<{ date: string }>(
          "select date::text from transactions where description='Dia 31' order by date",
        )
      ).map((r) => r.date),
    ).toEqual(["2026-01-31", "2026-02-28", "2026-03-31"]);
  });
  it("contrato aceita parcelas fixas sem lançar a receita do crédito", async () => {
    const before = (await rows("select id from transactions")).length;
    await db.exec(
      `insert into loans(id,user_id,name,institution,kind,principal_cents,installment_cents,total_installments,paid_before,first_due_date,monthly_rate,account_id)values('${loan}','${A}','Meu financiamento','Banco','financing',100000,10000,12,1,'2026-01-31',0.02,'${bank}');`,
    );
    expect((await rows("select id from transactions")).length).toBe(before);
  });
  it("pagar uma parcela duas vezes cria uma única despesa", async () => {
    await db.exec(
      `select pay_loan_installment('${loan}',2,'${bank}',(now() at time zone 'America/Sao_Paulo')::date,10000);select pay_loan_installment('${loan}',2,'${bank}',(now() at time zone 'America/Sao_Paulo')::date,10000);`,
    );
    const r = await rows<{ kind: string; status: string }>(
      `select kind,status from transactions where loan_id='${loan}'`,
    );
    expect(r).toEqual([{ kind: "expense", status: "posted" }]);
  });
  it("bloqueia parcelas históricas, fora do total e mudança de histórico com pagamentos", async () => {
    await expect(
      db.exec(
        `select pay_loan_installment('${loan}',1,'${bank}',current_date,10000)`,
      ),
    ).rejects.toThrow(/Parcela/);
    await expect(
      db.exec(
        `select pay_loan_installment('${loan}',13,'${bank}',current_date,10000)`,
      ),
    ).rejects.toThrow(/Parcela/);
    await expect(
      db.exec(`update loans set paid_before=2 where id='${loan}'`),
    ).rejects.toThrow(/parcelas/);
  });
  it("não paga com conta de outro usuário nem altera contrato alheio", async () => {
    await expect(
      db.exec(
        `select pay_loan_installment('${loan}',3,'${other}',current_date,10000)`,
      ),
    ).rejects.toThrow(/conta/);
    await user(B);
    expect(
      await rows(
        `update loans set name='Invadido' where id='${loan}' returning id`,
      ),
    ).toHaveLength(0);
    await expect(
      db.exec(
        `select pay_loan_installment('${loan}',3,'${other}',current_date,10000)`,
      ),
    ).rejects.toThrow(/Contrato/);
    await user(A);
  });
  it("bloqueia fraude de vínculo via escrita direta no PostgREST", async () => {
    await user(B);
    await expect(
      db.exec(
        `insert into transactions(user_id,kind,description,amount_cents,date,source_account_id,loan_id,installment_number)values('${B}','expense','Fraude',100,current_date,'${other}','${loan}',3)`,
      ),
    ).rejects.toThrow();
    await user(A);
  });
  it("limite de escrita é compartilhado por usuário e não pode ser alterado pelo cliente", async () => {
    const r = await rows<{ ok: boolean }>(
      "select consume_write_budget() ok from generate_series(1,122)",
    );
    expect(r.filter((r) => r.ok)).toHaveLength(120);
    await expect(db.exec("delete from write_budgets")).rejects.toThrow();
    await user(B);
    expect(
      (await rows<{ ok: boolean }>("select consume_write_budget() ok"))[0].ok,
    ).toBe(true);
    await user(A);
  });
  it("agendamento usa função fechada ao cliente e pode sincronizar pelo papel do banco", async () => {
    await db.exec("reset role");
    await db.exec(
      readFileSync("supabase/phase2-cron.sql", "utf8").split(
        "-- Re-running",
      )[0],
    );
    await user(A);
    await expect(db.exec("select sync_all_recurrences()")).rejects.toThrow();
    await db.exec("reset role;select sync_all_recurrences();");
    await user(A);
  });
  it("apagar a conta exige papel de servidor, remove vínculos e preserva B", async () => {
    await expect(
      db.exec(`select delete_account_completely('${A}')`),
    ).rejects.toThrow();
    await db.exec(
      `set role service_role;select delete_account_completely('${A}');reset role;`,
    );
    for (const table of [
      "profiles",
      "accounts",
      "loans",
      "transactions",
      "recurrences",
      "write_budgets",
    ])
      expect(
        await rows(`select * from ${table} where user_id='${A}'`),
      ).toHaveLength(0);
    expect(await rows(`select * from auth.users where id='${A}'`)).toHaveLength(
      0,
    );
    expect(
      await rows(`select * from accounts where user_id='${B}'`),
    ).toHaveLength(1);
  });
});
