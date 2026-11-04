import { Link } from 'react-router-dom';
import { rpc } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { useLive } from '../../lib/hooks';
import { dayLabel, firstName, initials, time, todayIST, istDateOf } from '../../lib/format';
import Icon, { taskIcon } from '../../components/Icon';
import { Avatar, ErrorBox, Loading } from '../../components/ui';

export const loadShifts = () => rpc<any[]>('caregiver_shifts');

export default function CaregiverToday() {
  const { profile, signOut } = useAuth();
  const { data, loading, error } = useLive(loadShifts, [], 20000);
  if (loading && !data) return <div className="shell"><Loading /></div>;
  const shifts = data ?? [];
  const current = shifts.find(s => s.is_current && ['scheduled', 'checked_in'].includes(s.status)) || shifts.find(s => s.is_current);
  const upcoming = shifts.filter(s => s !== current && new Date(s.start_at) > new Date() && s.status === 'scheduled').slice(0, 5);

  return (
    <div className="shell"><main className="page stack">
      <div className="row between">
        <div><p className="muted small" style={{ margin: 0 }}>{dayLabel(todayIST())}</p><h1 className="hello">Vanakkam, {firstName(profile?.full_name)}</h1></div>
        <button className="iconbtn" aria-label="Sign out" onClick={signOut}><Icon name="logout" /></button>
      </div>
      <ErrorBox msg={error} />
      {current ? <CurrentShift s={current} /> : (
        <div className="surface"><b>No shift right now</b>
          {upcoming[0]
            ? <><div className="kv"><span>Your next shift</span><span>{dayLabel(istDateOf(upcoming[0].start_at))}, {time(upcoming[0].start_at)}</span></div>
                <div className="kv"><span>With</span><span>{upcoming[0].parent_name}</span></div>
                <p className="tiny" style={{ margin: '6px 0 0' }}>The address appears when the shift starts.</p></>
            : <p className="small muted" style={{ margin: '4px 0 0' }}>You have no shifts booked. Your coordinator will add them here.</p>}
        </div>
      )}
      {current && upcoming.length > 0 && (
        <div className="surface"><b>Coming up</b>
          {upcoming.map(s => <div className="kv" key={s.shift_id}><span>{dayLabel(istDateOf(s.start_at)).split(',')[0]}, {time(s.start_at)}</span><span>{s.parent_name}</span></div>)}
          <p className="tiny" style={{ margin: '6px 0 0' }}>Addresses appear only when each shift starts.</p>
        </div>
      )}
    </main></div>
  );
}

function CurrentShift({ s }: { s: any }) {
  const tasks: string[] = s.care_tasks || [];
  const graceOver = new Date(s.start_at).getTime() < Date.now();
  return (
    <>
      <div className="cg-hero">
        <div className="row between"><b>{s.replacement_of ? 'Replacement shift' : 'Today’s shift'}</b><span className="tiny" style={{ color: 'var(--marigold-deep)' }}>{time(s.start_at)} to {time(s.end_at)}</span></div>
        <div className="row" style={{ marginTop: 10 }}><Avatar text={initials(s.parent_name)} /><div><b>{s.parent_name}</b><div className="small muted">{(s.care_needs || []).join(', ')}</div></div></div>
        {s.address && <div className="addr"><Icon name="pin" size="sm" /><div className="small"><b>{s.address}</b>, {s.pin_code}<br /><span className="muted">Shown only for your current shift</span></div></div>}
      </div>
      {s.status === 'scheduled' && <>
        <Link className="btn" to={`/c/check-in/${s.shift_id}`}><Icon name="pin" size="sm" />Check in</Link>
        <p className="tiny center" style={{ margin: 0 }}>{graceOver ? 'You are late. Check in now so the family is not alerted.' : 'Check in at the door. The family is alerted if you have not checked in soon after the start time.'}</p>
      </>}
      {s.status === 'checked_in' && <>
        <div className="surface"><div className="row between"><b>Checked in at {time(s.check_in_at)}</b><span className="vbadge"><Icon name="check" />Location and photo</span></div></div>
        <Link className="btn" to={`/c/visit/${s.shift_id}`}>Continue: tasks and readings</Link>
      </>}
      {s.status === 'completed' && <div className="surface"><b>Shift complete</b><p className="small muted" style={{ margin: '4px 0 0' }}>You checked out at {time(s.check_out_at)}. Thank you.</p></div>}
      {s.status === 'missed' && <div className="surface"><b>This shift was marked missed</b><p className="small muted" style={{ margin: '4px 0 0' }}>No check-in was recorded in time, so the coordinator assigned cover. Call your coordinator if this is wrong.</p></div>}
      {tasks.length > 0 && (
        <div className="surface"><b>Care plan</b>
          {tasks.map(t => <div className="row" style={{ marginTop: 10 }} key={t}><Icon name={taskIcon(t)} /><span className="small">{t}</span></div>)}
        </div>
      )}
    </>
  );
}
