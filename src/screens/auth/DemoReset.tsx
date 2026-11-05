import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { cleanError, supabase } from '../../lib/supabase';
import { HOME, useAuth } from '../../lib/auth';
import Icon from '../../components/Icon';
import { Avatar, BrandMark, DoneMark, ErrorBox } from '../../components/ui';
import { AuthSide, DEMO, DEMO_PW } from './Login';

/** Opening /demo puts every demo account back to the start, ready to present. /demo?alert=2 uses a 2-minute missed check-in alert. */
export default function DemoReset() {
  const [params] = useSearchParams();
  const minutes = [2, 5, 10, 30].includes(Number(params.get('alert'))) ? Number(params.get('alert')) : 30;
  const { session, profile, signOut } = useAuth();
  const nav = useNavigate();
  const [state, setState] = useState<'busy' | 'done' | 'error'>('busy');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [want, setWant] = useState<string | null>(null);
  const started = useRef(false);

  async function reset() {
    setState('busy'); setMsg('');
    await signOut().catch(() => {});
    const { data, error } = await supabase.rpc('reset_demo', { p_minutes: minutes });
    if (error) { setMsg(cleanError(error.message)); setState('error'); return; }
    setMsg(String(data)); setState('done');
  }
  useEffect(() => { document.title = 'Reset the demo | KinCare'; if (!started.current) { started.current = true; reset(); } }, [minutes]);
  useEffect(() => { if (want && session && profile) nav(HOME[profile.role], { replace: true }); }, [want, session, profile]);

  async function signIn(email: string) {
    setBusy(email); setWant(email);
    const { error } = await supabase.auth.signInWithPassword({ email, password: DEMO_PW });
    if (error) { setBusy(null); setWant(null); setMsg(cleanError(error.message)); setState('error'); }
  }

  return (
    <div className="auth">
      <AuthSide />
      <main className="auth-main">
        <Link className="logo" to="/" aria-label="KinCare home"><BrandMark /><b>KinCare</b></Link>
        {state === 'busy' && (
          <div className="center" role="status">
            <span className="mini-spin" style={{ width: 32, height: 32, borderWidth: 3, margin: '8px auto 20px', display: 'block' }} />
            <h1>Resetting the demo</h1>
            <p className="lede">Rebuilding the sample families, caregivers and visits for today. This takes a few seconds.</p>
          </div>
        )}
        {state === 'error' && <>
          <h1>The demo was not reset</h1>
          <div style={{ marginTop: 16 }}><ErrorBox msg={msg} /></div>
          <button className="btn block" style={{ marginTop: 16 }} onClick={reset}><Icon name="refresh" size="sm" />Try again</button>
        </>}
        {state === 'done' && <>
          <div className="center"><DoneMark /><h1>The demo is ready</h1>
            <p className="lede">{msg} Missed check-in alerts fire after {minutes} minutes{minutes === 30 ? ', the BRD rule' : ', for a short live demo'}.</p></div>
          <div className="or">sign in as</div>
          <div className="panel flush demo-list">
            {DEMO.map(d => (
              <button key={d.email} className="li" disabled={!!busy} onClick={() => signIn(d.email)}>
                <Avatar text={d.i} tone="brand" size="sm" />
                <span className="li-t"><b>{d.role}</b><span>{d.who}</span></span>
                {busy === d.email ? <span className="mini-spin" aria-label="Signing in" /> : <Icon name="chev" size="sm" className="ic-sm chev" />}
              </button>
            ))}
          </div>
          <p className="t-xs faint center" style={{ marginTop: 16 }}>
            {minutes === 30
              ? <>To show a missed visit within minutes, open <Link to="/demo?alert=2" reloadDocument>the 2-minute version</Link> instead.</>
              : <>To go back to the BRD rule, open <Link to="/demo" reloadDocument>the 30-minute version</Link>.</>}
          </p>
        </>}
      </main>
    </div>
  );
}
