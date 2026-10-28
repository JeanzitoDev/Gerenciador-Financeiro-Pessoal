import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import { beforeAll, afterAll, describe, it, expect } from "vitest";
const A = "11111111-1111-4111-8111-111111111111",
  B = "22222222-2222-4222-8222-222222222222";
const bank = "11111111-1111-4111-8111-111111111110",
  moving = "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
  reserve = "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  phone = "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  foreign = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";
let db: PGlite;
async function user(id: string) {
  await db.exec(
    `set role authenticated;select set_config('request.jwt.claim.sub','${id}',false)`,
  );
}
async function rows<T = Record<string, unknown>>(sql: string) {
  return (await db.query<T>(sql)).rows;
}
const deps = (id: string, conditions: unknown) =>
  `update goals set dependencies='${JSON.stringify(conditions)}'::jsonb where id='${id}'`;
beforeAll(async () => {
  db = new PGlite();
  await db.exec(
    `create role anon;create role authenticated;create role service_role;create schema auth;create table auth.users(id uuid primary key,raw_user_meta_data jsonb default '{}'::jsonb);create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;grant usage on schema public,auth to authenticated,anon;grant usage on schema public to service_role;grant execute on function auth.uid() to authenticated,anon;`,
  );
  for (const file of [
    "202610180001_initial.sql",
    "202610180002_phase2.sql",
    "202610190003_phase22.sql",
  ])
    await db.exec(readFileSync(`supabase/migrations/${file}`, "utf8"));
  await db.exec(`insert into auth.users(id) values('${A}'),('${B}')`);
  await user(A);
  await db.exec(
    `insert into accounts(id,user_id,name,kind,opening_cents,opening_date) values('${bank}','${A}','Banco','checking',1000000,'2020-01-01');insert into goals(id,user_id,name,target_cents,target_date) values('${moving}','${A}','Mudança',200000,'2027-01-01'),('${reserve}','${A}','Reserva',500000,'2027-01-01'),('${phone}','${A}','iPhone',100000,'2027-01-01')`,
  );
  await user(B);
  await db.exec(
    `insert into goals(id,user_id,name,target_cents,target_date) values('${foreign}','${B}','Outra pessoa',100000,'2027-01-01')`,
  );
  await db.exec("reset role");
  await db.exec(
    readFileSync("supabase/migrations/202610220004_phase23.sql", "utf8"),
  );
  await user(A);
});
afterAll(async () => {
  await db?.close();
});
describe.sequential("fase 2.3 — integridade e migração", () => {
  it("preserva saldos e mostra tutorial somente para quem ainda começa", async () => {
    expect(await rows("select opening_cents from accounts")).toEqual([
      { opening_cents: 1000000 },
    ]);
    expect(await rows("select onboarding_step from profiles")).toEqual([
      { onboarding_step: 4 },
    ]);
    await user(B);
    expect(await rows("select onboarding_step from profiles")).toEqual([
      { onboarding_step: 0 },
    ]);
    await db.exec("update profiles set onboarding_step=2");
    await user(A);
    expect(await rows("select onboarding_step from profiles")).toEqual([
      { onboarding_step: 4 },
    ]);
  });
  it("2.3.1 oferece o guia às contas antigas e preserva progresso e conclusão real", async () => {
    const migration = readFileSync(
      "supabase/migrations/202610220005_phase231.sql",
      "utf8",
    );
    await db.exec("reset role");
    await db.exec(migration);
    await user(A);
    expect(
      await rows(
        "select onboarding_step,onboarding_completed_at from profiles",
      ),
    ).toEqual([{ onboarding_step: 0, onboarding_completed_at: null }]);
    await user(B);
    expect(await rows("select onboarding_step from profiles")).toEqual([
      { onboarding_step: 2 },
    ]);
    await db.exec(
      "update profiles set onboarding_step=4,onboarding_completed_at=now()",
    );
    await db.exec("reset role");
    await db.exec(migration);
    await user(B);
    expect(
      (
        await rows<{
          onboarding_step: number;
          onboarding_completed_at: unknown;
        }>("select onboarding_step,onboarding_completed_at from profiles")
      )[0],
    ).toEqual({
      onboarding_step: 4,
      onboarding_completed_at: expect.anything(),
    });
    await user(A);
    expect(await rows("select user_id from profiles")).toEqual([
      { user_id: A },
    ]);
  });
  it("guarda várias condições e normaliza o UUID para proteger a exclusão", async () => {
    await db.exec(
      deps(phone, [
        { goal_id: moving.toUpperCase(), minimum_cents: null },
        { goal_id: reserve, minimum_cents: 300000 },
      ]),
    );
    const saved = await rows<{ dependencies: unknown }>(
      `select dependencies from goals where id='${phone}'`,
    );
    expect(saved[0].dependencies).toEqual([
      { goal_id: moving, minimum_cents: null },
      { goal_id: reserve, minimum_cents: 300000 },
    ]);
    await expect(
      db.exec(`delete from goals where id='${moving}'`),
    ).rejects.toThrow(/condições/);
  });
  it("recusa relações entre usuários, ciclos e formas inválidas mesmo em escrita direta", async () => {
    await expect(
      db.exec(deps(moving, [{ goal_id: foreign, minimum_cents: null }])),
    ).rejects.toThrow(/sua conta/);
    await expect(
      db.exec(deps(moving, [{ goal_id: phone, minimum_cents: null }])),
    ).rejects.toThrow(/ciclo/);
    await expect(
      db.exec(deps(moving, [{ goal_id: moving, minimum_cents: null }])),
    ).rejects.toThrow();
    for (const value of [
      {},
      [{ goal_id: reserve, minimum_cents: "100" }],
      [{ goal_id: reserve, minimum_cents: -1 }],
      [{ goal_id: reserve, minimum_cents: 1.5 }],
      [{ goal_id: reserve, minimum_cents: 999999999999 }],
      [{ goal_id: reserve }],
    ])
      await expect(db.exec(deps(moving, value))).rejects.toThrow();
    await expect(
      db.exec(`update goals set target_cents=100000 where id='${reserve}'`),
    ).rejects.toThrow(/Outra meta/);
  });
  it("permite aportes manuais enquanto a prioridade aguarda e conclusão não apaga o dinheiro", async () => {
    await db.exec(
      `insert into contributions(user_id,goal_id,account_id,amount_cents,date) values('${A}','${phone}','${bank}',10000,(now() at time zone 'America/Sao_Paulo')::date);update goals set completed=true where id='${moving}'`,
    );
    expect(
      await rows("select sum(amount_cents)::integer total from contributions"),
    ).toEqual([{ total: 10000 }]);
  });
  it("exclui só a configuração antiga ao remover uma conta guardada sem movimentos", async () => {
    const saved = "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee";
    await db.exec(
      `insert into accounts(id,user_id,name,kind,opening_cents,opening_date) values('${saved}','${A}','Guardado','investment',1000,'2020-01-01');insert into investments(user_id,account_id,name) values('${A}','${saved}','Configuração antiga');delete from accounts where id='${saved}'`,
    );
    expect(
      await rows(`select id from investments where account_id='${saved}'`),
    ).toHaveLength(0);
    expect(
      await rows(`select opening_cents from accounts where id='${bank}'`),
    ).toEqual([{ opening_cents: 1000000 }]);
  });
  it("apagar usuário com grafo continua atômico e preserva a outra conta", async () => {
    await expect(
      db.exec(`select delete_account_completely('${A}')`),
    ).rejects.toThrow();
    await db.exec(
      `reset role;set role service_role;select delete_account_completely('${A}')`,
    );
    await user(B);
    expect(await rows("select id from goals")).toEqual([{ id: foreign }]);
    await db.exec("reset role");
    expect(
      await rows(`select id from auth.users where id='${A}'`),
    ).toHaveLength(0);
    expect(
      await rows(`select id from goals where user_id='${A}'`),
    ).toHaveLength(0);
  });
});
