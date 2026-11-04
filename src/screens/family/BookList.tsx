import { Link, Navigate } from 'react-router-dom';
import { q, supabase } from '../../lib/supabase';
import { useLive } from '../../lib/hooks';
import { dayLabel, inr } from '../../lib/format';
import Icon from '../../components/Icon';
import { AppBar, Avatar, Badges, ErrorBox, Loading } from '../../components/ui';
import { useDraft } from './booking';

/** BR2: the database only returns fully verified caregivers to families. Nearest pin codes first. */
export default function BookList() {
  const { draft } = useDraft();
  const { data, loading, error } = useLive(async () => {
    const parent = await q<any>(supabase.from('parents').select('pin_code').eq('id', draft.parentId).single());
    const cgs = await q<any[]>(supabase.from('caregivers').select('*').eq('verified', true));
    const pin = Number(parent.pin_code);
    cgs.sort((a, b) => Math.abs(Number(a.pin_code) - pin) - Math.abs(Number(b.pin_code) - pin) || b.years - a.years);
    return { pin: parent.pin_code, cgs: cgs.filter(c => Math.abs(Number(c.pin_code) - pin) < 200) };
  }, [draft.parentId], 0);
  if (!draft.parentId) return <Navigate to="/f/book" replace />;
  if (loading) return <div className="shell"><Loading /></div>;

  return (
    <div className="shell"><main className="page stack">
      <AppBar title={`Caregivers near ${data?.pin ?? ''}`} back="/f/book" />
      <ErrorBox msg={error} />
      <p className="small muted" style={{ margin: 0 }}>{data?.cgs.length} verified caregivers for a {draft.hours}-hour shift from {dayLabel(draft.start)}.</p>
      {data?.cgs.length === 0 && <div className="surface empty">No verified caregivers near this pin code yet. Your coordinator has been told.</div>}
      {data?.cgs.map(c => (
        <Link key={c.id} className="cg" to={`/f/book/caregiver/${c.id}`}>
          <Avatar text={c.initials} tone="leaf" />
          <span className="grow">
            <span className="row between"><h3>{c.name}</h3><span className="rate">{inr(draft.hours === 12 ? c.rate_12 : c.rate_24)}<span className="tiny">/day</span></span></span>
            <span className="meta">{c.years} years, {c.languages}. {c.area}</span>
            <Badges c={c} />
          </span>
        </Link>
      ))}
      <div className="hidden-note"><Icon name="lock" size="sm" /><span>Caregivers still waiting on a check are not listed. Everyone here has a verified ID, police check and training.</span></div>
    </main></div>
  );
}
