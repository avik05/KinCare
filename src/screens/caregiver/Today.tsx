import { Link } from 'react-router-dom';
import { rpc } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { useLive } from '../../lib/hooks';
import { dayLabel, firstName, initials, istDateOf, relDay, time, todayIST } from '../../lib/format';
import Icon, { taskIcon } from '../../components/Icon';
import { Avatar, Empty, ErrorBox, Pill } from '../../components/ui';
import { Screen, ScreenLoading } from '../../components/layout';

export const loadShifts = () => rpc<any[]>('caregiver_shifts');
const mapsUrl = (address: string, pin: string) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${address} ${pin}`)}`;

export default function CaregiverToday() {
  const { profile } = useAuth();
  const { data, loading, error } = useLive(loadShifts, [], 20000);
  const title = `Vanakkam, ${firstName(profile?.full_name)}`;
  if (loading && !data) return <ScreenLoading title={title} blocks={[300, 160]} />;
  const shifts = data ?? [];
  const current = shifts.find(s => s.is_current && ['scheduled', 'checked_in'].includes(s.status)) || shifts.find(s => s.is_current);
  const upcoming = shifts.filter(s => s !== current && new Date(s.start_at) > new Date() && s.status === 'scheduled').slice(0, 6);

  return (
    <Screen title={title} sub={dayLabel(todayIST())}>
      <div className="stack-lg">
        <ErrorBox msg={error} />
        {current ? <CurrentShift s={current} /> : (
          <div className="panel">
            <Empty icon="cal" title="No shift right now">
              {upcoming[0] ? `Your next shift is ${relDay(istDateOf(upcoming[0].start_at)).toLowerCase()} at ${time(upcoming[0].start_at)}, with ${upcoming[0].parent_name}. The address appears when the shift starts.` : 'You have no shifts booked. Your coordinator will add them here.'}
            </Empty>
          </div>
        )}
        {upcoming.length > 0 && (
          <section className="section" aria-labelledby="up-h">
            <div className="sec-head"><h2 id="up-h">Coming up</h2><span className="t-xs">Addresses appear when each shift starts</span></div>
            <div className="panel flush">
              {upcoming.map(s => (
                <div className="li" key={s.shift_id}>
                  <span className="av sm grey">{initials(s.parent_name)}</span>
                  <span className="li-t"><b>{s.parent_name}</b><span>{relDay(istDateOf(s.start_at))}, {time(s.start_at)} to {time(s.end_at)}</span></span>
                  {s.replacement_of && <Pill tone="warn">Cover</Pill>}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </Screen>
  );
}

function CurrentShift({ s }: { s: any }) {
  const tasks: string[] = s.care_tasks || [];
  const done: Record<string, string> = s.tasks || {};
  const late = new Date(s.start_at).getTime() < Date.now();
  return (
    <>
      <section className="shift" aria-label="Current shift">
        <div className="shift-time"><b>{time(s.start_at)} to {time(s.end_at)}{istDateOf(s.end_at) !== istDateOf(s.start_at) ? ' tomorrow' : ''}</b><span>{s.replacement_of ? 'Replacement shift' : 'Today’s shift'}</span></div>
        <div className="shift-who">
          <Avatar text={initials(s.parent_name)} size="lg" />
          <div className="grow"><b>{s.parent_name}</b><span className="t-sm muted">{(s.care_needs || []).join(', ') || 'No special needs noted'}</span></div>
        </div>
        {s.address && (
          <div className="shift-addr">
            <Icon name="pin" />
            <div className="grow"><b className="strong">{s.address}, {s.pin_code}</b>
              <div className="t-xs faint" style={{ marginTop: 2 }}>Shown only during your shift</div>
              <a className="btn secondary sm" style={{ marginTop: 10 }} href={mapsUrl(s.address, s.pin_code)} target="_blank" rel="noreferrer"><Icon name="map" size="sm" />Open in Maps</a></div>
          </div>
        )}
        <div className="shift-act">
          {s.status === 'scheduled' && <>
            <Link className="btn lg block" to={`/c/check-in/${s.shift_id}`}><Icon name="door" />Check in at the door</Link>
            <p className={'t-sm center ' + (late ? '' : 'muted')} style={late ? { color: 'var(--bad-ink)', fontWeight: 500 } : undefined}>
              {late ? 'Your shift has started. Check in now so the family is not alerted.' : 'Check in when you reach the door. You can check in up to an hour early.'}</p>
          </>}
          {s.status === 'checked_in' && <>
            <div className="callout brand"><Icon name="check" /><div><b>Checked in at {time(s.check_in_at)}</b><div>Location and door photo sent to the family.</div></div></div>
            <Link className="btn lg block" to={`/c/visit/${s.shift_id}`}>Log tasks and readings</Link>
          </>}
          {s.status === 'completed' && <div className="callout brand"><Icon name="check" /><div><b>Shift complete</b><div>You checked out at {time(s.check_out_at)}. Thank you.</div></div></div>}
          {s.status === 'missed' && <div className="callout warn"><Icon name="warn" /><div><b>This shift was marked missed</b><div>No check-in was recorded in time, so cover was arranged. Call your coordinator if this is wrong.</div></div></div>}
        </div>
      </section>
      {tasks.length > 0 && s.status !== 'missed' && (
        <section className="section" aria-labelledby="plan-h">
          <div className="sec-head"><h2 id="plan-h">Care plan</h2><span className="t-xs">{Object.keys(done).length} of {tasks.length} done</span></div>
          <div className="panel flush">
            {tasks.map(t => (
              <div className="li" key={t}><span className="av sm grey"><Icon name={taskIcon(t)} size="sm" /></span><span className="li-t"><b style={{ fontWeight: 500 }}>{t}</b></span>
                {done[t] ? <Pill tone="ok"><Icon name="check" size="sm" />{time(done[t])}</Pill> : <span className="li-end t-sm">To do</span>}</div>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
