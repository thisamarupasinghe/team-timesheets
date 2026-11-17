/**
 * Messages for the ?ok= / ?err= codes that server actions redirect with.
 * Keys are "<path>:<kind>:<code>" with a "<kind>:<code>" fallback.
 * null = the page shows its own, richer callout, so no toast.
 */
export type FlashTone = "success" | "danger" | "warning" | "info";
type Msg = { text: string; tone: FlashTone } | null;

const ok = (text: string): Msg => ({ text, tone: "success" });
const err = (text: string): Msg => ({ text, tone: "danger" });

const FLASH: Record<string, Msg> = {
  // People
  "/admin:ok:added": ok("Person added to the roster."),
  "/admin:ok:saved": ok("Changes saved."),
  "/admin:ok:roster": null,
  "/admin:err:name": err("Add a name first."),
  "/admin:err:exists": err("Someone with that name is already on the roster."),
  // Settings
  "/settings:ok:settings": ok("Settings saved."),
  "/settings:ok:expiry": ok("Token expiry date saved."),
  "/settings:err:expiry": err("Pick a valid date for when the Jira token expires."),
  "/settings:ok:holiday": ok("Public holidays updated."),
  "/settings:ok:emails": null,
  "/settings:ok:roster": null,
  "/settings:err:settings": err("Check the settings: hours 1–12, a valid date and a sprint number."),
  "/settings:err:holiday": err("Add a date and a name for the holiday."),
  // Recycle bin
  "/bin:ok:restored": ok("Restored."),
  "/bin:err:gone": err("That item was already restored."),
  "/bin:err:exists": err("Someone with that name is already on the roster."),
  "/bin:err:noperson": err("Restore the person first, then their leave."),
  "/bin:err:admin": err("Only the admin can restore a public holiday."),
  // Activity
  "/activity:ok:restored": ok("Person restored."),
  "/activity:ok:email": ok("Work email linked."),
  "/activity:err:restore": err("That entry has no saved copy to restore."),
  "/activity:err:exists": err("Someone with that name is already on the roster."),
  "/activity:err:link": err("Choose a person to link."),
  // Person (leave)
  "/person:ok:leave": ok("Leave saved."),
  "/person:ok:leave-removed": ok("Leave removed. You can put it back from the Recycle bin."),
  // Fallbacks
  "ok:linked": ok("Jira account linked."),
  "ok:saved": ok("Saved."),
  "err:link": err("Choose a person to link."),
};

export function flashFor(path: string, kind: "ok" | "err", code: string): Msg | undefined {
  const k = `${path}:${kind}:${code}`;
  if (k in FLASH) return FLASH[k];
  const f = `${kind}:${code}`;
  if (f in FLASH) return FLASH[f];
  return undefined;
}

/** Params that only exist to carry a flash message and are removed from the address bar afterwards. */
export const FLASH_PARAMS = ["ok", "err", "m", "s", "u", "a", "r"];
