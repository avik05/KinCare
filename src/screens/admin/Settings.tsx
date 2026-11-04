import { useState } from 'react';
import { q, rpc, supabase } from '../../lib/supabase';
import { useLive } from '../../lib/hooks';
import { AppBar, ErrorBox, Loading, useToast } from '../../components/ui';
import { StaffTabs } from '../coordinator/staff';

export default function Settings() {
  const toast = useToast();
  const { data, loading, reload } = useLive(() => q<any>(supabase.from('settings').select('*').single()), [], 0);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  if (loading && !data) return <div className="shell"><Loading /></div>;

  async function setMinutes(m: number) {
    setErr(null);
    try { await rpc('set_no_show_minutes', { p_minutes: m }); toast(`Missed check-in alert now fires after ${m} minutes`); reload(); }
    catch (x: any) { setErr(x.message); }
  }
  async function resetDemo() {
    setBusy(true); setErr(null);
    try { const msg = await rpc<string>('reset_demo_data'); toast(msg); setConfirm(false); reload(); }
    catch (x: any) { setErr(x.message); } finally { setBusy(false); }
  }

  return (
    <div className="shell"><main className="page stack">
      <AppBar title="Settings" />
      <ErrorBox msg={err} />
      <div className="surface">
        <b>Missed check-in alert</b>
        <p className="small muted" style={{ margin: '4px 0 10px' }}>How long after a shift starts, without a check-in, before the family and coordinator are alerted. The BRD rule is 30 minutes; use a shorter time only for a live demo.</p>
        <div className="pillset" role="group" aria-label="Minutes before alert">
          {[30, 10, 5, 2].map(m => <button key={m} className="pill" aria-pressed={data?.no_show_minutes === m} onClick={() => setMinutes(m)}>{m} min{m === 30 ? ' (rule)' : ''}</button>)}
        </div>
      </div>
      <div className="surface">
        <b>Demo data</b>
        <p className="small muted" style={{ margin: '4px 0 10px' }}>Rebuilds the sample families, caregivers and visits around today's date. Kamala's shift will start 10 minutes from now, so check-in or a missed shift can be shown live. Real accounts and their bookings are not touched.</p>
        {!confirm ? <button className="btn ghost" onClick={() => setConfirm(true)}>Reset demo data</button> : (
          <div className="stack"><p className="small" style={{ margin: 0 }}>Demo visits and alerts will be replaced. Continue?</p>
            <button className="btn" disabled={busy} onClick={resetDemo}>{busy ? 'Resetting…' : 'Yes, reset the demo'}</button>
            <button className="btn ghost" onClick={() => setConfirm(false)}>Cancel</button></div>
        )}
      </div>
    </main><StaffTabs /></div>
  );
}
