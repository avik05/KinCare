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
