// Everything is shown in India time, wherever the family lives.
const TZ = 'Asia/Kolkata';

export const inr = (n: number | string) => '₹' + Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 });

export function time(ts: string | Date | null | undefined) {
  if (!ts) return '';
  return new Intl.DateTimeFormat('en-IN', { timeZone: TZ, hour: 'numeric', minute: '2-digit', hour12: true })
    .format(new Date(ts)).replace(' ', ' ').toLowerCase();
}

export function dayLabel(d: string | Date) {
  const date = typeof d === 'string' && d.length === 10 ? new Date(d + 'T12:00:00+05:30') : new Date(d);
  return new Intl.DateTimeFormat('en-IN', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long' }).format(date);
}

export function shortDate(d: string | Date) {
  const date = typeof d === 'string' && d.length === 10 ? new Date(d + 'T12:00:00+05:30') : new Date(d);
  return new Intl.DateTimeFormat('en-IN', { timeZone: TZ, day: 'numeric', month: 'short' }).format(date);
}

/** Today's date in India as YYYY-MM-DD. */
export function todayIST(offsetDays = 0) {
  const d = new Date(Date.now() + offsetDays * 86400000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

export function istDateOf(ts: string) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ts));
}

export function greeting() {
  const h = Number(new Intl.DateTimeFormat('en-IN', { timeZone: TZ, hour: 'numeric', hour12: false }).format(new Date()));
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

export function minutesLeft(ts: string) {
  const m = Math.round((new Date(ts).getTime() - Date.now()) / 60000);
  if (m <= 0) return 'Overdue';
  const h = Math.floor(m / 60);
  return h ? `${h} h ${m % 60} m left` : `${m} m left`;
}

export function initials(name = '') {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
}

export const firstName = (name = '') => name.split(/\s+/)[0] || name;

const asDate = (d: string | Date) => (typeof d === 'string' && d.length === 10 ? new Date(d + 'T12:00:00+05:30') : new Date(d));

/** "Mon", "Tue" in India time. */
export const weekday = (d: string | Date) => new Intl.DateTimeFormat('en-IN', { timeZone: TZ, weekday: 'short' }).format(asDate(d));
/** Day of the month, 1 to 31, in India time. */
export const dayNum = (d: string | Date) => new Intl.DateTimeFormat('en-IN', { timeZone: TZ, day: 'numeric' }).format(asDate(d));
/** "Nov" in India time. */
export const monthShort = (d: string | Date) => new Intl.DateTimeFormat('en-IN', { timeZone: TZ, month: 'short' }).format(asDate(d));

/** "Today", "Tomorrow", "Yesterday" or "Friday 6 November". */
export function relDay(d: string) {
  if (d === todayIST()) return 'Today';
  if (d === todayIST(1)) return 'Tomorrow';
  if (d === todayIST(-1)) return 'Yesterday';
  return dayLabel(d).replace(',', '');
}

/** Adds days to a YYYY-MM-DD date. */
export const addDays = (d: string, n: number) => new Date(Date.parse(d + 'T12:00:00+05:30') + n * 864e5).toISOString().slice(0, 10);

/** Minutes since a timestamp, as "4 min ago" or "2 h 10 min ago". */
export function ago(ts: string) {
  const m = Math.max(0, Math.round((Date.now() - new Date(ts).getTime()) / 60000));
  if (m < 1) return 'just now';
  if (m < 60) return `${m} min ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h} h ${m % 60 ? `${m % 60} min ` : ''}ago` : `${Math.floor(h / 24)} d ago`;
}

/** Display name for a parent: what the family calls them, with the full name. */
export const parentLabel = (p: { name?: string; relation?: string } | null | undefined) =>
  !p ? '' : p.relation && p.relation !== 'Parent' ? p.relation : p.name ?? '';

export const years = (n: number) => `${n} ${Number(n) === 1 ? 'year' : 'years'}`;
