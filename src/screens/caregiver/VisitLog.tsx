import { FormEvent, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { q, rpc, supabase } from '../../lib/supabase';
import { useLive } from '../../lib/hooks';
import { time } from '../../lib/format';
import Icon, { taskIcon } from '../../components/Icon';
import { AppBar, ErrorBox, Loading, useToast } from '../../components/ui';
import { loadShifts } from './Today';

export default function VisitLog() {
  const { shiftId } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { data, loading, reload, setData } = useLive(async () => {
    const s = (await loadShifts()).find(x => x.shift_id === shiftId);
    const readings = s?.visit_id ? await q<any[]>(supabase.from('readings').select('*').eq('visit_id', s.visit_id).order('recorded_at')) : [];
    return { s, readings };
  }, [shiftId], 0);
  const [vit, setVit] = useState({ sys: '', dia: '', sugar: '' });
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (loading && !data) return <div className="shell"><Loading /></div>;
  const s = data?.s;
  if (!s?.visit_id) return <div className="shell"><main className="page"><AppBar title="Tasks and readings" back="/c" /><ErrorBox msg="Check in first to log tasks for this shift." /></main></div>;
  const tasks: string[] = s.care_tasks || Object.keys(s.tasks || {});
  const open = !s.check_out_at;

  async function toggle(t: string) {
    if (!open) return;
    const done = !s.tasks?.[t];
    setData({ ...data, s: { ...s, tasks: done ? { ...s.tasks, [t]: new Date().toISOString() } : Object.fromEntries(Object.entries(s.tasks).filter(([k]) => k !== t)) } });
    try { await rpc('set_task', { p_visit: s.visit_id, p_task: t, p_done: done }); }
    catch (x: any) { setErr(x.message); reload(); }
  }

  async function saveReading(e: FormEvent) {
    e.preventDefault();
    const n = (v: string) => (v.trim() ? Number(v) : null);
    if (!vit.sys && !vit.sugar) return setErr('Enter a BP or sugar reading.');
    setBusy(true); setErr(null);
    try {
      await rpc('add_reading', { p_visit: s.visit_id, p_sys: n(vit.sys), p_dia: n(vit.dia), p_sugar: n(vit.sugar) });
      setVit({ sys: '', dia: '', sugar: '' }); toast('Readings saved and shared with the family'); reload();
    } catch (x: any) { setErr(/check/.test(x.message) ? 'That reading looks out of range. Check the numbers.' : x.message); }
    finally { setBusy(false); }
  }

  async function checkOut() {
    setBusy(true); setErr(null);
    try { await rpc('check_out', { p_visit: s.visit_id }); toast('Checked out. Shift complete'); nav('/c', { replace: true }); }
    catch (x: any) { setErr(x.message); setBusy(false); }
  }

  return (
    <div className="shell"><main className="page stack">
      <AppBar title={`${s.parent_name}: tasks`} back="/c" />
      {tasks.map(t => (
        <button key={t} className={'checkrow' + (s.tasks?.[t] ? ' on' : '')} role="checkbox" aria-checked={!!s.tasks?.[t]} onClick={() => toggle(t)} disabled={!open}>
          <span className="box"><Icon name="check" /></span>
          <span className="row grow" style={{ gap: 8 }}><Icon name={taskIcon(t)} /><b>{t}</b></span>
          {s.tasks?.[t] && <span className="tiny">{time(s.tasks[t])}</span>}
        </button>
      ))}
      <form className="surface" onSubmit={saveReading}>
        <b>Readings</b>
        {data.readings.map(r => <div className="kv" key={r.id}><span>{time(r.recorded_at)}</span><span>{r.bp_systolic ? `BP ${r.bp_systolic}/${r.bp_diastolic}` : ''}{r.sugar ? `${r.bp_systolic ? ', ' : ''}sugar ${r.sugar}` : ''}</span></div>)}
        {open && <>
          <div className="vitals" style={{ marginTop: 10 }}>
            <div><label className="tiny" htmlFor="v-sys">BP top</label><input className="field" id="v-sys" inputMode="numeric" placeholder="130" value={vit.sys} onChange={e => setVit({ ...vit, sys: e.target.value })} /></div>
            <div><label className="tiny" htmlFor="v-dia">BP bottom</label><input className="field" id="v-dia" inputMode="numeric" placeholder="85" value={vit.dia} onChange={e => setVit({ ...vit, dia: e.target.value })} /></div>
            <div><label className="tiny" htmlFor="v-sug">Sugar</label><input className="field" id="v-sug" inputMode="numeric" placeholder="140" value={vit.sugar} onChange={e => setVit({ ...vit, sugar: e.target.value })} /></div>
          </div>
          <button className="btn ghost sm" style={{ marginTop: 10, width: '100%' }} disabled={busy}>Save readings</button>
        </>}
        <p className="lock"><Icon name="lock" size="sm" />Shared with the family and coordinator only</p>
      </form>
      <ErrorBox msg={err} />
      {open ? <button className="btn" disabled={busy} onClick={checkOut}>Check out</button>
        : <div className="surface center"><b>Checked out at {time(s.check_out_at)}</b></div>}
    </main></div>
  );
}
