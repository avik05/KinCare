import { useState } from 'react';
import { q, rpc, supabase } from '../../lib/supabase';
import { useLive } from '../../lib/hooks';
import { inr } from '../../lib/format';
import Icon from '../../components/Icon';
import { Confirm, ErrorBox, Pill, useToast } from '../../components/ui';
import { Screen, ScreenLoading, useAttention } from '../../components/layout';

export default function Settings() {
  const toast = useToast();
  const { refresh } = useAttention();
  const { data, loading, reload } = useLive(() => q<any>(supabase.from('settings').select('*').single()), [], 0);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState<number | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);
  if (loading && !data) return <ScreenLoading title="Settings" blocks={[160, 160]} />;

  async function setMinutes(m: number) {
    if (m === data?.no_show_minutes) return;
    setErr(null); setSaving(m);
    try { await rpc('set_no_show_minutes', { p_minutes: m }); toast(`Missed check-in alerts now fire after ${m} minutes`); reload(); }
    catch (x: any) { setErr(x.message); } finally { setSaving(null); }
  }
  async function resetDemo() {
    setBusy(true); setErr(null);
    try { const msg = await rpc<string>('reset_demo_data'); toast(msg); setConfirm(false); reload(); refresh(); }
    catch (x: any) { setErr(x.message); setConfirm(false); } finally { setBusy(false); }
  }

  return (
    <Screen title="Settings" sub="Rules for the whole service, and tools for the live demo.">
      <div className="stack-lg">
        <ErrorBox msg={err} />
        <section className="section" aria-labelledby="ns-h">
          <div className="sec-head"><h2 id="ns-h">Missed check-in alert</h2>{data?.no_show_minutes === 30 ? <Pill tone="ok" dot>BRD rule</Pill> : <Pill tone="warn" dot>Demo setting</Pill>}</div>
          <div className="panel pad stack">
            <p className="t-sm muted">How long after a shift starts, with no check-in, before the family and coordinator are alerted. The BRD rule is 30 minutes. Use a shorter time only for a live demo, then set it back.</p>
            <div className="seg" role="radiogroup" aria-label="Minutes before alert">
              {[30, 10, 5, 2].map(m => <button key={m} role="radio" aria-checked={data?.no_show_minutes === m} disabled={saving != null} onClick={() => setMinutes(m)}>{m} min</button>)}
            </div>
          </div>
        </section>
        <section className="section" aria-labelledby="fixed-h">
          <div className="sec-head"><h2 id="fixed-h">Fixed by the BRD</h2></div>
          <div className="panel">
            <div className="kv"><span>Minimum booking</span><span>14 days</span></div>
            <div className="kv"><span>Replacement deadline after an alert</span><span>{data?.replacement_hours} hours</span></div>
            <div className="kv"><span>Monthly membership</span><span>{inr(data?.membership_fee ?? 0)}</span></div>
          </div>
        </section>
        <section className="section" aria-labelledby="demo-h">
          <div className="sec-head"><h2 id="demo-h">Demo data</h2></div>
          <div className="panel pad stack">
            <p className="t-sm muted">Rebuilds the sample families, caregivers and visits around today’s date. Kamala’s shift then starts 10 minutes from now, so you can show a check-in or a missed visit live. Real accounts and their bookings are not touched.</p>
            <div><button className="btn secondary" onClick={() => setConfirm(true)}><Icon name="refresh" size="sm" />Reset demo data</button></div>
          </div>
        </section>
      </div>
      <Confirm open={confirm} busy={busy} title="Reset the demo data?" body="Sample visits, readings and alerts are replaced with a fresh set for today. Anything you did with the demo accounts will be lost."
        confirmLabel="Reset demo data" busyLabel="Resetting" onConfirm={resetDemo} onClose={() => setConfirm(false)} />
    </Screen>
  );
}
