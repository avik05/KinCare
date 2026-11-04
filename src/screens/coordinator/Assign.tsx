import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { q, rpc, supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { useLive } from '../../lib/hooks';
import { minutesLeft, time } from '../../lib/format';
import { AppBar, Avatar, Badges, ErrorBox, Loading, useToast } from '../../components/ui';

export default function Assign() {
  const { alertId } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { profile } = useAuth();
  const { data, loading, error } = useLive(async () => {
    const a = await q<any>(supabase.from('alerts').select('*, parent:parents(name, pin_code, care_needs), shift:shifts!alerts_shift_id_fkey(id, start_at, end_at, caregiver_id, caregiver:caregivers(name))').eq('id', alertId).single());
    const cgs = await q<any[]>(supabase.from('caregivers').select('*').eq('verified', true).neq('id', a.shift?.caregiver_id));
    const busy = await q<any[]>(supabase.from('shifts').select('caregiver_id').in('status', ['scheduled', 'checked_in'])
      .lt('start_at', a.shift?.end_at).gt('end_at', new Date().toISOString()));
    const busyIds = new Set(busy.map(b => b.caregiver_id));
    const pin = Number(a.parent?.pin_code);
    const list = cgs.map(c => ({ ...c, busy: busyIds.has(c.id), dist: Math.abs(Number(c.pin_code) - pin) }))
      .filter(c => c.dist < 200).sort((x, y) => Number(x.busy) - Number(y.busy) || x.dist - y.dist);
    return { a, list };
  }, [alertId], 0);
  const options = [1, 2, 3, 4].map(h => { const d = new Date(Date.now() + h * 3600e3); d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0); return d; });
  const [arrive, setArrive] = useState(1);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (loading) return <div className="shell"><Loading /></div>;
  if (!data) return <div className="shell"><main className="page"><AppBar title="Assign a replacement" back="/k" /><ErrorBox msg={error} /></main></div>;
  const { a, list } = data;
  const back = profile?.role === 'admin' && a.level === 'escalated' ? '/a/escalations' : '/k';

  async function assign(c: any) {
    setBusy(true); setErr(null);
    try {
      await rpc('assign_replacement', { p_alert: a.id, p_caregiver: c.id, p_arrive: options[arrive].toISOString() });
      toast(`${c.name} assigned. The family has been told`); nav(back, { replace: true });
    } catch (x: any) { setErr(x.message); setBusy(false); }
  }

  if (a.resolved_at) return <div className="shell"><main className="page"><AppBar title="Assign a replacement" back={back} /><div className="surface"><b>Already resolved</b><p className="small muted" style={{ margin: '4px 0 0' }}>{a.note}</p></div></main></div>;
  return (
    <div className="shell"><main className="page stack">
      <AppBar title="Assign a replacement" back={back} />
      <div className="surface">
        <div className="row between"><b>{a.parent?.name}, {a.parent?.pin_code}</b>{a.due_by && <span className="timer">{minutesLeft(a.due_by)}</span>}</div>
        <p className="small muted" style={{ margin: '4px 0 0' }}>{a.shift?.caregiver?.name} missed the {time(a.shift?.start_at)} start. Needs: {(a.parent?.care_needs || []).join(', ')}.</p>
      </div>
      <div><label className="label" htmlFor="arrive">Replacement arrives by</label>
        <select className="field" id="arrive" value={arrive} onChange={e => setArrive(Number(e.target.value))}>
          {options.map((d, i) => <option key={i} value={i}>{time(d)}</option>)}
        </select></div>
      <ErrorBox msg={err} />
      <p className="label" style={{ margin: '4px 0 0' }}>Verified caregivers near {a.parent?.pin_code}</p>
      {list.length === 0 && <div className="surface empty">No verified caregivers nearby. Escalate to the Care Operations head.</div>}
      {list.map(c => (
        <div className="cg" key={c.id}>
          <Avatar text={c.initials} />
          <span className="grow">
            <span className="row between"><h3>{c.name}</h3><span className="tiny">{c.area}</span></span>
            <span className="meta">{c.busy ? 'On another shift now' : 'Available'}, {c.years} years</span>
            <Badges c={c} />
            <button className="btn sm" style={{ marginTop: 10 }} disabled={busy || c.busy} onClick={() => assign(c)}>Assign {c.name.split(' ')[0]}</button>
          </span>
        </div>
      ))}
    </main></div>
  );
}
