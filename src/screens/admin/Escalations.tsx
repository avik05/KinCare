import { Link } from 'react-router-dom';
import { useLive } from '../../lib/hooks';
import { time } from '../../lib/format';
import Icon from '../../components/Icon';
import { AppBar, ErrorBox, Loading } from '../../components/ui';
import { StaffTabs } from '../coordinator/staff';
import { loadAlerts } from '../coordinator/Alerts';

/** BR5: a replacement that also misses check-in comes straight to the Care Operations head. */
export default function Escalations() {
  const { data, loading, error } = useLive(async () => (await loadAlerts()).filter(a => a.level === 'escalated'), [], 10000);
  if (loading && !data) return <div className="shell"><Loading /></div>;
  const open = (data ?? []).filter(a => !a.resolved_at);
  const done = (data ?? []).filter(a => a.resolved_at);
  return (
    <div className="shell"><main className="page stack">
      <AppBar title="Escalations" />
      <ErrorBox msg={error} />
      {open.length === 0 && <div className="surface empty">Nothing escalated. A case lands here when a replacement caregiver also misses check-in.</div>}
      {open.map(a => (
        <div className="qitem bad" key={a.id} style={{ display: 'block' }}>
          <div className="row between"><b>{a.parent?.name}, {a.parent?.pin_code}</b><span className="timer">Second miss</span></div>
          <ol className="steps" style={{ marginTop: 12 }}>
            <li className="step bad"><span className="sdot"><Icon name="x" size="sm" /></span><div><h4>First caregiver missed</h4><p>A replacement was assigned by the coordinator</p></div></li>
            <li className="step bad"><span className="sdot"><Icon name="x" size="sm" /></span><div><h4>{a.shift?.caregiver?.name} missed {time(a.shift?.start_at)}</h4><p>No check-in, escalated at {time(a.raised_at)}</p></div></li>
            <li className="step now"><span className="sdot" /><div><h4>Your decision</h4><p>Send a senior caregiver and call the family: {a.parent?.family?.full_name}, {a.parent?.family?.phone ?? 'no number'}</p></div></li>
          </ol>
          <Link className="btn" to={`/k/assign/${a.id}`}>Choose a caregiver</Link>
        </div>
      ))}
      {done.length > 0 && <h2 className="daylabel">Resolved today</h2>}
      {done.map(a => <div className="qitem" key={a.id}><span className="sev done" /><div className="grow"><b>{a.parent?.name}</b><p className="small muted" style={{ margin: '2px 0 0' }}>{a.note}</p></div></div>)}
    </main><StaffTabs escalation={open.length > 0} /></div>
  );
}
