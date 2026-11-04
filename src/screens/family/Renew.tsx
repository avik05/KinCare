import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { q, rpc, supabase } from '../../lib/supabase';
import { useLive } from '../../lib/hooks';
import { firstName, shortDate } from '../../lib/format';
import Icon from '../../components/Icon';
import { AppBar, Avatar, CheckAnim, ErrorBox, Loading, useToast } from '../../components/ui';

export default function Renew() {
  const { bookingId } = useParams();
  const toast = useToast();
  const { data: b, loading } = useLive(() => q<any>(supabase.from('bookings').select('*, caregiver:caregivers(name, initials), parent:parents(name, relation)').eq('id', bookingId).single()), [bookingId], 0);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<'renew' | 'end' | null>(null);
  if (loading || !b) return <div className="shell"><Loading /></div>;
  const cg = firstName(b.caregiver?.name);
  const who = b.parent?.relation !== 'Parent' ? b.parent?.relation : b.parent?.name;

  async function finish(renew: boolean) {
    setBusy(true); setErr(null);
    try {
      await rpc('finish_block', { p_booking: b.id, p_rating: rating, p_comment: comment, p_renew: renew });
      setDone(renew ? 'renew' : 'end'); toast(renew ? `Renewed for 14 days with ${cg}` : 'Thanks for your rating');
    } catch (x: any) { setErr(x.message); } finally { setBusy(false); }
  }

  return (
    <div className="shell"><main className="page stack">
      <AppBar title={`Block ends ${shortDate(b.end_date)}`} back="/f" />
      <div className="surface center">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 8 }}><Avatar text={b.caregiver?.initials} tone="leaf" size="lg" /></div>
        <b>How has {cg} been with {who}?</b>
        <div className="stars" role="radiogroup" aria-label="Rating" style={{ marginTop: 10 }}>
          {[1, 2, 3, 4, 5].map(i => <button key={i} className={'star' + (rating >= i ? ' on' : '')} role="radio" aria-checked={rating === i} aria-label={`${i} star${i > 1 ? 's' : ''}`} disabled={!!done} onClick={() => setRating(i)}><Icon name="star" className="" /></button>)}
        </div>
        <label className="sr" htmlFor="comment">Comment</label>
        <textarea className="field" id="comment" style={{ marginTop: 12, minHeight: 70, resize: 'none' }} placeholder="Optional comment" value={comment} onChange={e => setComment(e.target.value)} disabled={!!done} />
      </div>
      <ErrorBox msg={err} />
      {done ? (
        <div className="surface center"><CheckAnim size={64} /><b>{done === 'renew' ? `Renewed: 14 more days with ${cg}` : `The booking ends on ${shortDate(b.end_date)}`}</b>
          <Link className="btn ghost" style={{ marginTop: 12 }} to="/f">Back to home</Link></div>
      ) : (
        <>
          <button className="btn" disabled={!rating || busy} onClick={() => finish(true)}>Renew 14 days with {cg}</button>
          <button className="btn ghost" disabled={!rating || busy} onClick={() => finish(false)}>End after this block</button>
          {!rating && <p className="tiny center" style={{ margin: 0 }}>Choose a rating first.</p>}
        </>
      )}
    </main></div>
  );
}
