import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import Icon from './Icon';

export function BrandMark({ size = 32, on }: { size?: number; on?: 'dark' }) {
  return (
    <svg className="mark" width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <rect width="40" height="40" rx="11" fill={on === 'dark' ? '#FFFFFF' : '#1E4D3A'} />
      <path d="M20 30s-9-5.3-9-11.8A5.1 5.1 0 0 1 20 15a5.1 5.1 0 0 1 9 3.2C29 24.7 20 30 20 30z" fill="#E0952A" />
      <path d="M16.3 20.4l2.6 2.6 4.8-4.8" fill="none" stroke={on === 'dark' ? '#FFFFFF' : '#1E4D3A'} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Avatar({ text, tone, size }: { text: string; tone?: 'brand' | 'grey'; size?: 'sm' | 'lg' | 'xl' }) {
  return <span className={['av', tone, size].filter(Boolean).join(' ')} aria-hidden="true">{text}</span>;
}

/** The three checks a caregiver must pass before families can see them (BR2). */
export function Checks({ c }: { c: { id_checked: boolean; police_checked: boolean; training_done: boolean } }) {
  const one = (ok: boolean, t: string) => <span className={ok ? '' : 'no'}><Icon name={ok ? 'check' : 'clock'} size="sm" />{t}{ok ? '' : ' pending'}</span>;
  return <span className="checks">{one(c.id_checked, 'ID')}{one(c.police_checked, 'Police check')}{one(c.training_done, 'Training')}</span>;
}

export function Pill({ tone, children, dot }: { tone?: 'ok' | 'warn' | 'bad' | 'brand'; children: ReactNode; dot?: boolean }) {
  return <span className={'pill' + (tone ? ' ' + tone : '')}>{dot && <span className="d" />}{children}</span>;
}

export function Skeleton({ blocks = [120, 200, 88] }: { blocks?: number[] }) {
  return (
    <div className="skel" role="status" aria-label="Loading">
      {blocks.map((h, i) => <div key={i} className="sk" style={{ height: h }} />)}
    </div>
  );
}

export function ErrorBox({ msg }: { msg: string | null | undefined }) {
  return msg ? <p className="err" role="alert"><Icon name="warn" size="sm" /><span>{msg}</span></p> : null;
}

export function Empty({ icon = 'info', title, children, action }: { icon?: string; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="empty">
      <span className="e-ic"><Icon name={icon} /></span>
      <b>{title}</b>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function DoneMark() {
  return (
    <svg className="done-mark" viewBox="0 0 72 72" aria-hidden="true">
      <circle cx="36" cy="36" r="36" /><path d="M23 37l9 9 17-19" />
    </svg>
  );
}

/** A button that shows a spinner and its busy label while an action runs. */
export function Btn({ busy, busyText, children, className = '', ...rest }: React.ButtonHTMLAttributes<HTMLButtonElement> & { busy?: boolean; busyText?: string }) {
  return (
    <button className={'btn ' + className} disabled={busy || rest.disabled} aria-busy={busy || undefined} {...rest}>
      {busy ? <><span className="spin" aria-hidden="true" />{busyText ?? children}</> : children}
    </button>
  );
}

/** The sample check-in photo used for seeded demo visits. Real visits show the caregiver's own photo. */
export function DoorPhoto() {
  return (
    <svg viewBox="0 0 320 180" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Sample check-in photo of a front door">
      <rect width="320" height="180" fill="#D8CDB9" />
      <rect y="132" width="320" height="48" fill="#B9AA90" />
      <rect x="110" y="26" width="100" height="120" rx="3" fill="#6E472A" />
      <rect x="119" y="35" width="82" height="102" fill="#86593A" />
      <rect x="127" y="44" width="30" height="40" rx="2" fill="#7A5133" /><rect x="163" y="44" width="30" height="40" rx="2" fill="#7A5133" />
      <rect x="127" y="90" width="30" height="40" rx="2" fill="#7A5133" /><rect x="163" y="90" width="30" height="40" rx="2" fill="#7A5133" />
      <circle cx="190" cy="88" r="3.5" fill="#E3C27A" />
      <path d="M104 22h112v6H104z" fill="#E0952A" />
      <g fill="#E0952A">{[112, 132, 152, 172, 192, 208].map(x => <circle key={x} cx={x} cy="25" r="5" />)}</g>
      <g fill="#2C6650">{[122, 142, 162, 182, 200].map(x => <ellipse key={x} cx={x} cy="31" rx="3" ry="2" />)}</g>
      <ellipse cx="62" cy="126" rx="22" ry="13" fill="#2C6650" /><rect x="49" y="126" width="26" height="22" rx="3" fill="#9A5B05" />
      <rect x="230" y="118" width="40" height="30" rx="2" fill="#A89676" />
      <path d="M130 146h60l8 10h-76z" fill="#C9B79A" />
    </svg>
  );
}

type Tag = { icon: string; text: string; href?: string };
export function ProofCard({ img, tags, children }: { img: ReactNode; tags: Tag[]; children?: ReactNode }) {
  return (
    <figure className="proof" style={{ margin: 0 }}>
      <div className="proof-img">
        {img}
        <div className="proof-tags">
          {tags.map(t => t.href
            ? <a key={t.text} href={t.href} target="_blank" rel="noreferrer"><Icon name={t.icon} size="sm" />{t.text}</a>
            : <span key={t.text}><Icon name={t.icon} size="sm" />{t.text}</span>)}
        </div>
      </div>
      {children && <figcaption className="proof-body">{children}</figcaption>}
    </figure>
  );
}

/** Confirmation dialog for actions that cannot be undone. Esc or the scrim closes it. */
export function Confirm({ open, title, body, confirmLabel, busyLabel, cancelLabel = 'Cancel', tone, busy, onConfirm, onClose }: {
  open: boolean; title: string; body: ReactNode; confirmLabel: string; busyLabel?: string; cancelLabel?: string; tone?: 'danger'; busy?: boolean; onConfirm: () => void; onClose: () => void;
}) {
  const cancel = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    cancel.current?.focus();
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && !busy) onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; prev?.focus?.(); };
  }, [open, busy]);
  if (!open) return null;
  return (
    <div className="scrim" onMouseDown={e => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="dialog" role="alertdialog" aria-modal="true" aria-labelledby="dlg-t" aria-describedby="dlg-b">
        <h2 id="dlg-t">{title}</h2>
        <div className="d-body" id="dlg-b">{body}</div>
        <div className="d-actions">
          <button ref={cancel} className="btn secondary" onClick={onClose} disabled={busy}>{cancelLabel}</button>
          <Btn className={tone === 'danger' ? 'danger' : ''} busy={busy} busyText={busyLabel} onClick={onConfirm}>{confirmLabel}</Btn>
        </div>
      </div>
    </div>
  );
}

const ToastCtx = createContext<(msg: string, bad?: boolean) => void>(() => {});
export function ToastProvider({ children }: { children: ReactNode }) {
  const [t, setT] = useState<{ msg: string; bad?: boolean; show: boolean }>({ msg: '', show: false });
  const timer = useRef<number>();
  const show = useCallback((msg: string, bad?: boolean) => {
    setT({ msg, bad, show: true });
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setT(s => ({ ...s, show: false })), 3600);
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
