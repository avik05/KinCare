import { Link, Navigate } from 'react-router-dom';
import { q, rpc, supabase } from '../../lib/supabase';
import { useLive } from '../../lib/hooks';
import { inr, parentLabel, shortDate, years } from '../../lib/format';
import Icon from '../../components/Icon';
import { Avatar, Checks, Empty, ErrorBox } from '../../components/ui';
import { Screen, ScreenLoading } from '../../components/layout';
import { bookStep, useDraft } from './booking';

/** BR2: the database only returns fully verified caregivers to families. Nearest pin codes first. */
export default function BookList() {
  const { draft } = useDraft();
  const { data, loading, error } = useLive(async () => {
    const parent = await q<any>(supabase.from('parents').select('name, relation, pin_code').eq('id', draft.parentId).single());
    const cgs = await q<any[]>(supabase.from('caregivers').select('*').eq('verified', true));
    // B01 (v1.1): caregivers already booked by another family on any of these days are shown as not free.
    const busy = new Set(await rpc<string[]>('caregivers_busy', { p_start: draft.start, p_days: draft.days, p_parent: draft.parentId }).catch(() => [] as string[]));
    const pin = Number(parent.pin_code);
    cgs.sort((a, b) => Number(busy.has(a.id)) - Number(busy.has(b.id)) || Math.abs(Number(a.pin_code) - pin) - Math.abs(Number(b.pin_code) - pin) || b.years - a.years);
    return { parent, busy, cgs: cgs.filter(c => Math.abs(Number(c.pin_code) - pin) < 200) };
  }, [draft.parentId, draft.start, draft.days], 0);
  if (!draft.parentId) return <Navigate to="/f/book" replace />;
  if (loading) return <ScreenLoading title="Verified caregivers" back="/f/book" blocks={[20, 360]} />;
  const p = data?.parent;

  return (
    <Screen title="Verified caregivers" sub={bookStep(2)} back="/f/book" backLabel="Care details">
      <div className="stack">
        <ErrorBox msg={error} />
        {p && <p className="t-sm muted" style={{ padding: '0 2px' }}>{data!.cgs.filter(c => !data!.busy.has(c.id)).length} free near {parentLabel(p)}’s pin code {p.pin_code}, for {draft.hours}-hour shifts from {shortDate(draft.start)}. Nearest first.</p>}
        {data?.cgs.length === 0
          ? <div className="panel"><Empty icon="users" title="No verified caregivers nearby yet">Your coordinator has been told and will call you within a day. You can also try a different start date.</Empty></div>
          : <div className="panel flush">
              {data?.cgs.map(c => data.busy.has(c.id) ? (
                <div key={c.id} className="li" aria-disabled="true" style={{ alignItems: 'flex-start', opacity: .55 }}>
                  <Avatar text={c.initials} tone="grey" />
                  <span className="li-t">
                    <b>{c.name}</b>
                    <span>{years(c.years)} of home care, {c.languages}</span>
                    <span>Booked by another family for some of these days</span>
                  </span>
                </div>
              ) : (
                <Link key={c.id} className="li" to={`/f/book/caregiver/${c.id}`} style={{ alignItems: 'flex-start' }}>
                  <Avatar text={c.initials} tone="brand" />
                  <span className="li-t">
                    <b>{c.name}</b>
                    <span>{years(c.years)} of home care, {c.languages}</span>
                    <span>{c.area}, {c.pin_code}</span>
                    <Checks c={c} />
                  </span>
                  <span className="li-end"><b>{inr(draft.hours === 12 ? c.rate_12 : c.rate_24)}</b>per day</span>
                </Link>
              ))}
            </div>}
        <p className="note" style={{ marginTop: 4 }}><Icon name="shield" size="sm" /><span>Everyone listed has a checked ID, a cleared police verification and completed elder-care training. Caregivers still waiting on a check are not shown.</span></p>
      </div>
    </Screen>
  );
}
