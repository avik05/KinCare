// One stroke icon set: 24px grid, 1.75 stroke, round caps. Drawn for KinCare.
const S = { fill: 'none', stroke: 'currentColor', strokeWidth: 1.75, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };

const P: Record<string, JSX.Element> = {
  home: <g {...S}><path d="M4 10.2 12 4l8 6.2V19a1 1 0 0 1-1 1h-4.5v-5.5h-5V20H5a1 1 0 0 1-1-1z" /></g>,
  cal: <g {...S}><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></g>,
  tl: <g {...S}><circle cx="6" cy="6" r="2" /><circle cx="6" cy="18" r="2" /><path d="M6 8v8M11 6h9M11 18h9M11 12h6" /></g>,
  user: <g {...S}><circle cx="12" cy="8.5" r="3.8" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" /></g>,
  back: <g {...S} strokeWidth={2}><path d="M15 5l-7 7 7 7" /></g>,
  chev: <g {...S} strokeWidth={2}><path d="M9.5 6l6 6-6 6" /></g>,
  down: <g {...S} strokeWidth={2}><path d="M6 9.5l6 6 6-6" /></g>,
  updown: <g {...S}><path d="M8 9.5l4-4 4 4M8 14.5l4 4 4-4" /></g>,
  check: <g {...S} strokeWidth={2.4}><path d="M5 12.5l4.5 4.5L19 7.5" /></g>,
  x: <g {...S} strokeWidth={2}><path d="M6.5 6.5l11 11M17.5 6.5l-11 11" /></g>,
  pin: <g {...S}><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.4" /></g>,
  pinfill: <><path d="M12 22s-7-6-7-11.8a7 7 0 0 1 14 0C19 16 12 22 12 22z" fill="currentColor" /><circle cx="12" cy="10" r="2.8" fill="#fff" /></>,
  cam: <g {...S}><path d="M4 8h3l1.6-2.5h6.8L17 8h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></g>,
  bell: <g {...S}><path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 20.5a2.2 2.2 0 0 0 4 0" /></g>,
  warn: <g {...S} strokeWidth={1.9}><path d="M10.3 4.6 2.9 17.5a2 2 0 0 0 1.7 3h14.8a2 2 0 0 0 1.7-3L13.7 4.6a2 2 0 0 0-3.4 0z" /><path d="M12 10v4M12 17.3v.1" /></g>,
  info: <g {...S}><circle cx="12" cy="12" r="8.5" /><path d="M12 11v5M12 8v.1" /></g>,
  clock: <g {...S}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></g>,
  star: <path d="m12 3.6 2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 17l-5.2 2.7 1-5.8-4.3-4.1 5.9-.8z" fill="currentColor" />,
  phone: <g {...S}><path d="M6.6 3.5h2.6l1.4 4-2 1.3a11 11 0 0 0 6.6 6.6l1.3-2 4 1.4v2.6a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2z" /></g>,
  pill: <g {...S}><rect x="3.2" y="8.5" width="17.6" height="7" rx="3.5" transform="rotate(-40 12 12)" /><path d="m9.3 9.4 5.3 5.3" /></g>,
  bowl: <g {...S}><path d="M3.5 11.5h17a8.5 8.5 0 0 1-17 0z" /><path d="M9 7.5c0-1.2 1-1.2 1-2.5M13.5 7.5c0-1.2 1-1.2 1-2.5" /></g>,
  walk: <g {...S}><circle cx="13" cy="4.5" r="1.8" /><path d="m10 21 2-6.5 3 3V21M8 11l3-3.5 3 2 2.5 2.5M12 14.5l-1-4" /></g>,
  heart: <g {...S}><path d="M12 20s-7.5-4.4-7.5-10A4.4 4.4 0 0 1 12 7.4 4.4 4.4 0 0 1 19.5 10c0 5.6-7.5 10-7.5 10z" /></g>,
  pulse: <g {...S}><path d="M3 12h4l2-5 4 10 2-5h6" /></g>,
  users: <g {...S}><circle cx="9" cy="8.5" r="3.2" /><path d="M3.5 19.5a5.5 5.5 0 0 1 11 0" /><circle cx="17" cy="9.5" r="2.5" /><path d="M16 14.2a4.5 4.5 0 0 1 5 4.3" /></g>,
  plus: <g {...S} strokeWidth={2}><path d="M12 5v14M5 12h14" /></g>,
  minus: <g {...S} strokeWidth={2}><path d="M5 12h14" /></g>,
  chart: <g {...S}><path d="M4 20h16" /><path d="M7 16v-4M12 16V7M17 16v-7" /></g>,
  lock: <g {...S}><rect x="5" y="10.5" width="14" height="10" rx="2" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" /></g>,
  gear: <g {...S}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.6 1.6 0 0 0-1-1.5 1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.6 1.6 0 0 0 1.5-1 1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" /></g>,
  trash: <g {...S}><path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v5M14 11v5" /></g>,
  download: <g {...S}><path d="M12 4v11M7 10.5l5 5 5-5M5 20h14" /></g>,
  escal: <g {...S}><path d="M5 20V9l7-5 7 5v11" /><path d="M12 16v-6M9 12.5l3-3 3 3" /></g>,
  logout: <g {...S}><path d="M14 4h4a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-4" /><path d="M10 16l-4-4 4-4M6 12h9" /></g>,
  shield: <g {...S}><path d="M12 3.5 19 6v5.5c0 4.4-3 7.7-7 9-4-1.3-7-4.6-7-9V6z" /><path d="m8.8 12 2.2 2.2 4.2-4.4" /></g>,
  search: <g {...S}><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></g>,
  map: <g {...S}><path d="M9 4 3.5 6v14L9 18l6 2 5.5-2V4L15 6z" /><path d="M9 4v14M15 6v14" /></g>,
  ext: <g {...S}><path d="M14 4h6v6M20 4l-8.5 8.5M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></g>,
  receipt: <g {...S}><path d="M6 3.5h12v17l-2.5-1.5-2 1.5-1.5-1.5-1.5 1.5-2-1.5L6 20.5z" /><path d="M9 8h6M9 11.5h6M9 15h3" /></g>,
  refresh: <g {...S}><path d="M19.5 12a7.5 7.5 0 0 1-13.2 4.9M4.5 12a7.5 7.5 0 0 1 13.2-4.9" /><path d="M18 3.5v4h-4M6 20.5v-4h4" /></g>,
  door: <g {...S}><path d="M6 20.5V4.5a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v16M4 20.5h16" /><circle cx="14.5" cy="12.5" r=".8" fill="currentColor" /></g>,
  menu: <g {...S}><path d="M4 7h16M4 12h16M4 17h16" /></g>,
};

export default function Icon({ name, size, className }: { name: string; size?: 'sm'; className?: string }) {
  return <svg className={className ?? (size === 'sm' ? 'ic-sm' : 'ic')} viewBox="0 0 24 24" aria-hidden="true" focusable="false">{P[name] ?? P.info}</svg>;
}

export function taskIcon(task: string) {
  const t = task.toLowerCase();
  if (t.includes('medic') || t.includes('tablet')) return 'pill';
  if (t.includes('walk') || t.includes('exercise')) return 'walk';
  if (t.includes('breakfast') || t.includes('lunch') || t.includes('dinner') || t.includes('meal')) return 'bowl';
  if (t.includes('bp') || t.includes('sugar') || t.includes('reading')) return 'pulse';
  return 'check';
}
