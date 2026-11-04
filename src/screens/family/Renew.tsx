import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { q, rpc, supabase } from '../../lib/supabase';
import { useLive } from '../../lib/hooks';
import { firstName, parentLabel, shortDate } from '../../lib/format';
import Icon from '../../components/Icon';
import { Avatar, Btn, DoneMark, ErrorBox, useToast } from '../../components/ui';
import { Screen, ScreenLoading } from '../../components/layout';

const WORDS = ['', 'Poor', 'Below what we expected', 'Okay', 'Good', 'Excellent'];

export default function Renew() {
  const { bookingId } = useParams();
  const toast = useToast();
  const { data: b, loading, error } = useLive(() => q<any>(supabase.from('bookings').select('*, caregiver:caregivers(name, initials), parent:parents(name, relation)').eq('id', bookingId).single()), [bookingId], 0);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState<'renew' | 'end' | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<'renew' | 'end' | null>(null);
  if (loading) return <ScreenLoading title="Rate and renew" back="/f" blocks={[220, 60]} />;
  if (!b) return <Screen title="Rate and renew" back="/f"><ErrorBox msg={error || 'This booking could not be found.'} /></Screen>;
  const cg = firstName(b.caregiver?.name);
  const who = parentLabel(b.parent);
  const already = b.rating != null;

  async function finish(renew: boolean) {
    setBusy(renew ? 'renew' : 'end'); setErr(null);
    try {
      await rpc('finish_block', { p_booking: b.id, p_rating: rating, p_comment: comment, p_renew: renew });
      setDone(renew ? 'renew' : 'end'); toast(renew ? `Renewed for 14 days with ${cg}` : 'Thanks. Your rating is saved');
    } catch (x: any) { setErr(x.message); } finally { setBusy(null); }
  }

  if (done || already) return (
    <Screen title="Rate and renew" back="/f" backLabel="Home" footer={<Link className="btn block" to="/f">Go to home</Link>}>
      <div className="panel pad center">
        <DoneMark />
        <p className="t-lg">{done === 'renew' ? `Renewed: 14 more days with ${cg}` : done === 'end' ? `The booking ends on ${shortDate(b.end_date)}` : 'This block has already been rated'}</p>
        <p className="muted" style={{ marginTop: 6 }}>{done === 'renew' ? `The new shifts follow straight on from ${shortDate(b.end_date)}. You will see them on the home screen.` : 'You can book care again at any time from Book care.'}</p>
      </div>
    </Screen>
  );

  return (
    <Screen title="Rate and renew" sub={`${cg}’s block ends ${shortDate(b.end_date)}`} back="/f" backLabel="Home"
      footer={<>
        <ErrorBox msg={err} />
        <Btn className="block" busy={busy === 'renew'} busyText="Renewing" disabled={!rating || !!busy} onClick={() => finish(true)}>Renew 14 days with {cg}</Btn>
        <Btn className="block secondary" busy={busy === 'end'} busyText="Saving" disabled={!rating || !!busy} onClick={() => finish(false)}>End after this block</Btn>
      </>}>
      <div className="stack-lg">
        <div className="panel pad center">
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><Avatar text={b.caregiver?.initials} tone="brand" size="lg" /></div>
          <p className="t-md">How has {cg} been with {who}?</p>
          <div className="stars" role="radiogroup" aria-label="Rating" style={{ marginTop: 12 }}>
            {[1, 2, 3, 4, 5].map(i => <button key={i} className={'star' + (rating >= i ? ' on' : '')} role="radio" aria-checked={rating === i} aria-label={`${i} out of 5`} onClick={() => setRating(i)}><Icon name="star" className="" /></button>)}
          </div>
          <p className="t-sm muted" style={{ minHeight: 21, marginTop: 4 }}>{rating ? WORDS[rating] : 'Choose a rating to continue'}</p>
        </div>
        <div className="field">
          <label className="label" htmlFor="comment">Comment <span className="opt">(optional)</span></label>
          <textarea className="textarea" id="comment" placeholder={`Anything ${cg} or your coordinator should know`} value={comment} onChange={e => setComment(e.target.value)} />
        </div>
      </div>
    </Screen>
  );
}
