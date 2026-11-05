import { FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, cleanError } from '../../lib/supabase';
import Icon from '../../components/Icon';
import { BrandMark, Btn, DoneMark, ErrorBox } from '../../components/ui';
import { AuthSide } from './Login';

export default function SignUp() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  useEffect(() => { document.title = 'Create a family account | KinCare'; }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) return setErr('Enter your name.');
    if (password.length < 8) return setErr('Use at least 8 characters for your password.');
    setBusy(true); setErr(null);
    const { data, error } = await supabase.auth.signUp({ email: email.trim(), password, options: { data: { full_name: name.trim() }, emailRedirectTo: window.location.origin + '/login' } });
    setBusy(false);
    if (error) return setErr(cleanError(error.message));
    if (!data.session) setSent(true);
  }

  return (
    <div className="auth">
      <AuthSide />
      <main className="auth-main">
        <Link className="logo" to="/" aria-label="KinCare home"><BrandMark /><b>KinCare</b></Link>
        {sent ? (
          <div className="center">
            <DoneMark />
            <h1>Check your email</h1>
            <p className="lede">We sent a confirmation link to <b>{email}</b>. Open it on this device, then sign in.</p>
            <Link className="btn secondary block" style={{ marginTop: 24 }} to="/login">Back to sign in</Link>
          </div>
        ) : <>
          <Link className="crumb" style={{ display: 'inline-flex', marginBottom: 12 }} to="/login"><Icon name="back" size="sm" />Sign in</Link>
          <h1>Create a family account</h1>
          <p className="lede">For sons and daughters arranging care for a parent. Caregiver and staff accounts are set up by KinCare.</p>
          <form className="stack" style={{ marginTop: 24, gap: 16 }} onSubmit={submit}>
            <div className="field"><label className="label" htmlFor="name">Your name</label><input className="input" id="name" required value={name} onChange={e => setName(e.target.value)} autoComplete="name" /></div>
            <div className="field"><label className="label" htmlFor="email">Email</label><input className="input" id="email" type="email" inputMode="email" required value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" /></div>
            <div className="field"><label className="label" htmlFor="pw">Password</label>
              <div className="pw"><input className="input" id="pw" type={show ? 'text' : 'password'} required minLength={8} value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" aria-describedby="pw-h" />
                <button type="button" onClick={() => setShow(!show)} aria-pressed={show}>{show ? 'Hide' : 'Show'}</button></div>
              <span className="hint" id="pw-h">At least 8 characters.</span></div>
            <ErrorBox msg={err} />
            <Btn className="block" busy={busy} busyText="Creating account">Create account</Btn>
            <p className="t-xs faint center">By creating an account you agree that KinCare stores the details you add to arrange and check your parent's care.</p>
          </form>
        </>}
      </main>
    </div>
  );
}
