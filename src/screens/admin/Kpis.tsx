import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { rpc } from '../../lib/supabase';
import { useLive, sweepNoShows } from '../../lib/hooks';
import { time } from '../../lib/format';
import Icon from '../../components/Icon';
import { ErrorBox, Pill } from '../../components/ui';
import { Screen, ScreenLoading } from '../../components/layout';

/** FR9: the four success measures from section 1 of the BRD, over the last 30 days. */
function Kpi({ title, value, unit, pct, target, targetLabel, note, lowerIsBetter }: { title: string; value: string; unit?: string; pct: number | null; target: number; targetLabel: string; note: string; lowerIsBetter?: boolean }) {
  const bar = useRef<HTMLElement>(null);
  useEffect(() => { const id = requestAnimationFrame(() => { if (bar.current) bar.current.style.width = `${Math.max(0, Math.min(100, pct ?? 0))}%`; }); return () => cancelAnimationFrame(id); }, [pct]);
  const ok = pct == null ? null : lowerIsBetter ? pct <= target : pct >= target;
  return (
    <article className="panel kpi">
      <div className="kpi-h"><h3>{title}</h3>{ok == null ? <Pill>No data yet</Pill> : ok ? <Pill tone="ok" dot>On target</Pill> : <Pill tone="warn" dot>Below target</Pill>}</div>
      <div className="val">{value}{unit && <small>{unit}</small>}</div>
      <div className="bullet" role="img" aria-label={`${pct ?? 0}% against a target marker`}><i ref={bar} className={ok === false ? 'low' : ''} /><b style={{ left: `${target}%` }} /></div>
      <div className="bullet-foot"><span>Target {targetLabel}</span></div>
      <p className="k-note">{note}</p>
    </article>
  );
}

export default function Kpis() {
  const { data: k, loading, error } = useLive(async () => { await sweepNoShows(); return rpc<any>('kpis'); }, [], 30000);
  if (loading && !k) return <ScreenLoading title="Overview" blocks={[40, 240, 240]} />;
  const pct = (a: number, b: number) => (b ? Math.round((a / b) * 100) : null);
  const rep = pct(k?.replaced_in_time ?? 0, k?.no_shows ?? 0);
  const full = pct(k?.visits_full ?? 0, k?.visits_due ?? 0);
  const renew = pct(k?.families_renewed ?? 0, k?.families_first_block ?? 0);
  const mins = k?.alert_minutes;
  return (
    <Screen title="Overview" sub={`The four success measures from the BRD, last 30 days. Updated ${time(new Date())}.`} wide>
      <div className="stack-lg">
        <ErrorBox msg={error} />
        {k && <>
          <div className="summary">
            <Link to="/k" style={{ textDecoration: 'none' }}>{k.open_alerts ? <Pill tone="bad" dot>{k.open_alerts} open {k.open_alerts === 1 ? 'alert' : 'alerts'}</Pill> : <Pill tone="ok" dot>No open alerts</Pill>}</Link>
            <Link to="/a/escalations" style={{ textDecoration: 'none' }}>{k.escalations ? <Pill tone="bad" dot>{k.escalations} escalated</Pill> : <Pill dot>Nothing escalated</Pill>}</Link>
          </div>
          <div className="kpis">
            <Kpi title="Minutes from a missed shift to the family alert" value={mins == null ? '–' : String(mins)} unit={mins == null ? '' : 'min average'}
              pct={mins == null ? null : Math.min(100, (mins / 60) * 100)} target={50} targetLabel="30 minutes or less" lowerIsBetter
              note={`Alerts fire ${k.no_show_minutes} minutes after a shift starts without a check-in.`} />
            <Kpi title="Missed shifts replaced within 4 hours" value={`${k.replaced_in_time} of ${k.no_shows}`} pct={rep} target={90} targetLabel="90%"
              note={rep == null ? 'No missed shifts in the last 30 days.' : `${rep}% replaced in time.`} />
            <Kpi title="Visits with check-in, photo and task log" value={`${k.visits_full} of ${k.visits_due}`} pct={full} target={95} targetLabel="95%"
              note={full == null ? 'No visits yet.' : `${full}% of visits fully recorded.`} />
            <Kpi title="Families renewing after the first block" value={`${k.families_renewed} of ${k.families_first_block}`} pct={renew} target={60} targetLabel="60% within 12 months"
              note={renew == null ? 'No first blocks have ended yet.' : `${renew}% renewed.`} />
          </div>
          <p className="note"><Icon name="info" size="sm" /><span>Calculated in the database from shifts, visits, alerts and bookings, so the numbers match what families and coordinators see.</span></p>
        </>}
      </div>
    </Screen>
  );
}
