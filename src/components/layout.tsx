import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Role, useAuth } from '../lib/auth';
import { supabase } from '../lib/supabase';
import { initials } from '../lib/format';
import Icon from './Icon';
import { BrandMark, useToast } from './ui';

export const ROLE_LABEL: Record<Role, string> = { family: 'Family', elder: 'Elder', caregiver: 'Caregiver', coordinator: 'Coordinator', admin: 'Care Operations head' };

/* ---------- attention: open alert counts and alert notifications ---------- */

type Attn = { open: number; escalated: number; notify: { supported: boolean; on: boolean; blocked: boolean; toggle: () => void }; refresh: () => void };
const AttnCtx = createContext<Attn>({ open: 0, escalated: 0, notify: { supported: false, on: false, blocked: false, toggle: () => {} }, refresh: () => {} });
export const useAttention = () => useContext(AttnCtx);

const NOTIFY_KEY = 'kincare-notify';
const canNotify = () => typeof window !== 'undefined' && 'Notification' in window;
function readPref() { try { return localStorage.getItem(NOTIFY_KEY) === 'on'; } catch { return false; } }

async function systemNotify(title: string, body: string, url: string, tag: string) {
  if (!canNotify() || Notification.permission !== 'granted') return;
  const opts: NotificationOptions & { data?: any } = { body, tag, icon: '/icons/icon-192.png', badge: '/icons/icon-192.png', data: { url } };
  try {
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
    if (reg) await reg.showNotification(title, opts);
    else new Notification(title, opts);
  } catch { /* some browsers only allow notifications from an installed app */ }
}

/** Polls open alerts for the signed-in family or staff member; tells them about new ones in the app and, if allowed, as a system notification. */
export function AttentionProvider({ children }: { children: ReactNode }) {
  const { profile } = useAuth();
  const toast = useToast();
  const role = profile?.role;
  const watch = role === 'family' || role === 'coordinator' || role === 'admin';
  const [counts, setCounts] = useState({ open: 0, escalated: 0 });
  const [on, setOn] = useState(readPref);
  const [perm, setPerm] = useState<NotificationPermission | 'unsupported'>(canNotify() ? Notification.permission : 'unsupported');
  const seen = useRef<Set<string> | null>(null);

  const poll = useCallback(async () => {
    if (!watch) return;
    const { data } = await supabase.from('alerts').select('id, type, level, parent:parents(name, relation)').is('resolved_at', null);
    if (!data) return;
    setCounts({ open: data.length, escalated: data.filter((a: any) => a.level === 'escalated').length });
    const ids = new Set<string>(data.map((a: any) => a.id));
    if (seen.current) {
      for (const a of data as any[]) {
        if (seen.current.has(a.id)) continue;
        const who = role === 'family' && a.parent?.relation && a.parent.relation !== 'Parent' ? a.parent.relation : a.parent?.name ?? 'A parent';
        const title = a.type === 'sos' ? `${who} pressed SOS` : a.level === 'escalated' ? `${who}: replacement missed too` : `${who}: no check-in`;
        const body = role === 'family'
          ? (a.type === 'sos' ? 'Your coordinator is calling now.' : 'KinCare is assigning a verified replacement.')
          : (a.type === 'sos' ? 'Call the family and the nearby contact.' : 'Assign a verified replacement.');
        toast(title, true);
        if (readPref()) systemNotify(title, body, role === 'family' ? `/f/alert/${a.id}` : `/k/alert/${a.id}`, a.id);
      }
    }
    seen.current = ids;
  }, [watch, role]);

  useEffect(() => {
    seen.current = null; setCounts({ open: 0, escalated: 0 });
    if (!watch) return;
    poll();
    const id = setInterval(() => { if (document.visibilityState === 'visible' || readPref()) poll(); }, 20000);
    return () => clearInterval(id);
  }, [watch, poll, profile?.id]);

  const toggle = useCallback(async () => {
    if (!canNotify()) return;
    if (on) { try { localStorage.setItem(NOTIFY_KEY, 'off'); } catch { /* ignore */ } setOn(false); toast('Alert notifications turned off'); return; }
    const p = Notification.permission === 'default' ? await Notification.requestPermission() : Notification.permission;
    setPerm(p);
    if (p !== 'granted') { toast('Notifications are blocked for this site. Allow them in your browser settings.', true); return; }
    try { localStorage.setItem(NOTIFY_KEY, 'on'); } catch { /* ignore */ }
    setOn(true); toast('Alert notifications are on for this device');
  }, [on]);

  const value: Attn = {
    ...counts,
    notify: { supported: perm !== 'unsupported', on: on && perm === 'granted', blocked: perm === 'denied', toggle },
    refresh: poll,
  };
  return <AttnCtx.Provider value={value}>{children}</AttnCtx.Provider>;
}

/* ---------- navigation ---------- */

type NavItem = { to: string; label: string; icon: string; active: boolean; count?: number };
function useNav(): NavItem[] {
  const { profile } = useAuth();
  const p = useLocation().pathname.replace(/\/$/, '');
  const { open, escalated } = useAttention();
  const alerts = { to: '/k', label: 'Alerts', icon: 'bell', active: p === '/k' || p.startsWith('/k/alert') || p.startsWith('/k/assign'), count: open };
  const cgs = { to: '/k/caregivers', label: 'Caregivers', icon: 'users', active: p.startsWith('/k/caregivers') };
  switch (profile?.role) {
    case 'family': return [
      { to: '/f', label: 'Home', icon: 'home', active: p === '/f' || p.startsWith('/f/alert') || p.startsWith('/f/renew') || p.startsWith('/f/add-parent'), count: open },
      { to: '/f/timeline', label: 'Visits', icon: 'tl', active: p.startsWith('/f/timeline') },
      { to: '/f/book', label: 'Book care', icon: 'cal', active: p.startsWith('/f/book') },
      { to: '/f/account', label: 'Account', icon: 'user', active: p.startsWith('/f/account') },
    ];
    case 'caregiver': return [{ to: '/c', label: 'Today', icon: 'cal', active: true }];
    case 'coordinator': return [alerts, cgs];
    case 'admin': return [
      { to: '/a', label: 'Overview', icon: 'chart', active: p === '/a' },
      { to: '/a/escalations', label: 'Escalations', icon: 'escal', active: p.startsWith('/a/escalations'), count: escalated },
      alerts, cgs,
      { to: '/a/settings', label: 'Settings', icon: 'gear', active: p.startsWith('/a/settings') },
    ];
    default: return [];
  }
}

function UserMenu({ placement }: { placement: 'up' | 'down' }) {
  const { profile, session, signOut } = useAuth();
  const { notify } = useAttention();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent | KeyboardEvent) => {
      if (e instanceof KeyboardEvent ? e.key === 'Escape' : !ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', close); document.addEventListener('keydown', close);
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', close); };
  }, [open]);
  if (!profile) return null;
  const role = profile.role;
  const out = async () => { setOpen(false); await signOut(); nav('/login', { replace: true }); };
  return (
    <div ref={ref} style={{ position: 'relative' }} className={placement === 'up' ? 'side-foot' : 'menu-m'}>
      {placement === 'up'
        ? <button className="who" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
            <span className="av sm brand">{initials(profile.full_name)}</span>
            <span className="who-t"><b>{profile.full_name}</b><span>{ROLE_LABEL[role]}</span></span>
            <Icon name="updown" size="sm" />
          </button>
        : <button className="iconbtn" aria-label="Your account" aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen(!open)}>
            <span className="av sm brand">{initials(profile.full_name)}</span>
          </button>}
      {open && (
        <div className={'menu ' + placement} role="menu">
          <div className="m-head"><b>{profile.full_name}</b><span>{session?.user.email}</span></div>
          {role === 'family' && <Link className="m-item" role="menuitem" to="/f/account" onClick={() => setOpen(false)}><Icon name="user" size="sm" />Account and privacy</Link>}
          {role !== 'caregiver' && notify.supported && (
            <button className="m-item" role="menuitemcheckbox" aria-checked={notify.on} onClick={notify.toggle}>
              <Icon name="bell" size="sm" />Alert notifications<span className="switch" aria-hidden="true" aria-checked={notify.on} />
            </button>
          )}
          <Link className="m-item" role="menuitem" to="/about" onClick={() => setOpen(false)}><Icon name="info" size="sm" />About KinCare</Link>
          <div className="m-sep" />
          <button className="m-item danger" role="menuitem" onClick={out}><Icon name="logout" size="sm" />Sign out</button>
        </div>
      )}
    </div>
  );
}

function Sidebar({ items }: { items: NavItem[] }) {
  const { profile } = useAuth();
  const home = items[0]?.to ?? '/';
  return (
    <aside className="sidebar" aria-label="Main">
      <Link className="logo" to={home}><BrandMark /><b>KinCare</b></Link>
      <nav className="nav" aria-label={profile ? ROLE_LABEL[profile.role] : 'Main'}>
        {items.map(i => (
          <Link key={i.to} to={i.to} aria-current={i.active ? 'page' : undefined}>
            <Icon name={i.icon} />{i.label}{!!i.count && <span className="count" aria-label={`${i.count} open`}>{i.count}</span>}
          </Link>
        ))}
      </nav>
      <UserMenu placement="up" />
    </aside>
  );
}

function TabBar({ items }: { items: NavItem[] }) {
  return (
    <nav className="tabbar" aria-label="Main">
      {items.map(i => (
        <Link key={i.to} to={i.to} aria-current={i.active ? 'page' : undefined}>
          <Icon name={i.icon} />{i.label}{!!i.count && <span className="tdot" aria-label={`${i.count} open`} />}
        </Link>
      ))}
    </nav>
  );
}

/** Every signed-in screen: sidebar on desktop, top bar and tabs on phones, optional sticky action bar. */
export function Screen({ title, sub, back, backLabel = 'Back', actions, footer, wide, children }: {
  title: ReactNode; sub?: ReactNode; back?: string | true; backLabel?: string; actions?: ReactNode; footer?: ReactNode; wide?: boolean; children: ReactNode;
}) {
  const items = useNav();
  const { profile } = useAuth();
  const nav = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 4);
    on(); window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  useEffect(() => { if (typeof title === 'string') document.title = `${title} | KinCare`; }, [title]);
  const goBack = () => (back === true ? nav(-1) : back && nav(back));
  const tabs = !back && items.length > 1;
  const menuOnTop = !back && profile?.role !== 'family';
  return (
    <div className={'app' + (tabs ? ' has-tabs' : '') + (footer ? ' has-foot' : '')}>
      <Sidebar items={items} />
      <div className="main">
        <header className={'topbar' + (back ? ' sub' : ' top') + (scrolled ? ' scrolled' : '')}>
          {back && <button className="iconbtn back-m" aria-label={backLabel} onClick={goBack}><Icon name="back" /></button>}
          <div className="tb-title">
            {back && <button className="crumb" onClick={goBack}><Icon name="back" size="sm" />{backLabel}</button>}
            <h1>{title}</h1>
            {sub && <p className="tb-sub">{sub}</p>}
          </div>
          {(actions || menuOnTop) && <div className="tb-actions">{actions}{menuOnTop && <UserMenu placement="down" />}</div>}
        </header>
        <main className={'content' + (wide ? ' wide' : '')} id="main">{children}</main>
        {footer && <div className="footbar"><div className="footbar-in">{footer}</div></div>}
      </div>
      {tabs && <TabBar items={items} />}
    </div>
  );
}

/** Placeholder while a screen's first data loads: same frame, skeleton body. */
export function ScreenLoading({ title = '', back, blocks }: { title?: string; back?: string | true; blocks?: number[] }) {
  return <Screen title={title || ' '} back={back}><SkeletonBody blocks={blocks} /></Screen>;
}
function SkeletonBody({ blocks = [132, 220, 96] }: { blocks?: number[] }) {
  return <div className="skel" role="status" aria-label="Loading">{blocks.map((h, i) => <div key={i} className="sk" style={{ height: h }} />)}</div>;
}
