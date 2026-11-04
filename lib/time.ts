import { TZ } from "./db";

const DAY = 86400000;
export const toMs = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10));
export const fromMs = (ms: number) => new Date(ms).toISOString().slice(0, 10);
export const addDays = (s: string, n: number) => fromMs(toMs(s) + n * DAY);
export const dow = (s: string) => new Date(toMs(s)).getUTCDay();
export const isWeekend = (s: string) => [0, 6].includes(dow(s));
export const isDate = (s: unknown): s is string => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
export function daysBetween(a: string, b: string) {
  const out: string[] = [];
  for (let d = a; d <= b; d = addDays(d, 1)) out.push(d);
  return out;
}
export function today(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const WD = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
export const fmtD = (s: string) => `${+s.slice(8, 10)} ${MON[+s.slice(5, 7) - 1]}`;
export const fmtDY = (s: string) => `${fmtD(s)} ${s.slice(0, 4)}`;

export type Settings = {
  hours_per_day: number;
  sprint_anchor: string;
  sprint_anchor_number: number;
  holidays: { date: string; name: string }[];
};

export type Period = { mode: string; start: string; end: string; label: string; prev: string; next: string; query: string };

export function resolvePeriod(sp: Record<string, string | undefined>, s: Settings): Period {
  const mode = ["week", "month", "custom", "sprint"].includes(sp.mode || "") ? sp.mode! : "sprint";
  const t = today();
  if (mode === "week") {
    const base = isDate(sp.d) ? sp.d : t;
    const start = addDays(base, -((dow(base) + 6) % 7));
    const end = addDays(start, 6);
    return { mode, start, end, label: `Week of ${fmtDY(start)}`, prev: `?mode=week&d=${addDays(start, -7)}`, next: `?mode=week&d=${addDays(start, 7)}`, query: `mode=week&d=${start}` };
  }
  if (mode === "month") {
    const m = /^\d{4}-\d{2}$/.test(sp.m || "") ? sp.m! : t.slice(0, 7);
    const [y, mo] = m.split("-").map(Number);
    const start = `${m}-01`;
    const end = fromMs(Date.UTC(y, mo, 0));
    const pm = new Date(Date.UTC(y, mo - 2, 1)).toISOString().slice(0, 7);
    const nm = new Date(Date.UTC(y, mo, 1)).toISOString().slice(0, 7);
    return { mode, start, end, label: `${MONTHS[mo - 1]} ${y}`, prev: `?mode=month&m=${pm}`, next: `?mode=month&m=${nm}`, query: `mode=month&m=${m}` };
  }
  if (mode === "custom" && isDate(sp.from) && isDate(sp.to)) {
    const start = sp.from, end = sp.to < sp.from ? sp.from : sp.to;
    const len = Math.round((toMs(end) - toMs(start)) / DAY) + 1;
    return { mode, start, end, label: `${fmtD(start)} – ${fmtDY(end)}`, prev: `?mode=custom&from=${addDays(start, -len)}&to=${addDays(end, -len)}`, next: `?mode=custom&from=${addDays(start, len)}&to=${addDays(end, len)}`, query: `mode=custom&from=${start}&to=${end}` };
  }
  const cur = s.sprint_anchor_number + Math.floor((toMs(t) - toMs(s.sprint_anchor)) / DAY / 14);
  const n = Number(sp.n) || cur;
  const start = addDays(s.sprint_anchor, (n - s.sprint_anchor_number) * 14);
  const end = addDays(start, 13);
  return { mode: "sprint", start, end, label: `Sprint ${n} · ${fmtD(start)} – ${fmtDY(addDays(start, 11))}`, prev: `?mode=sprint&n=${n - 1}`, next: `?mode=sprint&n=${n + 1}`, query: `mode=sprint&n=${n}` };
}
