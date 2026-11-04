import { useState } from 'react';
import { Link } from 'react-router-dom';
import { q, rpc, supabase } from '../../lib/supabase';
import { useLive } from '../../lib/hooks';
import { inr, years } from '../../lib/format';
import Icon from '../../components/Icon';
import { Avatar, Empty, ErrorBox, Pill, useToast } from '../../components/ui';
import { Screen, ScreenLoading } from '../../components/layout';

const CHECKS = [['id', 'id_checked', 'ID document'], ['police', 'police_checked', 'Police verification'], ['training', 'training_done', 'Elder-care training']] as const;
type Filter = 'all' | 'pending' | 'verified';

/** FR7 + BR2: caregivers are hidden from families until all three checks are complete. */
export default function Caregivers() {
  const toast = useToast();
  const { data, loading, error, setData, reload } = useLive(() => q<any[]>(supabase.from('caregivers').select('*').order('verified').order('created_at', { ascending: false })), [], 30000);
  const [filter, setFilter] = useState<Filter>('all');
  const [term, setTerm] = useState('');
  if (loading && !data) return <ScreenLoading title="Caregivers" blocks={[44, 400]} />;

  async function flip(c: any, check: string, col: string) {
    const next = !c[col];
    const updated = { ...c, [col]: next };
    updated.verified = updated.id_checked && updated.police_checked && updated.training_done;
    setData(data!.map(x => (x.id === c.id ? updated : x)));
    try {
      await rpc('set_check', { p_caregiver: c.id, p_check: check, p_done: next });
      if (updated.verified && !c.verified) toast(`${c.name} is now visible to families`);
      else if (!updated.verified && c.verified) toast(`${c.name} is hidden from families until all checks are done`);
    } catch (x: any) { toast(x.message, true); reload(); }
  }

  const all = data ?? [];
  const pending = all.filter(c => !c.verified).length;
  const t = term.trim().toLowerCase();
  const rows = all.filter(c => (filter === 'all' || (filter === 'pending' ? !c.verified : c.verified)) &&
    (!t || `${c.name} ${c.area} ${c.pin_code} ${c.languages}`.toLowerCase().includes(t)));

  return (
    <Screen title="Caregivers" sub={`${all.length - pending} verified and visible to families. ${pending} waiting on checks.`} wide
      actions={<Link className="btn sm" to="/k/caregivers/new" aria-label="Add caregiver"><Icon name="plus" size="sm" /><span>Add caregiver</span></Link>}>
      <div className="stack">
        <ErrorBox msg={error} />
        <div className="toolbar">
          <div className="search"><Icon name="search" /><label className="sr" htmlFor="cg-q">Search caregivers</label>
            <input className="input" id="cg-q" type="search" placeholder="Search by name, area or pin code" value={term} onChange={e => setTerm(e.target.value)} /></div>
          <div className="seg compact" role="radiogroup" aria-label="Show">
            {([['all', 'All'], ['pending', `Waiting on checks (${pending})`], ['verified', 'Verified']] as [Filter, string][]).map(([k, l]) =>
              <button key={k} role="radio" aria-checked={filter === k} onClick={() => setFilter(k)}>{l}</button>)}
          </div>
        </div>

        {rows.length === 0 ? <div className="panel"><Empty icon="search" title="No caregivers match">Try a different name or pin code, or show all caregivers.</Empty></div> : <>
          <div className="panel flush only-wide" style={{ overflowX: 'auto' }}>
            <table className="table">
              <thead><tr><th>Caregiver</th><th>Area</th><th>12-hour rate</th>{CHECKS.map(([k, , l]) => <th key={k} className="c">{l}</th>)}<th>Families can see</th></tr></thead>
              <tbody>
                {rows.map(c => (
                  <tr key={c.id}>
                    <td><div className="row" style={{ gap: 10 }}><Avatar text={c.initials} tone={c.verified ? 'brand' : undefined} size="sm" /><div><b>{c.name}</b><small>{years(c.years)}, {c.languages}</small></div></div></td>
                    <td>{c.area}<br /><small>{c.pin_code}</small></td>
                    <td className="num">{inr(c.rate_12)}</td>
                    {CHECKS.map(([key, col, label]) => <td key={key} className="c"><button className="switch" role="switch" aria-checked={!!c[col]} aria-label={`${label}: ${c.name}`} onClick={() => flip(c, key, col)} /></td>)}
                    <td>{c.verified ? <Pill tone="ok" dot>Visible</Pill> : <Pill tone="warn" dot>Hidden</Pill>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="panel flush only-narrow">
            {rows.map(c => (
              <div className="cg-card" key={c.id}>
                <div className="row"><Avatar text={c.initials} tone={c.verified ? 'brand' : undefined} />
                  <div className="grow"><b className="strong">{c.name}</b><div className="t-sm muted">{c.area} {c.pin_code}, {inr(c.rate_12)} a day</div></div>
                  {c.verified ? <Pill tone="ok" dot>Visible</Pill> : <Pill tone="warn" dot>Hidden</Pill>}</div>
                <div style={{ marginTop: 10 }}>
                  {CHECKS.map(([key, col, label]) => (
                    <div className="check-row" key={key}><span>{label}</span>
                      <button className="switch" role="switch" aria-checked={!!c[col]} aria-label={`${label}: ${c.name}`} onClick={() => flip(c, key, col)} /></div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </>}
        <p className="note"><Icon name="shield" size="sm" /><span>Families only see caregivers with all three checks complete. Turning any check off hides the caregiver straight away.</span></p>
      </div>
    </Screen>
  );
}
