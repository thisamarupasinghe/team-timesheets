/** Words of a person's name, lower case, e.g. "Alex Morgan" -> ["alex","morgan"] */
export const nameWords = (n: string) => n.toLowerCase().split(/[^a-z]+/).filter((w) => w.length > 1);

/** Words in the part before the @ of an email, e.g. "alex.morgan@x.com" -> ["alex","morgan"] */
export const emailWords = (e: string) => e.toLowerCase().split("@")[0].split(/[^a-z]+/).filter((w) => w.length > 1);

/** The one person whose name fits the email, or null when none or several fit */
export function bestMatch<T extends { name: string }>(email: string, people: T[]): T | null {
  const ew = emailWords(email);
  if (!ew.length) return null;
  const fit = people.filter((p) => {
    const nw = nameWords(p.name);
    return ew.every((w) => nw.some((n) => n === w || n.startsWith(w) || w.startsWith(n)));
  });
  return fit.length === 1 ? fit[0] : null;
}
