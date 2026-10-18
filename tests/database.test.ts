import { PGlite } from "@electric-sql/pglite";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
let db: PGlite;
const userA = "11111111-1111-4111-8111-111111111111",
  userB = "22222222-2222-4222-8222-222222222222";
const accA = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  accB = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb";
const investment = "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  benefit = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
const goal = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
  recurrence = "ffffffff-ffff-4fff-8fff-ffffffffffff";
async function asUser(uid: string) {
  await db.exec(
    `set role authenticated; select set_config('request.jwt.claim.sub','${uid}',false);`,
  );
}
async function sql(query: string) {
  return db.query(query);
}
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema public,auth to authenticated,anon; grant execute on function auth.uid() to authenticated,anon;`,
  );
  await db.exec(
    readFileSync("supabase/migrations/202610180001_initial.sql", "utf8"),
  );
  await db.exec(`insert into auth.users values('${userA}'),('${userB}');`);
  await asUser(userA);
  await sql(
    `insert into accounts(id,user_id,name,kind,opening_cents,opening_date) values('${accA}','${userA}','Banco A','checking',100000,'2026-01-01'),('${investment}','${userA}','Aplicação','investment',0,'2026-01-01'),('${benefit}','${userA}','VA','benefit',10000,'2026-01-01')`,
  );
  await sql(
    `insert into goals(id,user_id,name,target_cents,target_date) values('${goal}','${userA}','Reserva',50000,'2027-01-01')`,
  );
  await asUser(userB);
  await sql(
    `insert into accounts(id,user_id,name,kind,opening_cents,opening_date) values('${accB}','${userB}','Banco B','checking',5000,'2026-01-01')`,
  );
  await asUser(userA);
});
afterAll(async () => {
  await db?.close();
});
describe.sequential("PostgreSQL — RLS e integridade", () => {
  it("usuário A só lê suas três contas", async () => {
    const q = await db.query<{ id: string }>(`select id from accounts`);
    expect(q.rows).toHaveLength(3);
    expect(q.rows.some((r) => r.id === accB)).toBe(false);
  });
  it("não modifica nem exclui conta de B", async () => {
    expect(
      (
        await sql(
          `update accounts set name='Invadido' where id='${accB}' returning id`,
        )
      ).rows,
    ).toHaveLength(0);
    expect(
      (await sql(`delete from accounts where id='${accB}' returning id`)).rows,
    ).toHaveLength(0);
  });
  it("bloqueia falsificar dono e relação cruzada", async () => {
    await expect(
      sql(
        `insert into accounts(user_id,name,kind,opening_cents,opening_date) values('${userB}','Fraude','cash',0,'2026-01-01')`,
      ),
    ).rejects.toThrow();
    await expect(
      sql(
        `insert into contributions(user_id,goal_id,account_id,amount_cents,date) values('${userA}','${goal}','${accB}',100,'2026-01-02')`,
      ),
    ).rejects.toThrow();
  });
  it("anon não pode ler nem escrever", async () => {
    await db.exec("set role anon");
    await expect(sql("select * from accounts")).rejects.toThrow();
    await expect(
      sql(`select generate_recurrences('2026-01-01','2026-02-01')`),
    ).rejects.toThrow();
    await asUser(userA);
  });
  it("reserva existente impede duplicação e descapitalização", async () => {
    await sql(
      `insert into contributions(user_id,goal_id,account_id,amount_cents,date) values('${userA}','${goal}','${accA}',40000,'2026-01-02')`,
    );
    await expect(
      sql(
        `insert into contributions(user_id,goal_id,account_id,amount_cents,date) values('${userA}','${goal}','${accA}',20000,'2026-01-02')`,
      ),
    ).rejects.toThrow(/excedem/);
    await expect(
      sql(
        `insert into transactions(user_id,kind,description,amount_cents,date,source_account_id) values('${userA}','expense','Gasto',70000,'2026-01-03','${accA}')`,
      ),
    ).rejects.toThrow(/reservas/);
    expect((await sql("select * from transactions")).rows).toHaveLength(0);
  });
  it("duas metas não podem reservar o mesmo recurso", async () => {
    const second = "99999999-9999-4999-8999-999999999999";
    await sql(
      `insert into goals(id,user_id,name,target_cents,target_date) values('${second}','${userA}','Outra meta',200000,'2027-01-01')`,
    );
    await expect(
      sql(
        `insert into contributions(user_id,goal_id,account_id,amount_cents,date) values('${userA}','${second}','${accA}',70000,'2026-01-03')`,
      ),
    ).rejects.toThrow(/reservas/);
    await sql(`delete from goals where id='${second}'`);
  });
  it("transferência é atômica, rendimento só em investimento", async () => {
    await sql(
      `insert into transactions(user_id,kind,description,amount_cents,date,source_account_id,target_account_id) values('${userA}','transfer','Aplicar',30000,'2026-01-04','${accA}','${investment}')`,
    );
    await expect(
      sql(
        `insert into transactions(user_id,kind,description,amount_cents,date,target_account_id) values('${userA}','yield','Juro errado',100,'2026-01-05','${accA}')`,
      ),
    ).rejects.toThrow(/investimento/);
    await sql(
      `insert into transactions(user_id,kind,description,amount_cents,date,target_account_id) values('${userA}','yield','Juro',100,'2026-01-05','${investment}')`,
    );
  });
  it("benefício não pode virar verba livre ou reserva", async () => {
    await expect(
      sql(
        `insert into transactions(user_id,kind,description,amount_cents,date,source_account_id,target_account_id) values('${userA}','transfer','VA para banco',100,'2026-01-05','${benefit}','${accA}')`,
      ),
    ).rejects.toThrow(/Benefícios/);
    await expect(
      sql(
        `insert into contributions(user_id,goal_id,account_id,amount_cents,date) values('${userA}','${goal}','${benefit}',100,'2026-01-05')`,
      ),
    ).rejects.toThrow(/recurso livre/);
  });
  it("protege datas, salário líquido e patrimônio de meta", async () => {
    await expect(
      sql(
        `insert into transactions(user_id,kind,description,amount_cents,date,target_account_id) values('${userA}','income','Futuro',100,'2099-01-01','${accA}')`,
      ),
    ).rejects.toThrow(/futuro/);
    await expect(
      sql(
        `insert into transactions(user_id,kind,description,amount_cents,date,target_account_id,gross_cents,deductions_cents) values('${userA}','income','Salário',100,'2026-01-05','${accA}',200,50)`,
      ),
    ).rejects.toThrow();
    await expect(
      sql(`update goals set target_cents=100 where id='${goal}'`),
    ).rejects.toThrow(/excedem/);
    await expect(
      sql(`delete from accounts where id='${accA}'`),
    ).rejects.toThrow();
  });
  it("alterar saldo inicial ou lançar perda não pode quebrar a cobertura", async () => {
    await expect(
      sql(`update accounts set opening_cents=60000 where id='${accA}'`),
    ).rejects.toThrow(/reservas/);
    await expect(
      sql(
        `insert into transactions(user_id,kind,description,amount_cents,date,target_account_id) values('${userA}','yield','Perda excessiva',-40000,'2026-01-05','${investment}')`,
      ),
    ).rejects.toThrow(/saldo suficiente/);
  });
  it("gera dia 31 ancorado, reexecução é idempotente e cancelamento não ressuscita", async () => {
    await sql(
      `insert into recurrences(id,user_id,kind,description,amount_cents,target_account_id,frequency,start_date) values('${recurrence}','${userA}','income','Salário recorrente',1000,'${accA}','monthly','2026-01-31')`,
    );
    expect(
      (
        await db.query<{ n: number }>(
          `select generate_recurrences('2026-01-01','2026-03-31') n`,
        )
      ).rows[0].n,
    ).toBe(3);
    expect(
      (
        await db.query<{ n: number }>(
          `select generate_recurrences('2026-01-01','2026-03-31') n`,
        )
      ).rows[0].n,
    ).toBe(0);
    const dates = await db.query<{ date: string }>(
      `select date::text from transactions where recurrence_id='${recurrence}' order by date`,
    );
    expect(dates.rows.map((r) => r.date)).toEqual([
      "2026-01-31",
      "2026-02-28",
      "2026-03-31",
    ]);
    await sql(
      `update transactions set status='cancelled' where recurrence_id='${recurrence}' and date='2026-02-28'`,
    );
    expect(
      (
        await db.query<{ n: number }>(
          `select generate_recurrences('2026-01-01','2026-03-31') n`,
        )
      ).rows[0].n,
    ).toBe(0);
    await expect(
      sql(`select generate_recurrences('2026-01-01','2028-01-01')`),
    ).rejects.toThrow();
  });
  it("excluir regra conserva histórico", async () => {
    await sql(`select delete_recurrence('${recurrence}')`);
    expect((await sql(`select * from recurrences`)).rows).toHaveLength(0);
    expect(
      (
        await sql(
          `select * from transactions where description='Salário recorrente'`,
        )
      ).rows,
    ).toHaveLength(3);
  });
  it("usuário B permanece isolado", async () => {
    await asUser(userB);
    expect((await sql("select * from accounts")).rows).toHaveLength(1);
    expect((await sql("select * from transactions")).rows).toHaveLength(0);
    expect((await sql("select * from goals")).rows).toHaveLength(0);
    expect((await sql("select * from contributions")).rows).toHaveLength(0);
    await asUser(userA);
  });
});
