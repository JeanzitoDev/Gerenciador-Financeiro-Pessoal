/** Optional remote gate. Requires two existing, confirmed TEST accounts. No service_role, signup or email sends. */
import { createClient } from "@supabase/supabase-js";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
const required = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "TEST_EMAIL_A",
  "TEST_PASSWORD_A",
  "TEST_EMAIL_B",
  "TEST_PASSWORD_B",
];
for (const key of required)
  if (!process.env[key]) throw new Error(`Variável ausente: ${key}`);
const options = { auth: { persistSession: false, autoRefreshToken: false } };
const make = () =>
  createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    options,
  );
const a = make(),
  b = make(),
  anon = make();
const accountA = randomUUID(),
  accountB = randomUUID(),
  goalA = randomUUID(),
  crossId = randomUUID(),
  overId = randomUUID();
let userA, userB;
async function ok(promise) {
  const result = await promise;
  if (result.error)
    throw new Error(
      `Operação de teste falhou (${result.error.code ?? "Auth"}).`,
    );
  return result.data;
}
try {
  const authA = await ok(
    a.auth.signInWithPassword({
      email: process.env.TEST_EMAIL_A,
      password: process.env.TEST_PASSWORD_A,
    }),
  );
  const authB = await ok(
    b.auth.signInWithPassword({
      email: process.env.TEST_EMAIL_B,
      password: process.env.TEST_PASSWORD_B,
    }),
  );
  userA = authA.user.id;
  userB = authB.user.id;
  assert.notEqual(userA, userB, "Use duas contas de teste distintas.");
  const prefix = `[smoke ${Date.now()}]`;
  const date = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  await ok(
    a
      .from("accounts")
      .insert({
        id: accountA,
        user_id: userA,
        name: `${prefix} A`,
        kind: "checking",
        opening_cents: 10000,
        opening_date: date,
      }),
  );
  await ok(
    b
      .from("accounts")
      .insert({
        id: accountB,
        user_id: userB,
        name: `${prefix} B`,
        kind: "checking",
        opening_cents: 10000,
        opening_date: date,
      }),
  );
  await ok(
    a
      .from("goals")
      .insert({
        id: goalA,
        user_id: userA,
        name: `${prefix} meta`,
        target_cents: 20000,
        target_date: date,
      }),
  );
  assert.equal(
    (await ok(a.from("accounts").select("id").eq("id", accountB))).length,
    0,
    "RLS de leitura falhou.",
  );
  assert.equal(
    (
      await ok(
        a
          .from("accounts")
          .update({ name: "FORBIDDEN" })
          .eq("id", accountB)
          .select("id"),
      )
    ).length,
    0,
    "RLS de alteração falhou.",
  );
  const cross = await a
    .from("contributions")
    .insert({
      id: crossId,
      user_id: userA,
      goal_id: goalA,
      account_id: accountB,
      amount_cents: 100,
      date,
    });
  assert.ok(cross.error, "FK cruzada deve falhar.");
  const over = await a
    .from("contributions")
    .insert({
      id: overId,
      user_id: userA,
      goal_id: goalA,
      account_id: accountA,
      amount_cents: 15000,
      date,
    });
  assert.ok(over.error, "Reserva sem saldo deve falhar.");
  const anonymous = await anon.from("accounts").select("id");
  assert.ok(anonymous.error, "Anon não deve possuir SELECT.");
  console.log(
    "PASS: Auth de duas contas, isolamento de leitura/alteração, FK cruzada, reserva sem saldo e anon.",
  );
} finally {
  const cleanup = [];
  if (userA) {
    cleanup.push([
      "aportes temporários",
      a
        .from("contributions")
        .delete()
        .in("id", [crossId, overId])
        .eq("user_id", userA),
    ]);
    cleanup.push([
      "meta temporária",
      a.from("goals").delete().eq("id", goalA).eq("user_id", userA),
    ]);
    cleanup.push([
      "conta temporária A",
      a.from("accounts").delete().eq("id", accountA).eq("user_id", userA),
    ]);
  }
  if (userB)
    cleanup.push([
      "conta temporária B",
      b.from("accounts").delete().eq("id", accountB).eq("user_id", userB),
    ]);
  let failed = false;
  for (const [label, promise] of cleanup) {
    const result = await promise;
    if (result.error) {
      failed = true;
      console.error(
        `Não foi possível limpar ${label}. IDs temporários: ${accountA}, ${accountB}, ${goalA}`,
      );
    }
  }
  await a.auth.signOut({ scope: "local" });
  await b.auth.signOut({ scope: "local" });
  if (failed) process.exitCode = 1;
}
