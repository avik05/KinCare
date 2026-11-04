import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { q, rpc, supabase } from '../../lib/supabase';
import { useLive } from '../../lib/hooks';
import { addDays, dayLabel, firstName, inr, parentLabel, shortDate } from '../../lib/format';
import Icon from '../../components/Icon';
import { Avatar, Btn, ErrorBox } from '../../components/ui';
import { Screen, ScreenLoading } from '../../components/layout';
import { bookStep, useDraft } from './booking';

export default function Checkout() {
  const nav = useNavigate();
  const { draft } = useDraft();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const { data, loading, error } = useLive(async () => {
    const [c, p, s] = await Promise.all([
      q<any>(supabase.from('caregivers').select('*').eq('id', draft.caregiverId).single()),
      q<any>(supabase.from('parents').select('name, relation, address, pin_code').eq('id', draft.parentId).single()),
      q<any>(supabase.from('settings').select('membership_fee, no_show_minutes').single()),
    ]);
    return { c, p, fee: Number(s.membership_fee), mins: s.no_show_minutes };
  }, [draft.caregiverId], 0);
  if (!draft.caregiverId || !draft.parentId) return <Navigate to="/f/book" replace />;
  if (loading || !data) return loading ? <ScreenLoading title="Review and confirm" back="/f/book/caregivers" blocks={[90, 220, 60]} /> : <Screen title="Review and confirm" back="/f/book"><ErrorBox msg={error} /></Screen>;
  const rate = Number(draft.hours === 12 ? data.c.rate_12 : data.c.rate_24);
  const care = rate * draft.days;
  const total = care + data.fee;

  async function confirm() {
    setBusy(true); setErr(null);
    try {
      const id = await rpc<string>('book_care', { p_parent: draft.parentId, p_caregiver: draft.caregiverId, p_hours: draft.hours, p_start: draft.start, p_days: draft.days });
      nav(`/f/book/done/${id}`, { replace: true });
    } catch (x: any) { setErr(x.message); setBusy(false); }
  }

  return (
    <Screen title="Review and confirm" sub={bookStep(3)} back={`/f/book/caregiver/${draft.caregiverId}`} backLabel={firstName(data.c.name)}
      footer={<>
        <ErrorBox msg={err} />
        <Btn className="block" busy={busy} busyText="Confirming booking" onClick={confirm}>Confirm booking for {inr(total)}</Btn>
      </>}>
      <div className="stack-lg">
        <div className="panel flush">
          <div className="li"><Avatar text={data.c.initials} tone="brand" /><span className="li-t"><b>{data.c.name}</b><span>Caregiver, verified</span></span></div>
          <div className="li"><span className="av grey"><Icon name="home" size="sm" /></span><span className="li-t"><b>{parentLabel(data.p) === data.p.name ? data.p.name : `${parentLabel(data.p)} (${data.p.name})`}</b><span>{data.p.address}, {data.p.pin_code}</span></span></div>
          <div className="li"><span className="av grey"><Icon name="cal" size="sm" /></span><span className="li-t"><b>{draft.days} days from {dayLabel(draft.start)}</b><span>{draft.hours === 12 ? '12-hour shifts, 8 am to 8 pm' : '24-hour live-in shifts'}, ending {shortDate(addDays(draft.start, draft.days - 1))}</span></span></div>
        </div>

        <section className="section" aria-labelledby="pay-h">
          <div className="sec-head"><h2 id="pay-h">Price</h2></div>
          <div className="panel">
            <div className="kv"><span>Care, {draft.days} days at {inr(rate)}</span><span className="num">{inr(care)}</span></div>
            <div className="kv"><span>KinCare membership, 1 month</span><span className="num">{inr(data.fee)}</span></div>
            <div className="kv sub"><span>Verification, missed-visit alerts and replacement cover</span><span /></div>
            <div className="kv total"><span>Total</span><span className="num">{inr(total)}</span></div>
          </div>
        </section>

        <div className="callout brand"><Icon name="bell" /><div>If {firstName(data.c.name)} has not checked in {data.mins} minutes after a shift starts, you and your coordinator are alerted and a verified replacement is sent within 4 hours.</div></div>
        <p className="note"><Icon name="info" size="sm" /><span>This is a test checkout for the capstone. No payment is taken.</span></p>
      </div>
    </Screen>
  );
}
