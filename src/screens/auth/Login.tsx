import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase, cleanError } from '../../lib/supabase';
import { HOME, useAuth } from '../../lib/auth';
import Icon from '../../components/Icon';
import { Avatar, BrandMark, Btn, DoorPhoto, ErrorBox, ProofCard } from '../../components/ui';

export { BrandMark };

export const DEMO = [
  { email: 'meera@kincare.demo', role: 'Family', who: 'Meera Iyer, daughter in Singapore', i: 'MI' },
  { email: 'lakshmi@kincare.demo', role: 'Caregiver', who: 'Lakshmi R., Adyar', i: 'LR' },
  { email: 'kamala@kincare.demo', role: 'Elder', who: 'Kamala Iyer, Chennai', i: 'KI' },
  { email: 'ravi@kincare.demo', role: 'Coordinator', who: 'Ravi Kumar, KinCare Chennai', i: 'RK' },
  { email: 'nandini@kincare.demo', role: 'Care Operations head', who: 'Nandini Rao', i: 'NR' },
];
export const DEMO_PW = 'KinCare@2026';

/** The left panel on wide screens: what KinCare proves, shown as a real visit record. */
export function AuthSide() {
  return (
    <aside className="auth-side">
      <div className="logo"><BrandMark on="dark" /><b>KinCare</b></div>
      <h2>Know every visit happened.</h2>
      <p className="a-lede">Verified caregivers for your parents in another city. Each visit is checked in at the door with the time, location and a photo, and you are alerted within 30 minutes if no one arrives.</p>
      <ProofCard img={<DoorPhoto />} tags={[{ icon: 'clock', text: '8:04 am' }, { icon: 'pin', text: 'Within 12 m of home' }]}>
        <div className="row"><Avatar text="LR" tone="brand" size="sm" />
          <div className="grow"><b style={{ fontWeight: 600 }}>Lakshmi checked in</b><div className="t-sm muted">Amma's home, Adyar, Chennai</div></div>
          <span className="pill ok"><Icon name="check" size="sm" />Verified</span></div>
      </ProofCard>
      <p className="a-foot">IT for Managers capstone, Great Lakes Institute of Management, Chennai. All people and places in the demo are invented.</p>
    </aside>
  );
}

export default function Login() {
  const { session, profile } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { document.title = 'Sign in | KinCare'; }, []);
  useEffect(() => { if (session && profile) nav(HOME[profile.role], { replace: true }); }, [session, profile]);

  async function signIn(em: string, pw: string, who: string) {
    setBusy(who); setErr(null);
    const { error } = await supabase.auth.signInWithPassword({ email: em.trim(), password: pw });
    if (error) { setBusy(null); setErr(cleanError(error.message)); }
  }
  const submit = (e: FormEvent) => { e.preventDefault(); signIn(email, password, 'form'); };

  return (
    <div className="auth">
      <AuthSide />
      <main className="auth-main">
        <div className="logo"><BrandMark /><b>KinCare</b></div>
        <h1>Sign in</h1>
        <p className="lede">Welcome back. Use the email you registered with.</p>
        <form className="stack" style={{ marginTop: 24, gap: 16 }} onSubmit={submit} noValidate={false}>
          <div className="field"><label className="label" htmlFor="email">Email</label>
            <input className="input" id="email" type="email" autoComplete="email" inputMode="email" required value={email} onChange={e => setEmail(e.target.value)} /></div>
          <div className="field"><label className="label" htmlFor="password">Password</label>
            <div className="pw"><input className="input" id="password" type={show ? 'text' : 'password'} autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} />
              <button type="button" onClick={() => setShow(!show)} aria-pressed={show}>{show ? 'Hide' : 'Show'}</button></div></div>
          <ErrorBox msg={err} />
          <Btn className="block" busy={busy === 'form'} busyText="Signing in" disabled={!!busy}>Sign in</Btn>
          <p className="t-sm muted center">New to KinCare? <Link to="/signup">Create a family account</Link></p>
        </form>

        <div className="or">or try a demo account</div>
        <p className="t-xs faint" style={{ marginBottom: 10 }}>Sample people and data for the capstone demo. Password for all: {DEMO_PW}</p>
        <div className="panel flush demo-list">
          {DEMO.map(d => (
            <button key={d.email} className="li" disabled={!!busy} onClick={() => { setEmail(d.email); setPassword(DEMO_PW); signIn(d.email, DEMO_PW, d.email); }}>
              <Avatar text={d.i} tone="brand" size="sm" />
              <span className="li-t"><b>{d.role}</b><span>{d.who}</span></span>
              {busy === d.email ? <span className="mini-spin" aria-label="Signing in" /> : <Icon name="chev" size="sm" className="ic-sm chev" />}
            </button>
          ))}
        </div>
      </main>
    </div>
  );
}
