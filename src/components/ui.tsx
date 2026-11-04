import { createContext, ReactNode, useCallback, useContext, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Icon from './Icon';

export function AppBar({ title, back, right }: { title: string; back?: string | true; right?: ReactNode }) {
  const nav = useNavigate();
  return (
    <div className="appbar">
      {back && <button className="iconbtn" aria-label="Back" onClick={() => (back === true ? nav(-1) : nav(back))}><Icon name="back" /></button>}
      <h1 style={back ? undefined : { marginLeft: 6 }}>{title}</h1>
      {right}
    </div>
  );
}

export function Avatar({ text, tone, size }: { text: string; tone?: 'leaf'; size?: 'sm' | 'lg' | 'xl' }) {
  return <span className={['av', tone, size].filter(Boolean).join(' ')} aria-hidden="true">{text}</span>;
}

export function Badges({ c }: { c: { id_checked: boolean; police_checked: boolean; training_done: boolean } }) {
  const b = (ok: boolean, t: string) => <span className={'vbadge' + (ok ? '' : ' no')}><Icon name={ok ? 'check' : 'clock'} />{t}</span>;
  return <div className="badges">{b(c.id_checked, 'ID')}{b(c.police_checked, 'Police check')}{b(c.training_done, 'Training')}</div>;
}

export function Loading() {
  return <div className="loading" role="status"><span className="spinner" /><span className="sr">Loading</span></div>;
}

export function ErrorBox({ msg }: { msg: string | null }) {
  return msg ? <p className="err" role="alert">{msg}</p> : null;
}

export function CheckAnim({ size = 96 }: { size?: number }) {
  return (
    <svg className="check-anim" viewBox="0 0 96 96" style={{ width: size, height: size }} aria-hidden="true">
      <circle cx="48" cy="48" r="48" /><path d="M30 49l12 12 24-26" />
    </svg>
  );
}

/** The sample check-in photo used for seeded demo visits. Real visits show the caregiver's photo. */
export function DoorPhoto({ stamp }: { stamp: string }) {
  return (
    <svg className="photo" viewBox="0 0 300 150" role="img" aria-label={`Sample check-in photo at the front door, ${stamp}`}>
      <rect width="300" height="150" fill="#D9CDB8" /><rect x="0" y="112" width="300" height="38" fill="#B8A88E" />
      <rect x="104" y="22" width="92" height="104" rx="3" fill="#7A4F2E" /><rect x="112" y="30" width="76" height="88" fill="#8C5D38" />
      <circle cx="178" cy="76" r="3.5" fill="#E3C27A" /><path d="M98 18h104v6H98z" fill="#E39A2D" />
      <ellipse cx="62" cy="104" rx="20" ry="12" fill="#2C6650" /><rect x="50" y="104" width="24" height="18" rx="3" fill="#9A5B05" />
      <g fill="#E39A2D"><circle cx="105" cy="22" r="5" /><circle cx="125" cy="24" r="5" /><circle cx="145" cy="25" r="5" /><circle cx="165" cy="24" r="5" /><circle cx="185" cy="22" r="5" /></g>
      <rect x="196" y="122" width="96" height="20" rx="4" fill="rgba(28,38,35,.72)" />
      <text x="244" y="136" textAnchor="middle" fontFamily="Figtree,sans-serif" fontSize="11" fill="#fff">{stamp}</text>
    </svg>
  );
}

type Tab = { to: string; icon: string; label: string; dot?: boolean; active: boolean };
export function TabBar({ tabs, label }: { tabs: Tab[]; label: string }) {
  return (
    <nav className="tabbar" aria-label={label}>
      {tabs.map(t => (
        <Link key={t.to} to={t.to} className={'tab' + (t.active ? ' active' : '')} aria-current={t.active ? 'page' : undefined}>
          <Icon name={t.icon} />{t.label}{t.dot && <span className="dot" />}
        </Link>
      ))}
    </nav>
  );
}

const ToastCtx = createContext<(msg: string, bad?: boolean) => void>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [t, setT] = useState<{ msg: string; bad?: boolean; show: boolean }>({ msg: '', show: false });
  const show = useCallback((msg: string, bad?: boolean) => {
    setT({ msg, bad, show: true });
    clearTimeout((show as any).h);
    (show as any).h = setTimeout(() => setT(s => ({ ...s, show: false })), 3000);
  }, []);
  return (
    <ToastCtx.Provider value={show}>
      {children}
      <div className={'toast' + (t.show ? ' show' : '') + (t.bad ? ' bad' : '')} role="status" aria-live="polite">
        <Icon name={t.bad ? 'warn' : 'check'} /><span>{t.msg}</span>
      </div>
    </ToastCtx.Provider>
  );
}
export const useToast = () => useContext(ToastCtx);
