import postgres from "postgres";

declare global {
  // eslint-disable-next-line no-var
  var __sql: ReturnType<typeof postgres> | undefined;
}

export const sql =
  global.__sql ??
  postgres(process.env.DATABASE_URL || "postgres://localhost/timesheets", {
    max: 5,
    idle_timeout: 20,
    onnotice: () => {},
    types: { bigint: postgres.BigInt },
  });
if (process.env.NODE_ENV !== "production") global.__sql = sql;

export const TZ = process.env.APP_TIMEZONE || "UTC";
