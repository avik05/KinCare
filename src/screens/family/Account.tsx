import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { q, rpc, supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { useLive } from '../../lib/hooks';
import { useInstall } from '../../lib/pwa';
import { initials, shortDate } from '../../lib/format';
import Icon from '../../components/Icon';
import { Avatar, Confirm, ErrorBox, Pill, useToast } from '../../components/ui';
import { Screen, ScreenLoading, useAttention } from '../../components/layout';

export default function Account() {
  const { profile, session, signOut } = useAuth();
  const { notify } = useAttention();
  const install = useInstall();
  const toast = useToast();
  const nav = useNavigate();
  const { data: parents, loading } = useLive(() => q<any[]>(supabase.from('parents').select('id, name, consent_at').order('created_at')), [], 0);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function close() {
    setBusy(true); setErr(null);
    try {
      // Check-in photos are deleted through the storage API first; the database function then removes everything else.
      const ids = (parents ?? []).map(p => p.id);
      if (ids.length) {
        const visits = await q<any[]>(supabase.from('visits').select('photo_path').in('parent_id', ids).not('photo_path', 'is', null).neq('photo_path', 'sample'));
        const paths = visits.map(v => v.photo_path);
        for (let i = 0; i < paths.length; i += 100) await supabase.storage.from('checkins').remove(paths.slice(i, i + 100));
      }
      await rpc('close_account');
      await signOut();
      nav('/login', { replace: true });
    } catch (x: any) { setErr(x.message); setBusy(false); setConfirm(false); }
  }

  if (loading) return <ScreenLoading title="Account" blocks={[80, 140, 180]} />;
  return (
    <Screen title="Account">
      <div className="stack-lg">
        <div className="panel flush">
          <div className="li"><Avatar text={initials(profile?.full_name)} tone="brand" size="lg" />
            <span className="li-t"><b>{profile?.full_name}</b><span>{session?.user.email}</span></span>
            <button className="btn secondary sm" onClick={async () => { await signOut(); nav('/login', { replace: true }); }}><Icon name="logout" size="sm" />Sign out</button></div>
        </div>

        <section className="section" aria-labelledby="dev-h">
          <div className="sec-head"><h2 id="dev-h">This device</h2></div>
          <div className="panel flush">
            <div className="li">
              <span className="av grey"><Icon name="bell" size="sm" /></span>
              <span className="li-t"><b>Alert notifications</b><span>{!notify.supported ? 'This browser cannot show notifications. Alerts still appear in the app.' : notify.blocked ? 'Blocked for this site. Allow notifications in your browser settings.' : 'A missed check-in or SOS shows on this device while KinCare is open.'}</span></span>
              <button className="switch" role="switch" aria-checked={notify.on} aria-label="Alert notifications" disabled={!notify.supported} onClick={notify.toggle} />
            </div>
            <div className="li">
              <span className="av grey"><Icon name="download" size="sm" /></span>
              <span className="li-t"><b>KinCare on your home screen</b><span>{install.installed ? 'Installed. You are using the app.' : install.canPrompt ? 'Opens like an app, full screen, one tap from your home screen.' : install.ios ? 'In Safari, tap Share, then Add to Home Screen.' : 'In your browser menu, choose Install app or Add to Home Screen.'}</span></span>
              {install.installed ? <Pill tone="ok">Installed</Pill> : install.canPrompt && <button className="btn secondary sm" onClick={async () => { if (await install.prompt()) toast('KinCare is installed'); }}>Install</button>}
            </div>
          </div>
        </section>

        <section className="section" aria-labelledby="priv-h">
          <div className="sec-head"><h2 id="priv-h">Who can see health readings</h2></div>
          <div className="panel">
            <div className="kv"><span>You</span><span>Always</span></div>
            <div className="kv"><span>Your KinCare coordinator</span><span>Always</span></div>
            <div className="kv"><span>The caregiver on shift</span><span>Only during the shift</span></div>
            <div className="kv"><span>Anyone else</span><span>Never</span></div>
          </div>
          {parents?.map(p => <p key={p.id} className="note" style={{ padding: '0 2px' }}><Icon name="check" size="sm" /><span>Consent for {p.name} recorded on {shortDate(p.consent_at)}.</span></p>)}
        </section>

        <section className="section" aria-labelledby="soon-h">
          <div className="sec-head"><h2 id="soon-h">Planned for later</h2></div>
          <div className="panel flush">
            <div className="li"><span className="av grey"><Icon name="pill" size="sm" /></span><span className="li-t"><b>Medicine delivery</b><span>From pharmacies near your parent. Not part of this version.</span></span></div>
            <div className="li"><span className="av grey"><Icon name="bowl" size="sm" /></span><span className="li-t"><b>Grocery delivery</b><span>Weekly essentials to their door. Not part of this version.</span></span></div>
          </div>
        </section>

        <div className="panel flush">
          <Link className="li" to="/about"><span className="av grey"><Icon name="info" size="sm" /></span><span className="li-t"><b>About KinCare</b><span>How it works, pricing and privacy</span></span><Icon name="chev" size="sm" className="ic-sm chev" /></Link>
        </div>

        <section className="section" aria-labelledby="close-h">
          <div className="sec-head"><h2 id="close-h">Close account</h2></div>
          <div className="panel pad danger-zone">
            <p className="t-sm muted">Closing your account permanently deletes:</p>
            <ul className="del-list">
              <li><Icon name="trash" size="sm" />Your parents’ profiles, addresses and care needs</li>
              <li><Icon name="trash" size="sm" />Every blood pressure and sugar reading</li>
              <li><Icon name="trash" size="sm" />Check-in photos, locations and booking history</li>
            </ul>
            <ErrorBox msg={err} />
            <button className="btn danger-outline" style={{ marginTop: 16 }} onClick={() => setConfirm(true)}>Close account and delete data</button>
          </div>
        </section>
      </div>
      <Confirm open={confirm} tone="danger" busy={busy} title="Delete everything?"
        body="Your account, your parents’ profiles, readings and photos will be deleted now. This cannot be undone."
        confirmLabel="Delete everything" busyLabel="Deleting" cancelLabel="Keep my account" onConfirm={close} onClose={() => setConfirm(false)} />
    </Screen>
  );
}
