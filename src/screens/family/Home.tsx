import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { useLive, sweepNoShows } from '../../lib/hooks';
import { addDays, dayLabel, dayNum, firstName, greeting, initials, parentLabel, shortDate, time, todayIST, weekday } from '../../lib/format';
import Icon from '../../components/Icon';
import { Avatar, Empty, ErrorBox, Pill } from '../../components/ui';
import { Screen, ScreenLoading } from '../../components/layout';
import { currentBooking, loadFamilyOverview } from './booking';

type Data = Awaited<ReturnType<typeof loadFamilyOverview>>;
type Status = { tone: 'ok' | 'bad' | 'wait' | ''; head: string; sub: string; live?: boolean; shift: any; visit: any };

/** What is happening with this parent right now, in one sentence and one supporting line. */
export function parentStatus(parentId: string, data: Data): Status {
  const today = todayIST();
  const mins = data.settings?.no_show_minutes ?? 30;
  const open = data.alerts.filter(a => a.parent_id === parentId && !a.resolved_at);
  const esc = open.find(a => a.level === 'escalated');
  const sos = open.find(a => a.type === 'sos');
  const ns = open.find(a => a.type === 'no_show');
  const todays = data.shifts.filter(s => s.parent_id === parentId && s.shift_date === today && s.status !== 'reassigned');
  const rep = todays.find(s => s.replacement_of && ['scheduled', 'checked_in', 'completed'].includes(s.status));
  const shift = todays.find(s => s.status === 'checked_in') || rep || todays.find(s => s.status === 'scheduled') || todays.find(s => s.status === 'completed') || todays.find(s => s.status === 'missed');
  const visit = shift && data.visits.find(v => v.shift_id === shift.id);
  const cg = firstName(shift?.caregiver?.name || 'The caregiver');
  const missedCg = firstName(todays.find(s => s.id === ns?.shift_id)?.caregiver?.name || 'The caregiver');
  if (sos) return { tone: 'bad', live: true, head: `SOS pressed at ${time(sos.raised_at)}`, sub: 'Your coordinator is calling now. This page updates when it is handled.', shift, visit };
  if (esc) return { tone: 'bad', live: true, head: 'The replacement has not arrived either', sub: 'Escalated to the Care Operations head, who is arranging a senior caregiver.', shift, visit };
  if (ns) return { tone: 'bad', live: true, head: `${missedCg} has not checked in`, sub: 'KinCare is assigning a verified replacement. You do not need to call anyone.', shift, visit };
  if (rep && rep.status === 'scheduled') return { tone: 'wait', live: true, head: `${cg} is on the way`, sub: `Replacement caregiver, arriving by ${time(rep.start_at)}.`, shift, visit };
  if (shift?.status === 'checked_in') return { tone: 'ok', live: true, head: `${cg} checked in at ${time(visit?.check_in_at)}`, sub: 'Location and door photo recorded. With your parent until ' + time(shift.end_at) + '.', shift, visit };
  if (shift?.status === 'completed') return { tone: 'ok', head: 'Today’s visit is complete', sub: `${cg} checked out at ${time(visit?.check_out_at)}.`, shift, visit };
  if (shift?.status === 'scheduled') {
    const late = new Date(shift.start_at).getTime() < Date.now();
    return { tone: 'wait', head: late ? `${cg} was due at ${time(shift.start_at)}` : `${cg} is due at ${time(shift.start_at)}`,
      sub: `You will be alerted if there is no check-in by ${time(new Date(new Date(shift.start_at).getTime() + mins * 60000))}.`, shift, visit };
  }
  return { tone: '', head: 'No care booked for today', sub: 'Book a verified caregiver to see visits here.', shift: null, visit: null };
}

export default function FamilyHome() {
  const { profile } = useAuth();
  const { data, error, loading } = useLive(async () => { await sweepNoShows(); return loadFamilyOverview(); }, [], 15000);
  const [sel, setSel] = useState<string | null>(null);
  const today = todayIST();
  const title = `${greeting()}, ${firstName(profile?.full_name)}`;

  if (loading && !data) return <ScreenLoading title={title} blocks={[300, 180]} />;
  const parents = data?.parents ?? [];
  const parent = parents.find(p => p.id === sel) || parents[0];
  const open = (data?.alerts ?? []).filter(a => !a.resolved_at);

  return (
    <Screen title={title} sub={dayLabel(today)} wide>
      <div className="stack-lg" style={{ maxWidth: 1040 }}>
        <ErrorBox msg={error} />
        {open.length > 0 && (
          <div className="stack">
            {open.map(a => {
              const p = parents.find(x => x.id === a.parent_id);
              const who = parentLabel(p);
              const head = a.type === 'sos' ? `${who} pressed SOS at ${time(a.raised_at)}` : a.level === 'escalated' ? `${who}: the replacement has not arrived` : `${who}: no check-in`;
              const body = a.type === 'sos' ? 'Your coordinator is calling now. See the latest.' : a.level === 'escalated' ? 'The Care Operations head is handling this. See the latest.' : `Raised at ${time(a.raised_at)}. Follow the replacement here.`;
              return <Link key={a.id} className="alert" to={`/f/alert/${a.id}`}><Icon name="warn" /><span className="a-t"><b>{head}</b><span>{body}</span></span><Icon name="chev" className="ic chev" /></Link>;
            })}
          </div>
        )}
        {data && data.alerts.filter(a => a.resolved_at && a.type === 'no_show' && a.replacement_shift_id).slice(0, 1).map(a => {
          const rep = data.shifts.find(s => s.id === a.replacement_shift_id);
          if (!rep || rep.status !== 'scheduled') return null;
          return <Link key={a.id} className="alert calm" to={`/f/alert/${a.id}`}><Icon name="clock" /><span className="a-t"><b>Replacement on the way</b><span>{rep.caregiver?.name} arrives by {time(rep.start_at)}.</span></span><Icon name="chev" className="ic chev" /></Link>;
        })}

        {!parent ? (
          <div className="panel">
            <Empty icon="users" title="Add your parent to get started" action={<Link className="btn" to="/f/add-parent"><Icon name="plus" size="sm" />Add a parent</Link>}>
              Their address and your consent let us match verified caregivers near them.
            </Empty>
          </div>
        ) : (
          <>
            {parents.length > 1 && (
              <div className="switcher" role="group" aria-label="Choose a parent">
                {parents.map(p => <button key={p.id} className="chip" aria-pressed={p.id === parent.id} onClick={() => setSel(p.id)}>{parentLabel(p)}</button>)}
              </div>
            )}
            <div className="cols">
              <StatusPanel parent={parent} data={data!} />
              <div className="stack-lg">
                <BlockPanel parent={parent} data={data!} />
                <section className="section" aria-labelledby="more-h">
                  <div className="sec-head"><h2 id="more-h">Your family</h2></div>
                  <div className="panel flush">
                    {parents.map(p => (
                      <button key={p.id} className="li" onClick={() => { setSel(p.id); window.scrollTo({ top: 0, behavior: 'smooth' }); }} aria-current={p.id === parent.id ? 'true' : undefined}>
                        <Avatar text={initials(p.name)} size="sm" />
                        <span className="li-t"><b>{parentLabel(p) === p.name ? p.name : `${parentLabel(p)} (${p.name})`}</b><span>{p.age}, {area(p.address)} {p.pin_code}</span></span>
                        {p.id === parent.id && <Pill tone="brand">Showing</Pill>}
                      </button>
                    ))}
                    <Link className="li" to="/f/add-parent"><span className="av sm grey"><Icon name="plus" size="sm" /></span><span className="li-t"><b>Add a parent</b><span>Profile, care needs and consent</span></span><Icon name="chev" size="sm" className="ic-sm chev" /></Link>
                  </div>
                </section>
              </div>
            </div>
          </>
        )}
      </div>
    </Screen>
  );
}

const area = (address: string) => address.split(',').slice(-2).join(',').trim();

function StatusPanel({ parent, data }: { parent: any; data: Data }) {
  const st = parentStatus(parent.id, data);
  const tasks: string[] = parent.care_tasks || [];
  const doneMap: Record<string, string> = st.visit?.tasks || {};
  const done = tasks.filter(t => doneMap[t]).length;
  const r = st.visit && data.readings.find(x => x.visit_id === st.visit.id);
  return (
    <section className="status" aria-label={`${parentLabel(parent)} today`}>
      <div className="status-top">
        <Avatar text={initials(parent.name)} size="lg" />
        <div className="grow">
          <div className="s-name">{parentLabel(parent) === parent.name ? parent.name : `${parentLabel(parent)} (${parent.name})`}</div>
          <div className="s-meta">{parent.age}, {area(parent.address)} {parent.pin_code}</div>
        </div>
      </div>
      <div className={'status-now ' + st.tone} role="status" aria-live="polite">
        <span className={'beacon' + (st.live ? ' live' : '')} />
        <div><b>{st.head}</b><span className="sn-sub">{st.sub}</span></div>
      </div>
      {st.shift && tasks.length > 0 && (
        <div className="plan">
          <div className="plan-head"><b>Today’s care plan</b><span>{done} of {tasks.length} done</span></div>
          <div className="plan-bar" aria-hidden="true">{tasks.map(t => <i key={t} className={doneMap[t] ? 'on' : ''} />)}</div>
          <ul className="plan-list">
            {tasks.map(t => (
              <li key={t} className={doneMap[t] ? 'done' : ''}>
                <span className="tick"><Icon name="check" className="" /></span>
                <span className="p-name">{t}</span>
                <span className="t-time">{doneMap[t] ? time(doneMap[t]) : 'Not yet'}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
      {r && (
        <div className="vitals-row">
          {r.bp_systolic && <div className="vital"><b>{r.bp_systolic}/{r.bp_diastolic}</b><span>BP, mmHg, {time(r.recorded_at)}</span></div>}
          {r.sugar && <div className="vital"><b>{r.sugar}</b><span>Sugar, mg/dL, {time(r.recorded_at)}</span></div>}
        </div>
      )}
      <div className="status-foot">
        {st.shift
          ? <Link className="btn secondary" to={`/f/timeline/${parent.id}`}><Icon name="tl" size="sm" />See today’s visit record</Link>
          : <Link className="btn" to="/f/book">Book care for {parentLabel(parent)}</Link>}
      </div>
    </section>
  );
}

function BlockPanel({ parent, data }: { parent: any; data: Data }) {
  const today = todayIST();
  const b = currentBooking(data.bookings, parent.id);
  const ended = data.bookings.find(x => x.parent_id === parent.id && x.end_date < today && !x.rating && x.status !== 'cancelled');
  if (!b) {
    return (
      <section className="section" aria-labelledby="blk-h">
        <div className="sec-head"><h2 id="blk-h">Care block</h2></div>
        <div className="panel">
          {ended ? (
            <Empty icon="star" title={`${firstName(ended.caregiver?.name)}’s block has ended`} action={<Link className="btn" to={`/f/renew/${ended.id}`}>Rate and renew</Link>}>
              Rate the care {parentLabel(parent)} received, then renew for another 14 days or end the booking.
            </Empty>
          ) : (
            <Empty icon="cal" title="No care booked" action={<Link className="btn" to="/f/book">Book a verified caregiver</Link>}>
              Bookings run for at least 14 days, with a 12- or 24-hour shift each day.
            </Empty>
          )}
        </div>
      </section>
    );
  }
  const shifts = data.shifts.filter(s => s.booking_id === b.id && !s.replacement_of);
  const byDate = new Map<string, any>(shifts.map(s => [s.shift_date, s]));
  const days = Array.from({ length: b.days }, (_, i) => addDays(b.start_date, i));
  const started = b.start_date <= today;
  const dayNo = Math.min(b.days, Math.round((Date.parse(today) - Date.parse(b.start_date)) / 864e5) + 1);
  const left = Math.round((Date.parse(b.end_date) - Date.parse(today)) / 864e5);
  return (
    <section className="section" aria-labelledby="blk-h">
      <div className="sec-head"><h2 id="blk-h">Care block</h2>{started ? <Pill tone="brand">Day {dayNo} of {b.days}</Pill> : <Pill tone="warn">Starts {shortDate(b.start_date)}</Pill>}</div>
      <div className="panel pad">
        <div className="row">
          <Avatar text={b.caregiver?.initials || '?'} tone="brand" />
          <div className="grow"><b className="strong">{b.caregiver?.name}</b><div className="t-sm muted">{b.shift_hours}-hour shifts, {shortDate(b.start_date)} to {shortDate(b.end_date)}</div></div>
        </div>
        <div className="block-days" role="list" aria-label="Days in this block">
          {days.map(d => {
            const s = byDate.get(d);
            const cls = d === today ? 'today' : s?.status === 'missed' ? 'miss' : d < today ? 'done' : 'future';
            const lab = d === today ? 'today' : s?.status === 'missed' ? 'missed' : d < today ? 'visit recorded' : 'upcoming';
            return <div key={d} className={'bd ' + cls} role="listitem" aria-label={`${dayLabel(d)}, ${lab}`}><small>{weekday(d).slice(0, 2)}</small><b>{dayNum(d)}</b><i /></div>;
          })}
        </div>
        <div className="legend" aria-hidden="true">
          <span><i style={{ background: 'var(--ok)' }} />Visit recorded</span>
          <span><i style={{ background: 'var(--bad)' }} />Missed, replaced</span>
          <span><i style={{ background: 'var(--line)' }} />Upcoming</span>
        </div>
        {left <= 3 && (
          <div className="callout warn" style={{ marginTop: 16 }}>
            <Icon name="cal" />
            <div className="grow"><b>Block ends {left <= 0 ? 'today' : shortDate(b.end_date)}</b><div>Rate {firstName(b.caregiver?.name)} and renew so care continues without a gap.</div>
              <Link className="btn sm" style={{ marginTop: 10 }} to={`/f/renew/${b.id}`}>Rate and renew</Link></div>
          </div>
        )}
      </div>
    </section>
  );
}
