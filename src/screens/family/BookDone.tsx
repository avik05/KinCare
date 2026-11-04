import { Link, useParams } from 'react-router-dom';
import { q, supabase } from '../../lib/supabase';
import { useLive } from '../../lib/hooks';
import { dayLabel } from '../../lib/format';
import { CheckAnim, Loading } from '../../components/ui';

export default function BookDone() {
  const { bookingId } = useParams();
  const { data: b, loading } = useLive(async () => {
    const b = await q<any>(supabase.from('bookings').select('days, start_date, shift_hours, caregiver:caregivers(name), parent:parents(name)').eq('id', bookingId).single());
    const n = await supabase.from('shifts').select('id', { count: 'exact', head: true }).eq('booking_id', bookingId);
    const s = await q<any>(supabase.from('settings').select('no_show_minutes').single());
    return { ...b, shifts: n.count, mins: s.no_show_minutes };
  }, [bookingId], 0);
  if (loading || !b) return <div className="shell"><Loading /></div>;
  return (
    <div className="shell"><main className="page" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="center">
        <CheckAnim />
        <h1 className="bigtitle">Booking confirmed</h1>
        <p className="muted" style={{ maxWidth: '30ch', margin: '0 auto' }}>{b.caregiver?.name} will care for {b.parent?.name} for {b.days} days from {dayLabel(b.start_date)}. You will see every visit on the timeline.</p>
      </div>
      <div className="surface" style={{ marginTop: 22 }}>
        <div className="kv"><span>Shifts created</span><span>{b.shifts}</span></div>
        <div className="kv"><span>Shift starts</span><span>8:00 am daily</span></div>
        <div className="kv"><span>If no check-in by 8:{String(b.mins).padStart(2, '0')}</span><span>You are alerted</span></div>
      </div>
      <div style={{ marginTop: 'auto', paddingTop: 18 }}><Link className="btn" to="/f">Back to home</Link></div>
    </main></div>
  );
}
