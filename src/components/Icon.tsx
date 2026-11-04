const P: Record<string, JSX.Element> = {
  home: <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />,
  cal: <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><rect x="3.5" y="5" width="17" height="15.5" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></g>,
  tl: <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="6" cy="6" r="2" /><circle cx="6" cy="18" r="2" /><path d="M6 8v8M11 6h9M11 18h9M11 12h6" /></g>,
  grid: <g fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="4" y="4" width="6.5" height="6.5" rx="1.8" /><rect x="13.5" y="4" width="6.5" height="6.5" rx="1.8" /><rect x="4" y="13.5" width="6.5" height="6.5" rx="1.8" /><rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.8" /></g>,
  back: <path d="M15 5l-7 7 7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
  chev: <path d="M9 5l7 7-7 7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
  check: <path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />,
  x: <path d="M6 6l12 12M18 6 6 18" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />,
  pin: <g fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.4" /></g>,
  pinfill: <><path d="M12 22s-7-6-7-11.8a7 7 0 0 1 14 0C19 16 12 22 12 22z" fill="currentColor" /><circle cx="12" cy="10" r="2.8" fill="#fff" /></>,
  cam: <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round"><path d="M4 8h3l1.6-2.5h6.8L17 8h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></g>,
  bell: <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 20.5a2.2 2.2 0 0 0 4 0" /></g>,
  warn: <g fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 4 2.8 19.5h18.4z" /><path d="M12 10v4.5M12 17.2v.1" /></g>,
  clock: <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></g>,
  star: <path d="m12 3.6 2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 17l-5.2 2.7 1-5.8-4.3-4.1 5.9-.8z" fill="currentColor" />,
  phone: <path d="M6.6 3.5h2.6l1.4 4-2 1.3a11 11 0 0 0 6.6 6.6l1.3-2 4 1.4v2.6a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.6 5.7a2 2 0 0 1 2-2.2z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />,
  pill: <g fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3.2" y="8.5" width="17.6" height="7" rx="3.5" transform="rotate(-40 12 12)" /><path d="m9.3 9.4 5.3 5.3" /></g>,
  bowl: <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M3.5 11.5h17a8.5 8.5 0 0 1-17 0z" /><path d="M9 7.5c0-1.2 1-1.2 1-2.5M13.5 7.5c0-1.2 1-1.2 1-2.5" /></g>,
  walk: <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><circle cx="13" cy="4.5" r="1.8" /><path d="m10 21 2-6.5 3 3V21M8 11l3-3.5 3 2 2.5 2.5M12 14.5l-1-4" /></g>,
  heart: <path d="M12 20s-7.5-4.4-7.5-10A4.4 4.4 0 0 1 12 7.4 4.4 4.4 0 0 1 19.5 10c0 5.6-7.5 10-7.5 10z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />,
  users: <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><circle cx="9" cy="8.5" r="3.2" /><path d="M3.5 19.5a5.5 5.5 0 0 1 11 0" /><circle cx="17" cy="9.5" r="2.5" /><path d="M16 14.2a4.5 4.5 0 0 1 5 4.3" /></g>,
  plus: <path d="M12 5v14M5 12h14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />,
  chart: <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4 20h16" /><path d="M7 16v-4M12 16V7M17 16v-7" /></g>,
  cart: <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M3 4h2.5l2 11h10.5l2-8H7" /><circle cx="9" cy="19" r="1.4" /><circle cx="17" cy="19" r="1.4" /></g>,
  lock: <g fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="5" y="10.5" width="14" height="10" rx="2" /><path d="M8.5 10.5V8a3.5 3.5 0 0 1 7 0v2.5" /></g>,
  gear: <g fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3" /><path d="M12 3v2.5M12 18.5V21M3 12h2.5M18.5 12H21M5.6 5.6l1.8 1.8M16.6 16.6l1.8 1.8M5.6 18.4l1.8-1.8M16.6 7.4l1.8-1.8" /></g>,
  trash: <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"><path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13" /></g>,
  up: <path d="M12 19V6M6 11l6-6 6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />,
  escal: <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M5 20V9l7-5 7 5v11" /><path d="M12 16v-6M9 12.5l3-3 3 3" /></g>,
  logout: <g fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M14 4h5v16h-5" /><path d="M10 16l4-4-4-4M14 12H4" /></g>,
  shield: <g fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinejoin="round" strokeLinecap="round"><path d="M12 3.5 19 6v5.5c0 4.4-3 7.7-7 9-4-1.3-7-4.6-7-9V6z" /><path d="m8.8 12 2.2 2.2 4.2-4.4" /></g>,
};

export default function Icon({ name, size, className }: { name: string; size?: 'sm'; className?: string }) {
  return <svg className={className ?? (size === 'sm' ? 'ic-sm' : 'ic')} viewBox="0 0 24 24" aria-hidden="true">{P[name]}</svg>;
}

export function taskIcon(task: string) {
  const t = task.toLowerCase();
  if (t.includes('medic')) return 'pill';
  if (t.includes('walk') || t.includes('exercise')) return 'walk';
  if (t.includes('breakfast') || t.includes('lunch') || t.includes('dinner') || t.includes('meal')) return 'bowl';
  return 'check';
}
