import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { q, rpc, supabase } from '../../lib/supabase';
import { useLive } from '../../lib/hooks';
import { dayLabel, inr } from '../../lib/format';
import Icon from '../../components/Icon';
import { AppBar, Avatar, ErrorBox, Loading } from '../../components/ui';
import { useDraft } from './booking';

export default function Checkout() {
  const nav = useNavigate();
  const { draft, reset } = useDraft();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const { data, loading } = useLive(async () => {
    const [c, p, s] = await Promise.all([
      q<any>(supabase.from('caregivers').select('*').eq('id', draft.caregiverId).single()),
      q<any>(supabase.from('parents').select('name, relation').eq('id', draft.parentId).single()),
      q<any>(supabase.from('settings').select('membership_fee').single()),
    ]);
    return { c, p, fee: Number(s.membership_fee) };
  }, [draft.caregiverId], 0);
  if (!draft.caregiverId || !draft.parentId) return <Navigate to="/f/book" replace />;
  if (loading || !data) return <div className="shell"><Loading /></div>;
  const rate = Number(draft.hours === 12 ? data.c.rate_12 : data.c.rate_24);
  const care = rate * draft.days;

  async function confirm() {
    setBusy(true); setErr(null);
    try {
      const id = await rpc<string>('book_care', { p_parent: draft.parentId, p_caregiver: draft.caregiverId, p_hours: draft.hours, p_start: draft.start, p_days: draft.days });
      reset();
      nav(`/f/book/done/${id}`, { replace: true });
    } catch (x: any) { setErr(x.message); setBusy(false); }
  }

  return (
    <div className="shell"><main className="page stack">
      <AppBar title="Checkout" back={`/f/book/caregiver/${draft.caregiverId}`} />
      <div className="surface">
        <div className="row"><Avatar text={data.c.initials} tone="leaf" size="sm" /><div><b>{data.c.name}</b><div className="tiny">For {data.p.name}. {draft.hours}-hour shift, {draft.days} days from {dayLabel(draft.start)}</div></div></div>
        <div className="divider" style={{ margin: '12px 0 4px' }} />
        <div className="kv"><span>Care, {draft.days} {'×'} {inr(rate)}</span><span>{inr(care)}</span></div>
        <div className="kv"><span>KinCare membership, 1 month</span><span>{inr(data.fee)}</span></div>
        <div className="kv tiny" style={{ paddingTop: 0 }}><span>Verification, alerts and backup cover</span><span /></div>
        <div className="kv total"><span>Total</span><span>{inr(care + data.fee)}</span></div>
      </div>
      <p className="note"><Icon name="lock" size="sm" /><span>Test checkout. No payment is taken in this version.</span></p>
      <ErrorBox msg={err} />
      <button className="btn" disabled={busy} onClick={confirm}>{busy ? 'Booking…' : 'Confirm booking'}</button>
    </main></div>
  );
}
