import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { q, supabase } from '../../lib/supabase';
import { useLive } from '../../lib/hooks';
import { dayLabel, initials, todayIST } from '../../lib/format';
import { AppBar, Avatar, ErrorBox, Loading } from '../../components/ui';
import { FamilyTabs, useDraft } from './booking';

export default function BookSetup() {
  const nav = useNavigate();
  const { draft, set } = useDraft();
  const { data: parents, loading, error } = useLive(() => q<any[]>(supabase.from('parents').select('id, name, relation, address, pin_code').order('created_at')), [], 0);
  const [msg, setMsg] = useState('');
  useEffect(() => { if (parents?.length && !parents.find(p => p.id === draft.parentId)) set({ parentId: parents[0].id }); }, [parents]);
  if (loading) return <div className="shell"><Loading /></div>;
  if (!parents?.length) return (
    <div className="shell"><main className="page"><AppBar title="Book care" back="/f" />
      <div className="surface stack center"><b>Add a parent first</b><p className="muted small" style={{ margin: 0 }}>We need their address and your consent before booking.</p><Link className="btn" to="/f/add-parent">Add a parent</Link></div>
    </main><FamilyTabs /></div>
  );
  const dates = Array.from({ length: 7 }, (_, i) => todayIST(i + 1));

  return (
    <div className="shell"><main className="page stack">
      <AppBar title="Book care" back="/f" />
      <ErrorBox msg={error} />
      <div className="surface"><span className="label">For</span>
        <div className="stack" style={{ gap: 8 }}>
          {parents.map(p => (
            <button key={p.id} className={'checkrow' + (draft.parentId === p.id ? ' on' : '')} role="radio" aria-checked={draft.parentId === p.id} onClick={() => set({ parentId: p.id })}>
              <Avatar text={initials(p.name)} size="sm" /><span><b>{p.relation !== 'Parent' ? `${p.relation} (${p.name})` : p.name}</b><span className="tiny" style={{ display: 'block' }}>{p.pin_code}</span></span>
            </button>
          ))}
        </div>
      </div>
      <div><span className="label">Shift length</span>
        <div className="seg" role="group" aria-label="Shift length">
          <button aria-pressed={draft.hours === 12} onClick={() => set({ hours: 12 })}>12 hours, day</button>
          <button aria-pressed={draft.hours === 24} onClick={() => set({ hours: 24 })}>24 hours</button>
        </div></div>
      <div><label className="label" htmlFor="b-start">Start date</label>
        <select className="field" id="b-start" value={draft.start} onChange={e => set({ start: e.target.value })}>
          {dates.map(d => <option key={d} value={d}>{dayLabel(d)}</option>)}
        </select>
        <p className="tiny" style={{ margin: '4px 0 0' }}>Shifts start at 8:00 am, India time.</p></div>
      <div className="surface">
        <div className="row between"><span className="label" style={{ margin: 0 }}>Length of booking</span><span className="tag">14-day blocks</span></div>
        <div className="row between" style={{ marginTop: 10 }}>
          <button className="iconbtn" aria-label="Fewer days" style={{ background: 'var(--line-2)' }}
            onClick={() => draft.days <= 14 ? setMsg('Bookings start at 14 days so caregivers can plan their schedule.') : (set({ days: draft.days - 7 }), setMsg(''))}>{'−'}</button>
          <div className="center"><span style={{ fontFamily: 'var(--display)', fontWeight: 600, fontSize: 28 }}>{draft.days}</span><div className="tiny">days{draft.days === 14 ? ', minimum' : ''}</div></div>
          <button className="iconbtn" aria-label="More days" style={{ background: 'var(--line-2)' }} onClick={() => { set({ days: Math.min(28, draft.days + 7) }); setMsg(''); }}>+</button>
        </div>
        <p className="tiny center" style={{ margin: '8px 0 0', minHeight: 18, color: msg ? 'var(--marigold-deep)' : undefined }}>{msg}</p>
      </div>
      <button className="btn" disabled={!draft.parentId} onClick={() => nav('/f/book/caregivers')}>See verified caregivers nearby</button>
    </main><FamilyTabs /></div>
  );
}
