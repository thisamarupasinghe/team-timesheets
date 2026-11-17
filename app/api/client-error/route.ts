import { NextResponse } from "next/server";
import { getUser } from "@/lib/auth";
import { acceptBrowserError, cleanPath, getErrors, isBrowserNoise, recordError, scrub } from "@/lib/errors";

export const dynamic = "force-dynamic";

/** A crash inside someone's browser (sent by ErrorReporter). Signed-in people only, from this site only, small bodies only. */
export async function POST(req: Request) {
  const dryRun = process.env.ERROR_ALERTS_DRY_RUN === "1";
  if (!dryRun && process.env.VERCEL_ENV !== "production") return new NextResponse(null, { status: 204 });
  const origin = req.headers.get("origin");
  if (!origin || new URL(origin).host !== new URL(req.url).host) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  if (Number(req.headers.get("content-length") || 0) > 4096) return NextResponse.json({ error: "Too large" }, { status: 413 });
  if (!(await getUser().catch(() => null))) return NextResponse.json({ error: "Not signed in" }, { status: 401 });

  const raw = (await req.text().catch(() => "")).slice(0, 4096);
  let b: { message?: unknown; path?: unknown; source?: unknown } = {};
  try { b = JSON.parse(raw); } catch { return NextResponse.json({ error: "Bad request" }, { status: 400 }); }
  const message = scrub(String(b.message || ""));
  if (!message || isBrowserNoise(message, String(b.source || ""))) return new NextResponse(null, { status: 204 });

  const e = { at: Date.now(), path: cleanPath(String(b.path || "/")), kind: "browser", message };
  if (dryRun) { console.log("[site-error]", JSON.stringify(e)); return new NextResponse(null, { status: 204 }); }
  if (acceptBrowserError(await getErrors().catch(() => []), e)) await recordError(e);
  return new NextResponse(null, { status: 204 });
}
