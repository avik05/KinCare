import { FormEvent, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { supabase, cleanError } from '../../lib/supabase';
import { HOME, useAuth } from '../../lib/auth';
import { ErrorBox } from '../../components/ui';

export function BrandMark({ size = 44 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" aria-hidden="true">
      <rect width="40" height="40" rx="12" fill="#1F4D3B" />
      <path d="M20 29.5s-8.5-5-8.5-11.2A4.9 4.9 0 0 1 20 15.4a4.9 4.9 0 0 1 8.5 2.9c0 6.2-8.5 11.2-8.5 11.2z" fill="#E39A2D" />
      <path d="M16.5 20.3l2.5 2.5 4.6-4.6" fill="none" stroke="#1F4D3B" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const DEMO = [
  { email: 'meera@kincare.demo', role: 'Family', who: 'Meera, Singapore', i: 'MI' },
  { email: 'lakshmi@kincare.demo', role: 'Caregiver', who: 'Lakshmi R.', i: 'LR' },
  { email: 'kamala@kincare.demo', role: 'Elder', who: 'Kamala, Chennai', i: 'KI' },
  { email: 'ravi@kincare.demo', role: 'Coordinator', who: 'Ravi Kumar', i: 'RK' },
  { email: 'nandini@kincare.demo', role: 'Care Operations', who: 'Nandini Rao', i: 'NR' },
  { email: 'priya@kincare.demo', role: 'Caregiver', who: 'Priya D.', i: 'PD' },
];

export default function Login() {
  const { session, profile } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => { if (session && profile) nav(HOME[profile.role], { replace: true }); }, [session, profile]);

  async function signIn(e?: FormEvent, em = email, pw = password) {
    e?.preventDefault();
    setBusy(true); setErr(null);
    const { error } = await supabase.auth.signInWithPassword({ email: em.trim(), password: pw });
    setBusy(false);
    if (error) setErr(cleanError(error.message));
  }

  return (
    <div className="shell"><main className="page stack">
      <div className="login-hero"><BrandMark /><h1>KinCare</h1></div>
      <p className="muted" style={{ margin: 0 }}>Verified caregivers for your parents, and proof of every visit, wherever you live.</p>
      <form className="surface stack" onSubmit={signIn}>
        <div><label className="label" htmlFor="email">Email</label>
          <input className="field" id="email" type="email" autoComplete="email" required value={email} onChange={e => setEmail(e.target.value)} /></div>
        <div><label className="label" htmlFor="password">Password</label>
          <input className="field" id="password" type="password" autoComplete="current-password" required value={password} onChange={e => setPassword(e.target.value)} /></div>
        <ErrorBox msg={err} />
        <button className="btn" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
        <p className="small center" style={{ margin: 0 }}>New to KinCare? <Link to="/signup">Create a family account</Link></p>
      </form>
      <section className="stack" aria-labelledby="demo-h">
        <div>
          <h2 id="demo-h" style={{ fontFamily: 'var(--display)', fontSize: 17, margin: '8px 0 2px' }}>Try a demo account</h2>
          <p className="tiny" style={{ margin: 0 }}>Sample people and data for the capstone demo. Password for all: KinCare@2026</p>
        </div>
        <div className="demo-grid">
          {DEMO.map(d => (
            <button key={d.email} className="demo-btn" disabled={busy} onClick={() => { setEmail(d.email); setPassword('KinCare@2026'); signIn(undefined, d.email, 'KinCare@2026'); }}>
              <span className="av sm leaf">{d.i}</span><span><b>{d.role}</b><span>{d.who}</span></span>
            </button>
          ))}
        </div>
      </section>
    </main></div>
  );
}
