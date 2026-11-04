import { useNavigate, useParams } from 'react-router-dom';
import { q, supabase } from '../../lib/supabase';
import { useLive } from '../../lib/hooks';
import { dayLabel, inr, shortDate } from '../../lib/format';
import { AppBar, Avatar, Badges, ErrorBox, Loading } from '../../components/ui';
import { useDraft } from './booking';

export default function CaregiverProfile() {
  const { id } = useParams();
  const nav = useNavigate();
  const { draft, set } = useDraft();
  const { data: c, loading, error } = useLive(() => q<any>(supabase.from('caregivers').select('*').eq('id', id).single()), [id], 0);
  if (loading) return <div className="shell"><Loading /></div>;
  if (!c) return <div className="shell"><main className="page"><AppBar title="Caregiver" back="/f/book/caregivers" /><ErrorBox msg={error || 'This caregiver is not available.'} /></main></div>;
  const rate = draft.hours === 12 ? c.rate_12 : c.rate_24;
  return (
    <div className="shell"><main className="page stack">
      <AppBar title={c.name} back="/f/book/caregivers" />
      <div className="surface center">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}><Avatar text={c.initials} tone="leaf" size="xl" /></div>
        <b style={{ fontSize: 19 }}>{c.name}</b>
        <div className="muted small">{c.years} years of home care, {c.languages}</div>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}><Badges c={c} /></div>
      </div>
      <div className="surface"><b>Verification</b>
        <div className="kv"><span>ID document</span><span>Checked {c.id_checked_at ? shortDate(c.id_checked_at) : ''}</span></div>
        <div className="kv"><span>Police verification</span><span>Cleared {c.police_checked_at ? shortDate(c.police_checked_at) : ''}</span></div>
        <div className="kv"><span>Elder-care training</span><span>Completed {c.training_done_at ? shortDate(c.training_done_at) : ''}</span></div>
      </div>
      <div className="surface">
        <div className="kv"><span>{draft.hours}-hour shift</span><span>{inr(rate)} per day</span></div>
        <div className="kv"><span>Starts</span><span>{dayLabel(draft.start)}</span></div>
        <div className="kv"><span>Area</span><span>{c.area}, {c.pin_code}</span></div>
      </div>
      <button className="btn" onClick={() => { set({ caregiverId: c.id }); nav('/f/book/checkout'); }}>Continue to checkout</button>
    </main></div>
  );
}
