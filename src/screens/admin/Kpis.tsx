import { useEffect, useRef } from 'react';
import { rpc } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { useLive, sweepNoShows } from '../../lib/hooks';
import Icon from '../../components/Icon';
import { AppBar, ErrorBox, Loading } from '../../components/ui';
import { StaffTabs } from '../coordinator/staff';

/** FR9: the four success measures from section 1 of the BRD, over the last 30 days. */
function Kpi({ title, value, unit, pct, target, targetLabel, note, invert }: { title: string; value: string; unit?: string; pct: number | null; target: number; targetLabel: string; note: string; invert?: boolean }) {
  const bar = useRef<HTMLElement>(null);
  useEffect(() => { requestAnimationFrame(() => { if (bar.current) bar.current.style.width = `${Math.max(0, Math.min(100, pct ?? 0))}%`; }); }, [pct]);
  const ok = pct == null ? false : invert ? pct <= target : pct >= target;
  return (
    <div className="kpi">
      <h4>{title}</h4>
      <div className="val">{value}{unit && <small> {unit}</small>}</div>
      <div className="kbar"><i ref={bar} className={ok ? '' : 'low'} /><b style={{ left: `${target}%` }} /></div>
      <div className="kfoot"><span>Target {targetLabel}</span><span>{pct == null ? 'No data yet' : ok ? 'On target' : 'Below target'}</span></div>
      <p className="tiny" style={{ margin: '6px 0 0' }}>{note}</p>
    </div>
  );
}

export default function Kpis() {
  const { signOut } = useAuth();
  const { data: k, loading, error } = useLive(async () => { await sweepNoShows(); return rpc<any>('kpis'); }, [], 30000);
  if (loading && !k) return <div className="shell"><Loading /></div>;
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : null);
  const rep = pct(k?.replaced_in_time ?? 0, k?.no_shows ?? 0);
  const full = pct(k?.visits_full ?? 0, k?.visits_due ?? 0);
  const renew = pct(k?.families_renewed ?? 0, k?.families_first_block ?? 0);
  const mins = k?.alert_minutes;
  return (
    <div className="shell"><main className="page stack">
      <AppBar title="Last 30 days" right={<button className="iconbtn" aria-label="Sign out" onClick={signOut}><Icon name="logout" /></button>} />
      <ErrorBox msg={error} />
      {k && <>
        <p className="tiny" style={{ margin: '-8px 0 0' }}>{k.open_alerts} open alerts, {k.escalations} escalated. Live from the database.</p>
        <Kpi title="Minutes from missed shift to family alert" value={mins == null ? 'None' : String(mins)} unit={mins == null ? '' : 'min avg'}
          pct={mins == null ? null : Math.min(100, (mins / 60) * 100)} target={50} targetLabel="30 min or less" invert
          note={`Alerts fire ${k.no_show_minutes} minutes after a shift starts without a check-in.`} />
        <Kpi title="No-shows replaced within 4 hours" value={`${k.replaced_in_time} of ${k.no_shows}`} pct={rep} target={90} targetLabel="90%" note={rep == null ? 'No missed shifts this month.' : `${rep}% replaced in time.`} />
        <Kpi title="Visits with check-in, photo and task log" value={`${k.visits_full} of ${k.visits_due}`} pct={full} target={95} targetLabel="95%" note={full == null ? 'No visits yet.' : `${full}% of visits fully recorded.`} />
        <Kpi title="Families renewing after the first block" value={`${k.families_renewed} of ${k.families_first_block}`} pct={renew} target={60} targetLabel="60% in 12 months" note={renew == null ? 'No first blocks have ended yet.' : `${renew}% renewed.`} />
      </>}
    </main><StaffTabs escalation={(k?.escalations ?? 0) > 0} alert={(k?.open_alerts ?? 0) > 0} /></div>
  );
}
