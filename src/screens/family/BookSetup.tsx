import { useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { q, supabase } from '../../lib/supabase';
import { useLive } from '../../lib/hooks';
import { addDays, dayLabel, dayNum, monthShort, parentLabel, shortDate, todayIST, weekday } from '../../lib/format';
import Icon from '../../components/Icon';
import { Empty, ErrorBox } from '../../components/ui';
import { Screen, ScreenLoading } from '../../components/layout';
import { bookStep, useDraft } from './booking';

/** BR1: one active booking per address, so the first free day is the day after any active block. */
export function freeFrom(p: any) {
  const ends = (p?.bookings || []).filter((b: any) => b.status === 'active').map((b: any) => b.end_date).sort();
  const last = ends[ends.length - 1];
  const next = last ? addDays(last, 1) : todayIST(1);
  return next > todayIST(1) ? next : todayIST(1);
}

export default function BookSetup() {
  const nav = useNavigate();
  const { draft, set } = useDraft();
  const { data: parents, loading, error } = useLive(() => q<any[]>(supabase.from('parents').select('id, name, relation, address, pin_code, bookings(end_date, status)').order('created_at')), [], 0);
  useEffect(() => {
    if (!parents?.length) return;
    const p = parents.find(x => x.id === draft.parentId) || parents[0];
    if (p.id !== draft.parentId || draft.start < freeFrom(p)) set({ parentId: p.id, start: freeFrom(p) });
  }, [parents, draft.parentId]);

  if (loading) return <ScreenLoading title="Book care" blocks={[140, 64, 90, 64]} />;
  if (!parents?.length) return (
    <Screen title="Book care">
      <div className="panel"><Empty icon="users" title="Add a parent first" action={<Link className="btn" to="/f/add-parent"><Icon name="plus" size="sm" />Add a parent</Link>}>We need their address and your consent before we can match caregivers near them.</Empty></div>
    </Screen>
  );
  const sel = parents.find(p => p.id === draft.parentId) || parents[0];
  const first = freeFrom(sel);
  const dates = Array.from({ length: 7 }, (_, i) => addDays(first, i));
  const booked = first > todayIST(1);
  const end = addDays(draft.start, draft.days - 1);

  return (
    <Screen title="Book care" sub={bookStep(1)}
      footer={<>
        <div className="foot-meta"><span>{draft.days} days, {draft.hours}-hour shifts</span><span>{shortDate(draft.start)} to {shortDate(end)}</span></div>
        <button className="btn block" disabled={!draft.parentId} onClick={() => nav('/f/book/caregivers')}>See verified caregivers</button>
      </>}>
      <div className="stack-lg">
        <ErrorBox msg={error} />
        <fieldset className="fieldset">
          <legend>Who is the care for?</legend>
          <div className="stack" role="radiogroup" aria-label="Parent" style={{ gap: 8 }}>
            {parents.map(p => (
              <button key={p.id} className="choice" role="radio" aria-checked={draft.parentId === p.id} onClick={() => set({ parentId: p.id })}>
                <span className="radio" />
                <span className="ch-t"><b>{parentLabel(p) === p.name ? p.name : `${parentLabel(p)} (${p.name})`}</b><span>{p.address.split(',').slice(-2).join(',').trim()} {p.pin_code}</span></span>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="fieldset">
          <legend>Shift</legend>
          <div className="seg" role="radiogroup" aria-label="Shift length">
            <button role="radio" aria-checked={draft.hours === 12} onClick={() => set({ hours: 12 })}>12 hours, 8 am to 8 pm</button>
            <button role="radio" aria-checked={draft.hours === 24} onClick={() => set({ hours: 24 })}>24 hours, live-in</button>
          </div>
        </fieldset>

        <fieldset className="fieldset">
          <legend>Start date</legend>
          <div className="dates" role="radiogroup" aria-label="Start date">
            {dates.map(d => (
              <button key={d} className="date" role="radio" aria-checked={draft.start === d} aria-label={dayLabel(d)} onClick={() => set({ start: d })}>
                <small>{weekday(d)}</small><b>{dayNum(d)}</b><span>{monthShort(d)}</span>
              </button>
            ))}
          </div>
          {booked
            ? <p className="note" style={{ marginTop: -4 }}><Icon name="info" size="sm" /><span>Care is already booked until {shortDate(addDays(first, -1))}, so the earliest start is {dayLabel(first)}. To keep the same caregiver, renew from the home screen instead.</span></p>
            : <p className="hint" style={{ marginTop: -6 }}>The first shift starts at 8:00 am, India time.</p>}
        </fieldset>

        <fieldset className="fieldset">
          <legend>Length</legend>
          <div className="seg" role="radiogroup" aria-label="Length of booking">
            {[14, 21, 28].map(n => <button key={n} role="radio" aria-checked={draft.days === n} onClick={() => set({ days: n })}>{n} days</button>)}
          </div>
          <p className="hint" style={{ marginTop: -6 }}>Bookings start at 14 days so caregivers can plan their schedule.</p>
        </fieldset>
      </div>
    </Screen>
  );
}
