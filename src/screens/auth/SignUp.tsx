import { FormEvent, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, cleanError } from '../../lib/supabase';
import { AppBar, ErrorBox } from '../../components/ui';

export default function SignUp() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (password.length < 8) { setErr('Use at least 8 characters for your password.'); return; }
    setBusy(true); setErr(null);
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { full_name: name.trim() } } });
    setBusy(false);
    if (error) return setErr(cleanError(error.message));
    if (!data.session) setSent(true);
  }

  return (
    <div className="shell"><main className="page">
      <AppBar title="Create a family account" back="/login" />
      {sent ? (
        <div className="surface stack">
          <b>Check your email</b>
          <p className="muted" style={{ margin: 0 }}>We sent a link to {email}. Open it to confirm your account, then sign in.</p>
          <Link className="btn ghost" to="/login">Back to sign in</Link>
        </div>
      ) : (
        <form className="surface stack" onSubmit={submit}>
          <p className="small muted" style={{ margin: 0 }}>For sons and daughters arranging care for a parent. Caregiver and staff accounts are set up by KinCare.</p>
          <div><label className="label" htmlFor="name">Your name</label><input className="field" id="name" required value={name} onChange={e => setName(e.target.value)} autoComplete="name" /></div>
          <div><label className="label" htmlFor="email">Email</label><input className="field" id="email" type="email" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" /></div>
          <div><label className="label" htmlFor="pw">Password</label><input className="field" id="pw" type="password" required value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" />
            <p className="tiny" style={{ margin: '4px 0 0' }}>At least 8 characters.</p></div>
          <ErrorBox msg={err} />
          <button className="btn" disabled={busy}>{busy ? 'Creating account…' : 'Create account'}</button>
        </form>
      )}
    </main></div>
  );
}
