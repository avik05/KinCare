import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { useLive, sweepNoShows } from '../../lib/hooks';
import { firstName, greeting, initials, dayLabel, time, todayIST, shortDate } from '../../lib/format';
import Icon from '../../components/Icon';
import { Avatar, ErrorBox, Loading } from '../../components/ui';
import { currentBooking, FamilyTabs, loadFamilyOverview } from './booking';

export function parentStatus(parentId: string, data: any) {
  const today = todayIST();
  const open = data.alerts.filter((a: any) => a.parent_id === parentId && !a.resolved_at);
  const esc = open.find((a: any) => a.level === 'escalated');
  const sos = open.find((a: any) => a.type === 'sos');
  const ns = open.find((a: any) => a.type === 'no_show');
  const todays = data.shifts.filter((s: any) => s.parent_id === parentId && s.shift_date === today && s.status !== 'reassigned');
  const rep = todays.find((s: any) => s.replacement_of && s.status === 'scheduled');
  const active = todays.find((s: any) => s.status === 'checked_in') || rep || todays.find((s: any) => s.status === 'scheduled') || todays.find((s: any) => s.status === 'completed');
  const visit = active && data.visits.find((v: any) => v.shift_id === active.id);
  const cg = active?.caregiver?.name || 'The caregiver';
  if (esc) return { cls: 'bad', txt: 'The replacement has not arrived either. Escalated to Care Operations', active, visit };
  if (sos) return { cls: 'bad', txt: `SOS pressed at ${time(sos.raised_at)}. KinCare is calling now`, active, visit };
  if (ns) return { cls: 'bad', txt: `${firstName(todays.find((s: any) => s.id === ns.shift_id)?.caregiver?.name || 'The caregiver')} has not checked in. Assigning a replacement`, active, visit };
  if (rep) return { cls: '', txt: `${cg} is on the way, arriving by ${time(rep.start_at)}`, active, visit };
  if (active?.status === 'checked_in') return { cls: 'ok', txt: `${cg} checked in at ${time(visit?.check_in_at)}`, active, visit };
  if (active?.status === 'completed') return { cls: 'ok', txt: `Visit complete. ${firstName(cg)} checked out at ${time(visit?.check_out_at)}`, active, visit };
  if (active?.status === 'scheduled') return { cls: '', txt: `${cg} is due at ${time(active.start_at)}`, active, visit };
  return { cls: '', txt: 'No care booked for today', active: null, visit: null };
}

function Ring({ done, total }: { done: number; total: number }) {
  const C = 2 * Math.PI * 24;
  return (
    <svg className="ring" viewBox="0 0 58 58" role="img" aria-label={`${done} of ${total} tasks done`}>
      <circle className="bg" cx="29" cy="29" r="24" />
      <circle className="fg" cx="29" cy="29" r="24" strokeDasharray={C} strokeDashoffset={C * (1 - (total ? done / total : 0))} />
      <text x="29" y="34" textAnchor="middle">{done}/{total}</text>
    </svg>
  );
}

export default function FamilyHome() {
  const { profile } = useAuth();
  const { data, error, loading } = useLive(async () => { await sweepNoShows(); return loadFamilyOverview(); }, [], 15000);
  const [sel, setSel] = useState<string | null>(null);
  const today = todayIST();

  if (loading && !data) return <div className="shell"><Loading /></div>;
  const parents = data?.parents ?? [];
  const parent = parents.find(p => p.id === sel) || parents[0];
  const anyAlert = data?.alerts.some((a: any) => !a.resolved_at);

  return (
    <div className="shell">
      <main className="page stack">
        <div className="row between">
          <div><p className="muted small" style={{ margin: 0 }}>{dayLabel(today)}</p><h1 className="hello">{greeting()}, {firstName(profile?.full_name)}</h1></div>
          <Link className="iconbtn" to="/f/account" aria-label="Account and privacy"><Icon name="gear" /></Link>
        </div>
        <ErrorBox msg={error} />

        {data?.alerts.filter((a: any) => !a.resolved_at).map((a: any) => {
          const p = parents.find(x => x.id === a.parent_id);
          const title = a.level === 'escalated' ? `${p?.name}: the replacement has not arrived either` : a.type === 'sos' ? `${p?.name} pressed SOS at ${time(a.raised_at)}` : `${p?.name}: no check-in`;
          const body = a.level === 'escalated' ? 'The Care Operations head is handling this now.' : a.type === 'sos' ? 'Your coordinator is calling now.' : 'The caregiver has not arrived. KinCare is assigning a verified replacement.';
          return <Link key={a.id} className="banner" to={`/f/alert/${a.id}`}><Icon name="warn" /><span><b>{title}</b><span>{body}</span></span></Link>;
        })}
        {data?.alerts.filter((a: any) => a.resolved_at && a.type === 'no_show' && a.replacement_shift_id).slice(0, 1).map((a: any) => {
          const rep = data.shifts.find((s: any) => s.id === a.replacement_shift_id);
          if (!rep || rep.status !== 'scheduled') return null;
          return <Link key={a.id} className="banner calm" to={`/f/alert/${a.id}`}><Icon name="clock" /><span><b>Replacement on the way</b><span>{rep.caregiver?.name} arrives by {time(rep.start_at)}.</span></span></Link>;
        })}

        {!parent ? (
          <div className="surface stack center">
            <b>Add your parent to get started</b>
            <p className="muted small" style={{ margin: 0 }}>Their profile and your consent let us match verified caregivers near them.</p>
            <Link className="btn" to="/f/add-parent">Add a parent</Link>
          </div>
        ) : (
          <>
            {parents.length > 1 && (
              <div className="parent-tabs" role="group" aria-label="Choose parent">
                {parents.map(p => <button key={p.id} className="pill" aria-pressed={p.id === parent.id} onClick={() => setSel(p.id)}>{p.relation !== 'Parent' ? p.relation : p.name}</button>)}
              </div>
            )}
            <ParentCard parent={parent} data={data} />
            <BlockCard parent={parent} data={data} />
          </>
        )}

        <div className="quick">
          <Link className="qa" to={parent ? `/f/timeline/${parent.id}` : '/f/timeline'}><span className="qi"><Icon name="tl" /></span><b>Today's visit<small>Check-ins, photos, readings</small></b></Link>
          <Link className="qa" to="/f/book"><span className="qi"><Icon name="cal" /></span><b>Book care<small>Verified caregivers nearby</small></b></Link>
          <Link className="qa" to="/f/add-parent"><span className="qi"><Icon name="plus" /></span><b>Add a parent<small>Profile and consent</small></b></Link>
          <Link className="qa" to="/f/services"><span className="qi"><Icon name="grid" /></span><b>Services<small>Medicine, groceries</small></b></Link>
        </div>
        <div className="install"><Icon name="up" size="sm" /><span>Add KinCare to your home screen: open your browser's Share or menu button, then Add to Home Screen.</span></div>
      </main>
      <FamilyTabs alert={anyAlert} />
    </div>
  );
}

function ParentCard({ parent, data }: { parent: any; data: any }) {
  const st = parentStatus(parent.id, data);
  const tasks = parent.care_tasks || [];
  const done = st.visit ? Object.keys(st.visit.tasks || {}).length : 0;
  return (
    <div className="parent-card">
      <div className="row"><Avatar text={initials(parent.name)} size="lg" /><div className="grow">
        <b style={{ fontSize: 18 }}>{parent.relation !== 'Parent' ? `${parent.relation} (${parent.name})` : parent.name}</b>
        <div className="muted small">{parent.age}, {parent.address.split(',').slice(-2).join(',').trim()} {parent.pin_code}</div></div></div>
      <div className="status-line"><span className={'live ' + st.cls} /><span>{st.txt}</span></div>
      <div className="row" style={{ marginTop: 14 }}><Ring done={done} total={tasks.length} />
        <div><b>Today's care plan</b><div className="muted small">{tasks.join(', ')}</div></div></div>
    </div>
  );
}

function BlockCard({ parent, data }: { parent: any; data: any }) {
  const today = todayIST();
  const b = currentBooking(data.bookings, parent.id);
  const ended = data.bookings.find((x: any) => x.parent_id === parent.id && x.end_date < today && !x.rating);
  if (!b) {
    return (
      <div className="surface stack">
        <b>No active care block</b>
        {ended && <Link className="linkbtn" to={`/f/renew/${ended.id}`}>Rate {firstName(ended.caregiver?.name)} and renew</Link>}
        <Link className="btn ghost" to="/f/book">Book a verified caregiver</Link>
      </div>
    );
  }
  const shifts = data.shifts.filter((s: any) => s.booking_id === b.id && !s.replacement_of).sort((x: any, y: any) => x.shift_date.localeCompare(y.shift_date));
  const dayNo = Math.min(b.days, Math.max(0, Math.round((Date.parse(today) - Date.parse(b.start_date)) / 864e5) + 1));
  const left = Math.round((Date.parse(b.end_date) - Date.parse(today)) / 864e5);
  return (
    <div className="surface">
      <div className="row between"><b>Current care block</b><span className="tiny">{dayNo > 0 ? `Day ${dayNo} of ${b.days}` : `Starts ${shortDate(b.start_date)}`}</span></div>
      <div className="row" style={{ marginTop: 8 }}><Avatar text={b.caregiver?.initials || '?'} tone="leaf" size="sm" />
        <div className="small"><b>{b.caregiver?.name}</b>, {b.shift_hours}-hour shift<br /><span className="muted">{shortDate(b.start_date)} to {shortDate(b.end_date)}</span></div></div>
      <div className="daystrip" style={{ gridTemplateColumns: `repeat(${Math.max(shifts.length, 1)},1fr)` }} aria-hidden="true">
        {shifts.map((s: any) => <i key={s.id} className={s.status === 'missed' ? 'miss' : s.shift_date === today ? 'today' : s.shift_date < today ? 'done' : ''} />)}
      </div>
      {left <= 3 && <Link className="linkbtn" style={{ display: 'inline-block', marginTop: 8 }} to={`/f/renew/${b.id}`}>Block ends {left <= 0 ? 'today' : shortDate(b.end_date)}. Rate and renew</Link>}
    </div>
  );
}
