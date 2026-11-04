import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { q, rpc, supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { useLive } from '../../lib/hooks';
import { shortDate } from '../../lib/format';
import Icon from '../../components/Icon';
import { AppBar, ErrorBox, Loading } from '../../components/ui';

export default function Account() {
  const { profile, session, signOut } = useAuth();
  const nav = useNavigate();
  const { data: parents, loading } = useLive(() => q<any[]>(supabase.from('parents').select('id, name, consent_at').order('created_at')), [], 0);
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function close() {
    setBusy(true); setErr(null);
    try {
      // Remove check-in photos first: Supabase only allows deleting stored files through the storage API.
      const ids = (parents ?? []).map(p => p.id);
      if (ids.length) {
        const visits = await q<any[]>(supabase.from('visits').select('photo_path').in('parent_id', ids).not('photo_path', 'is', null).neq('photo_path', 'sample'));
        const paths = visits.map(v => v.photo_path);
        for (let i = 0; i < paths.length; i += 100) await supabase.storage.from('checkins').remove(paths.slice(i, i + 100));
      }
      await rpc('close_account');
      await signOut();
      nav('/login', { replace: true });
    } catch (x: any) { setErr(x.message); setBusy(false); }
  }

  if (loading) return <div className="shell"><Loading /></div>;
  return (
    <div className="shell"><main className="page stack">
      <AppBar title="Account and privacy" back="/f" />
      <div className="surface"><b>{profile?.full_name}</b><div className="tiny">{session?.user.email}</div>
        <button className="btn ghost sm" style={{ marginTop: 12 }} onClick={async () => { await signOut(); nav('/login'); }}><Icon name="logout" size="sm" />Sign out</button></div>
      <div className="surface"><b>Who can see health readings</b>
        <div className="kv"><span>You</span><span>Yes</span></div>
        <div className="kv"><span>Your KinCare coordinator</span><span>Yes</span></div>
        <div className="kv"><span>Caregiver on shift</span><span>Only during the shift</span></div>
        <div className="kv"><span>Anyone else</span><span>No</span></div>
        {parents?.map(p => <p key={p.id} className="tiny" style={{ margin: '6px 0 0' }}>Consent for {p.name} recorded on {shortDate(p.consent_at)}.</p>)}
      </div>
      <div className="surface"><b>Close account</b>
        <p className="small muted" style={{ margin: '4px 0 10px' }}>This permanently deletes:</p>
        <ul className="delete-list">
          <li><Icon name="trash" size="sm" />Your parents' profiles, addresses and care needs</li>
          <li><Icon name="trash" size="sm" />All BP and sugar readings</li>
          <li><Icon name="trash" size="sm" />All check-in photos and locations, and booking history</li>
        </ul>
        <ErrorBox msg={err} />
        {!confirm
          ? <button className="btn danger" style={{ marginTop: 12 }} onClick={() => setConfirm(true)}>Close account and delete data</button>
          : <div className="stack" style={{ marginTop: 12 }}>
              <p className="small" style={{ margin: 0 }}><b>This cannot be undone.</b> Delete everything now?</p>
              <button className="btn danger" disabled={busy} onClick={close}>{busy ? 'Deleting…' : 'Yes, delete everything'}</button>
              <button className="btn ghost" onClick={() => setConfirm(false)}>Keep my account</button>
            </div>}
      </div>
    </main></div>
  );
}
