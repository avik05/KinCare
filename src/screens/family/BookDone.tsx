import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { q, supabase } from '../../lib/supabase';
import { useLive } from '../../lib/hooks';
import { dayLabel, firstName, parentLabel, time } from '../../lib/format';
import { DoneMark, ErrorBox } from '../../components/ui';
import { Screen, ScreenLoading } from '../../components/layout';
import { useDraft } from './booking';

export default function BookDone() {
  const { bookingId } = useParams();
  const { reset } = useDraft();
  useEffect(() => { reset(); }, []);
  const { data: b, loading, error } = useLive(async () => {
    const b = await q<any>(supabase.from('bookings').select('days, start_date, shift_hours, parent_id, caregiver:caregivers(name), parent:parents(name, relation)').eq('id', bookingId).single());
    const n = await supabase.from('shifts').select('id', { count: 'exact', head: true }).eq('booking_id', bookingId);
    const s = await q<any>(supabase.from('settings').select('no_show_minutes').single());
    return { ...b, shifts: n.count, mins: s.no_show_minutes };
  }, [bookingId], 0);
  if (loading) return <ScreenLoading title="Booking confirmed" blocks={[200, 140]} />;
  if (!b) return <Screen title="Booking" back="/f"><ErrorBox msg={error || 'This booking could not be found.'} /></Screen>;
  const alertAt = time(new Date(Date.parse(`${b.start_date}T08:00:00+05:30`) + b.mins * 60000));
  return (
    <Screen title="Booking confirmed" back="/f" backLabel="Home"
      footer={<div className="row" style={{ gap: 8 }}>
        <Link className="btn secondary" style={{ flex: 1 }} to={`/f/timeline/${b.parent_id}`}>See visits</Link>
        <Link className="btn" style={{ flex: 1 }} to="/f">Go to home</Link>
      </div>}>
      <div className="stack-lg">
        <div className="panel pad center">
          <DoneMark />
          <p className="t-lg">{firstName(b.caregiver?.name)} will care for {parentLabel(b.parent)}</p>
          <p className="muted" style={{ marginTop: 6 }}>{b.days} days from {dayLabel(b.start_date)}. Every check-in, task and reading will show on the visits page.</p>
        </div>
        <section className="section" aria-labelledby="next-h">
          <div className="sec-head"><h2 id="next-h">What happens next</h2></div>
          <div className="panel">
            <div className="kv"><span>Shifts booked</span><span>{b.shifts}</span></div>
            <div className="kv"><span>Each shift starts</span><span>8:00 am</span></div>
            <div className="kv"><span>If there is no check-in by {alertAt}</span><span>You are alerted</span></div>
          </div>
        </section>
      </div>
    </Screen>
  );
}
