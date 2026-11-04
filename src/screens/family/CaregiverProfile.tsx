import { useNavigate, useParams } from 'react-router-dom';
import { q, supabase } from '../../lib/supabase';
import { useLive } from '../../lib/hooks';
import { addDays, firstName, inr, shortDate, years } from '../../lib/format';
import Icon from '../../components/Icon';
import { Avatar, Empty, Pill } from '../../components/ui';
import { Screen, ScreenLoading } from '../../components/layout';
import { bookStep, useDraft } from './booking';

export default function CaregiverProfile() {
  const { id } = useParams();
  const nav = useNavigate();
  const { draft, set } = useDraft();
  const { data: c, loading, error } = useLive(() => q<any>(supabase.from('caregivers').select('*').eq('id', id).single()), [id], 0);
  if (loading) return <ScreenLoading title="Caregiver" back="/f/book/caregivers" blocks={[180, 160, 140]} />;
  if (!c) return (
    <Screen title="Caregiver" back="/f/book/caregivers" backLabel="Caregivers">
      <div className="panel"><Empty icon="users" title="This caregiver is not available">{error ? 'They may have been booked or are no longer listed.' : ''} Choose another caregiver from the list.</Empty></div>
    </Screen>
  );
  const rate = Number(draft.hours === 12 ? c.rate_12 : c.rate_24);
  const checks = [
    ['ID document checked', c.id_checked_at],
    ['Police verification cleared', c.police_checked_at],
    ['Elder-care training completed', c.training_done_at],
  ];
  return (
    <Screen title={c.name} sub={bookStep(2)} back="/f/book/caregivers" backLabel="Caregivers"
      footer={<>
        <div className="foot-meta"><span>{draft.days} days at {inr(rate)} a day</span><b>{inr(rate * draft.days)}</b></div>
        <button className="btn block" onClick={() => { set({ caregiverId: c.id }); nav('/f/book/checkout'); }}>Choose {firstName(c.name)}</button>
      </>}>
      <div className="stack-lg">
        <div className="panel pad row" style={{ gap: 16 }}>
          <Avatar text={c.initials} tone="brand" size="xl" />
          <div className="grow">
            <Pill tone="ok"><Icon name="shield" size="sm" />Verified</Pill>
            <p className="t-md" style={{ marginTop: 8 }}>{years(c.years)} of home care</p>
            <p className="t-sm muted">Speaks {c.languages}. Lives in {c.area}, {c.pin_code}.</p>
          </div>
        </div>
        <section className="section" aria-labelledby="ver-h">
          <div className="sec-head"><h2 id="ver-h">Verification</h2></div>
          <div className="panel flush">
            {checks.map(([t, at]) => (
              <div className="li" key={t}><span className="av sm" style={{ background: 'var(--ok-tint)', color: 'var(--ok)' }}><Icon name="check" size="sm" /></span>
                <span className="li-t"><b style={{ fontWeight: 500 }}>{t}</b></span><span className="li-end">{at ? shortDate(at) : ''}</span></div>
            ))}
          </div>
        </section>
        <section className="section" aria-labelledby="bk-h">
          <div className="sec-head"><h2 id="bk-h">Your booking</h2></div>
          <div className="panel">
            <div className="kv"><span>Shift</span><span>{draft.hours === 12 ? '12 hours, 8 am to 8 pm' : '24 hours, live-in'}</span></div>
            <div className="kv"><span>Dates</span><span>{shortDate(draft.start)} to {shortDate(addDays(draft.start, draft.days - 1))}</span></div>
            <div className="kv"><span>Rate</span><span>{inr(rate)} per day</span></div>
          </div>
        </section>
      </div>
    </Screen>
  );
}
