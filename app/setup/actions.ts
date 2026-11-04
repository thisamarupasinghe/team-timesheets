"use server";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { logChange } from "@/lib/audit";
import { sql } from "@/lib/db";
import { schemaSql, seedSql } from "@/lib/setup-sql";

export async function runSetup() {
  const u = await requireAdmin();
  let msg = "ok";
  try {
    await sql.unsafe(schemaSql);
    const [{ n }] = await sql<{ n: number }[]>`select count(*)::int as n from employees`;
    if (n === 0) await sql.unsafe(seedSql); // only on a brand new database, so deleted people don't come back
  } catch (e: any) {
    msg = "err:" + String(e?.message || e).slice(0, 160);
  }
  await logChange(u.email, "Ran database setup", msg === "ok" ? "Tables and roster ready" : msg);
  redirect(`/setup?r=${encodeURIComponent(msg)}`);
}
