import { FormEvent, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { q, rpc, supabase } from '../../lib/supabase';
import { useLive } from '../../lib/hooks';
import { time } from '../../lib/format';
import Icon, { taskIcon } from '../../components/Icon';
import { Btn, Confirm, Empty, ErrorBox, useToast } from '../../components/ui';
import { Screen, ScreenLoading } from '../../components/layout';
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
  const [vErr, setVErr] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [ask, setAsk] = useState(false);

  if (loading && !data) return <ScreenLoading title="Tasks and readings" back="/c" blocks={[220, 200]} />;
  const s = data?.s;
  if (!s?.visit_id) return (
    <Screen title="Tasks and readings" back="/c" backLabel="Today">
      <div className="panel"><Empty icon="door" title="Check in first">Tasks and readings open once you have checked in at the door for this shift.</Empty></div>
    </Screen>
  );
  const tasks: string[] = s.care_tasks?.length ? s.care_tasks : Object.keys(s.tasks || {});
  const doneN = tasks.filter(t => s.tasks?.[t]).length;
  const open = !s.check_out_at;

  async function toggle(t: string) {
    if (!open) return;
    const done = !s.tasks?.[t];
    setData({ ...data!, s: { ...s, tasks: done ? { ...s.tasks, [t]: new Date().toISOString() } : Object.fromEntries(Object.entries(s.tasks || {}).filter(([k]) => k !== t)) } });
    try { await rpc('set_task', { p_visit: s.visit_id, p_task: t, p_done: done }); }
    catch (x: any) { setErr(x.message); reload(); }
  }

  async function saveReading(e: FormEvent) {
    e.preventDefault();
    const n = (v: string) => (v.trim() ? Number(v) : null);
    if (!vit.sys && !vit.dia && !vit.sugar) return setVErr('Enter a blood pressure or sugar reading.');
    if ((vit.sys && !vit.dia) || (!vit.sys && vit.dia)) return setVErr('Enter both blood pressure numbers, top and bottom.');
    setSaving(true); setVErr(null);
    try {
      await rpc('add_reading', { p_visit: s.visit_id, p_sys: n(vit.sys), p_dia: n(vit.dia), p_sugar: n(vit.sugar) });
      setVit({ sys: '', dia: '', sugar: '' }); toast('Reading saved and shared with the family'); reload();
    } catch (x: any) { setVErr(/check/.test(x.message) ? 'That reading looks out of range. Check the numbers and try again.' : x.message); }
    finally { setSaving(false); }
  }

  async function checkOut() {
    setLeaving(true); setErr(null);
    try { await rpc('check_out', { p_visit: s.visit_id }); toast('Checked out. Shift complete'); nav('/c', { replace: true }); }
    catch (x: any) { setErr(x.message); setLeaving(false); setAsk(false); }
  }
  const digits = (k: keyof typeof vit) => (e: any) => setVit({ ...vit, [k]: e.target.value.replace(/\D/g, '').slice(0, 3) });

  return (
    <Screen title="Tasks and readings" sub={`${s.parent_name}, checked in at ${time(s.check_in_at)}`} back="/c" backLabel="Today"
      footer={open ? <>
        <ErrorBox msg={err} />
        <Btn className="block" busy={leaving && !ask} busyText="Checking out" onClick={() => (doneN < tasks.length ? setAsk(true) : checkOut())}>Check out</Btn>
      </> : undefined}>
      <div className="stack-lg">
        {!open && <div className="callout brand"><Icon name="check" /><div><b>Checked out at {time(s.check_out_at)}</b><div>This visit is complete and the record is with the family.</div></div></div>}
        <section className="section" aria-labelledby="t-h">
          <div className="sec-head"><h2 id="t-h">Care plan</h2><span className="t-xs">{doneN} of {tasks.length} done</span></div>
          <div className="panel flush" role="group" aria-labelledby="t-h">
            {tasks.map(t => (
              <button key={t} className="task" role="checkbox" aria-checked={!!s.tasks?.[t]} onClick={() => toggle(t)} disabled={!open}>
                <span className="box"><Icon name="check" className="" /></span>
                <b>{t}</b>
                {s.tasks?.[t] ? <span className="t-time">{time(s.tasks[t])}</span> : <Icon name={taskIcon(t)} />}
              </button>
            ))}
          </div>
          {open && <p className="hint" style={{ padding: '0 2px' }}>Tap a task when it is done. The family sees the time straight away.</p>}
        </section>

        <section className="section" aria-labelledby="r-h">
          <div className="sec-head"><h2 id="r-h">Readings</h2></div>
          <div className="panel pad">
            {data!.readings.length > 0 && (
              <div style={{ marginTop: -8, marginBottom: open ? 16 : 0 }}>
                {data!.readings.map(r => <div className="kv" key={r.id}><span>{time(r.recorded_at)}</span><span className="num">{[r.bp_systolic && `BP ${r.bp_systolic}/${r.bp_diastolic}`, r.sugar && `Sugar ${r.sugar}`].filter(Boolean).join(', ')}</span></div>)}
              </div>
            )}
            {open ? (
              <form onSubmit={saveReading} className="stack" noValidate>
                <div className="vit">
                  <div className="field"><label className="label" htmlFor="v-sys">BP top</label><input className="input" id="v-sys" inputMode="numeric" placeholder="130" value={vit.sys} onChange={digits('sys')} /></div>
                  <div className="field"><label className="label" htmlFor="v-dia">BP bottom</label><input className="input" id="v-dia" inputMode="numeric" placeholder="85" value={vit.dia} onChange={digits('dia')} /></div>
                  <div className="field"><label className="label" htmlFor="v-sug">Sugar</label><input className="input" id="v-sug" inputMode="numeric" placeholder="140" value={vit.sugar} onChange={digits('sugar')} /></div>
                </div>
                <ErrorBox msg={vErr} />
                <Btn className="secondary block" busy={saving} busyText="Saving reading">Save reading</Btn>
              </form>
            ) : data!.readings.length === 0 && <p className="t-sm muted">No readings were recorded on this visit.</p>}
            <p className="lock"><Icon name="lock" size="sm" />Shared only with the family and the coordinator.</p>
          </div>
        </section>
      </div>
      <Confirm open={ask} busy={leaving} title={`${tasks.length - doneN} ${tasks.length - doneN === 1 ? 'task is' : 'tasks are'} not done`}
        body="The family will see these as not done. Check out anyway?" confirmLabel="Check out" busyLabel="Checking out" cancelLabel="Go back" onConfirm={checkOut} onClose={() => setAsk(false)} />
    </Screen>
  );
}
