import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { q, rpc, supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { useLive, sweepNoShows } from '../../lib/hooks';
import { ago, firstName, minutesLeft, time, years } from '../../lib/format';
import Icon from '../../components/Icon';
import { Avatar, Btn, Checks, Empty, ErrorBox, Pill, useToast } from '../../components/ui';
import { Screen, ScreenLoading, useAttention } from '../../components/layout';

export async function loadAlerts() {
  await sweepNoShows();
  const since = new Date(Date.now() - 24 * 3600e3).toISOString();
  return q<any[]>(supabase.from('alerts')
    .select('*, parent:parents(name, pin_code, address, emergency_contact, care_needs, family:profiles!parents_family_id_fkey(full_name, phone)), shift:shifts!alerts_shift_id_fkey(id, start_at, end_at, caregiver_id, caregiver:caregivers(name, phone))')
    .or(`resolved_at.is.null,resolved_at.gte.${since}`).order('raised_at'));
}

export function useWide(query = '(min-width: 1100px)') {
  const [m, setM] = useState(() => typeof window !== 'undefined' && window.matchMedia(query).matches);
  useEffect(() => { const mq = window.matchMedia(query); const f = () => setM(mq.matches); mq.addEventListener('change', f); return () => mq.removeEventListener('change', f); }, [query]);
  return m;
}

const telOf = (s?: string | null) => (s?.match(/\+?\d[\d\s-]{7,}\d/)?.[0] ?? '').replace(/[^\d+]/g, '');
const titleOf = (a: any) => a.type === 'sos' ? `SOS: ${a.parent?.name}` : a.level === 'escalated' ? `Second miss: ${a.parent?.name}` : `No check-in: ${a.parent?.name}`;

/** FR6: the coordinator's alert desk. Queue on the left, the case on the right; on phones, one then the other. */
export default function AlertQueue() {
  const { alertId } = useParams();
  const wide = useWide();
  const nav = useNavigate();
  const { data, loading, error, reload } = useLive(loadAlerts, [], 10000);
  const { refresh } = useAttention();
  if (loading && !data) return <ScreenLoading title="Alerts" blocks={[88, 88, 88]} />;
  const open = (data ?? []).filter(a => !a.resolved_at).sort((x, y) => (x.level === 'escalated' ? -1 : 0) - (y.level === 'escalated' ? -1 : 0) || (x.type === 'sos' ? -1 : 0) - (y.type === 'sos' ? -1 : 0) || x.raised_at.localeCompare(y.raised_at));
  const done = (data ?? []).filter(a => a.resolved_at).sort((x, y) => y.resolved_at.localeCompare(x.resolved_at));
  const selId = alertId ?? (wide ? open[0]?.id : undefined);
  const sel = (data ?? []).find(a => a.id === selId);
  const after = () => { reload(); refresh(); };

  return (
    <Screen title="Alerts" sub={open.length ? `${open.length} open. Missed check-ins need a replacement within 4 hours.` : 'Nothing open right now.'} wide>
      <ErrorBox msg={error} />
      <div className={'desk' + (alertId ? ' has-sel' : '')}>
        <div className="desk-list stack-lg">
          <section className="section" aria-labelledby="open-h">
            <div className="sec-head"><h2 id="open-h">Open</h2><span className="t-xs">Oldest first, escalations at the top</span></div>
            {open.length === 0
              ? <div className="panel"><Empty icon="check" title="All clear">Missed check-ins and SOS calls appear here the moment they happen.</Empty></div>
              : <div className="panel flush">{open.map(a => <QueueItem key={a.id} a={a} current={a.id === selId} />)}</div>}
          </section>
          {done.length > 0 && (
            <section className="section" aria-labelledby="done-h">
              <div className="sec-head"><h2 id="done-h">Resolved in the last 24 hours</h2></div>
              <div className="panel flush">{done.map(a => <QueueItem key={a.id} a={a} current={a.id === selId} />)}</div>
            </section>
          )}
        </div>
        <div className="desk-detail">
          <button className="btn quiet sm desk-back" onClick={() => nav('/k')}><Icon name="back" size="sm" />All alerts</button>
          {sel ? <Detail key={sel.id} a={sel} onDone={after} />
            : alertId ? <div className="panel"><Empty icon="info" title="This alert is no longer in the queue">It was resolved more than a day ago.</Empty></div>
            : <div className="panel"><Empty icon="bell" title="Choose an alert">The case details and actions open here.</Empty></div>}
        </div>
      </div>
    </Screen>
  );
}

function QueueItem({ a, current }: { a: any; current: boolean }) {
  const resolved = !!a.resolved_at;
  const total = 4 * 3600e3;
  const left = a.due_by ? new Date(a.due_by).getTime() - Date.now() : 0;
  return (
    <Link className="q" to={`/k/alert/${a.id}`} aria-current={current ? 'true' : undefined}>
      <span className={'q-ic' + (resolved ? ' done' : a.level === 'escalated' ? ' esc' : '')}><Icon name={resolved ? 'check' : a.type === 'sos' ? 'bell' : 'warn'} size="sm" /></span>
      <span className="q-t">
        <b>{titleOf(a)}</b>
        <span>{resolved ? a.note : a.type === 'sos' ? `Pressed ${ago(a.raised_at)}, ${a.parent?.pin_code}` : `${a.shift?.caregiver?.name} due ${time(a.shift?.start_at)}, ${a.parent?.pin_code}`}</span>
        {!resolved && a.type === 'no_show' && a.due_by && <span className="countdown" aria-hidden="true"><i className={left < 3600e3 ? 'late' : ''} style={{ width: `${Math.max(2, Math.min(100, (left / total) * 100))}%` }} /></span>}
      </span>
      <span className={'q-end' + (resolved ? ' calm' : '')}>{resolved ? time(a.resolved_at) : a.type === 'sos' ? time(a.raised_at) : a.due_by ? minutesLeft(a.due_by) : ''}</span>
    </Link>
  );
}

function Detail({ a, onDone }: { a: any; onDone: () => void }) {
  if (a.resolved_at) return (
    <div className="panel pad stack">
      <div className="detail-head"><h2>{titleOf(a)}</h2><Pill tone="ok" dot>Resolved {time(a.resolved_at)}</Pill></div>
      <p className="muted">{a.note}</p>
      <div className="kv"><span>Raised</span><span>{time(a.raised_at)}</span></div>
      {a.shift && <div className="kv"><span>Shift</span><span>{a.shift.caregiver?.name}, {time(a.shift.start_at)}</span></div>}
    </div>
  );
  return a.type === 'sos' ? <SosDetail a={a} onDone={onDone} /> : <AssignDetail a={a} onDone={onDone} />;
}

function SosDetail({ a, onDone }: { a: any; onDone: () => void }) {
  const toast = useToast();
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fam = a.parent?.family;
  const near = a.parent?.emergency_contact;
  async function handled() {
    if (note.trim().length < 3) return setErr('Write what you did, for example who you spoke to.');
    setBusy(true); setErr(null);
    try { await rpc('resolve_alert', { p_alert: a.id, p_note: note.trim() }); toast('SOS marked handled. The family can see your note'); onDone(); }
    catch (x: any) { setErr(x.message); setBusy(false); }
  }
  return (
    <div className="stack-lg">
      <div className="panel pad">
        <div className="detail-head"><div><h2>SOS from {a.parent?.name}</h2><p className="t-sm muted" style={{ marginTop: 2 }}>Pressed at {time(a.raised_at)}, {ago(a.raised_at)}</p></div><Pill tone="bad" dot>Open</Pill></div>
        <div className="callout warn" style={{ marginTop: 16 }}><Icon name="phone" /><div>Call the nearby contact first, then the family. Send someone to the home if no one answers.</div></div>
        <div style={{ marginTop: 8 }}>
          <Contact label="Nearby contact" name={near || 'None listed on the profile'} phone={telOf(near)} />
          <Contact label="Family" name={`${fam?.full_name ?? 'Family'}`} display={fam?.phone} phone={telOf(fam?.phone)} />
          <div className="contact"><span className="av grey"><Icon name="home" size="sm" /></span><span className="c-t"><b>Home</b><span>{a.parent?.address}, {a.parent?.pin_code}</span></span>
            <a className="btn secondary sm" href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${a.parent?.address} ${a.parent?.pin_code}`)}`} target="_blank" rel="noreferrer"><Icon name="map" size="sm" />Map</a></div>
        </div>
      </div>
      <div className="panel pad stack">
        <div className="field"><label className="label" htmlFor="sos-note">What happened</label>
          <textarea className="textarea" id="sos-note" placeholder="Spoke to Mrs. Rao, who checked on her. All well." value={note} onChange={e => { setNote(e.target.value); setErr(null); }} />
          <span className="hint">The family sees this note on their alert page.</span></div>
        <ErrorBox msg={err} />
        <Btn busy={busy} busyText="Saving" onClick={handled}><Icon name="check" size="sm" />Mark handled</Btn>
      </div>
    </div>
  );
}

function Contact({ label, name, display, phone }: { label: string; name: string; display?: string; phone: string }) {
  return (
    <div className="contact">
      <span className="av sm brand"><Icon name="user" size="sm" /></span>
      <span className="c-t"><b>{label}</b><span>{name}{display ? `, ${display}` : ''}</span></span>
      {phone ? <a className="btn sm" href={`tel:${phone}`}><Icon name="phone" size="sm" />Call</a> : <span className="t-xs faint">No number</span>}
    </div>
  );
}

function AssignDetail({ a, onDone }: { a: any; onDone: () => void }) {
  const toast = useToast();
  const nav = useNavigate();
  const loc = useLocation();
  const { profile } = useAuth();
  const { data, loading, error } = useLive(async () => {
    const cgs = await q<any[]>(supabase.from('caregivers').select('*').eq('verified', true).neq('id', a.shift?.caregiver_id));
    const busy = await q<any[]>(supabase.from('shifts').select('caregiver_id').in('status', ['scheduled', 'checked_in'])
      .lt('start_at', a.shift?.end_at).gt('end_at', new Date().toISOString()));
    const busyIds = new Set(busy.map(b => b.caregiver_id));
    const pin = Number(a.parent?.pin_code);
    return cgs.map(c => ({ ...c, busy: busyIds.has(c.id), dist: Math.abs(Number(c.pin_code) - pin) }))
      .filter(c => c.dist < 200).sort((x, y) => Number(x.busy) - Number(y.busy) || x.dist - y.dist);
  }, [a.id], 0);
  const options = [1, 2, 3, 4].map(h => { const d = new Date(Date.now() + h * 3600e3); d.setMinutes(Math.ceil(d.getMinutes() / 15) * 15, 0, 0); return d; })
    .filter(d => !a.due_by || d.getTime() <= new Date(a.due_by).getTime() + 15 * 60000);
  const [arrive, setArrive] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function assign(c: any) {
    setBusy(c.id); setErr(null);
    try {
      await rpc('assign_replacement', { p_alert: a.id, p_caregiver: c.id, p_arrive: (options[arrive] ?? options[0]).toISOString() });
      toast(`${c.name} assigned. The family has been told`); onDone();
      if (profile?.role === 'admin' && a.level === 'escalated' && loc.pathname.startsWith('/k/assign')) nav('/a/escalations', { replace: true });
    } catch (x: any) { setErr(x.message); setBusy(null); }
  }
  const fam = a.parent?.family;
  return (
    <div className="stack-lg">
      <div className="panel pad">
        <div className="detail-head">
          <div><h2>{a.level === 'escalated' ? 'Replacement also missed' : 'Missed check-in'}: {a.parent?.name}</h2>
            <p className="t-sm muted" style={{ marginTop: 2 }}>{a.shift?.caregiver?.name} was due at {time(a.shift?.start_at)}. Alert raised {time(a.raised_at)}.</p></div>
          {a.due_by && <Pill tone={new Date(a.due_by).getTime() - Date.now() < 3600e3 ? 'bad' : 'warn'} dot>{minutesLeft(a.due_by)}</Pill>}
        </div>
        <div style={{ marginTop: 12 }}>
          <div className="kv"><span>Needs</span><span>{(a.parent?.care_needs || []).join(', ') || 'None noted'}</span></div>
          <div className="kv"><span>Area</span><span>{a.parent?.pin_code}</span></div>
          <div className="kv"><span>Family</span><span>{fam?.full_name}{fam?.phone ? <>, <a href={`tel:${telOf(fam.phone)}`}>{fam.phone}</a></> : ''}</span></div>
          {a.shift?.caregiver?.phone && <div className="kv"><span>Missed caregiver</span><span><a href={`tel:${telOf(a.shift.caregiver.phone)}`}>{a.shift.caregiver.phone}</a></span></div>}
        </div>
        {a.level === 'escalated' && <div className="callout warn" style={{ marginTop: 12 }}><Icon name="escal" /><div>The Care Operations head has been told. Send your most experienced caregiver and call the family.</div></div>}
      </div>

      <section className="section" aria-labelledby="arr-h">
        <div className="sec-head"><h2 id="arr-h">Replacement arrives by</h2></div>
        <div className="seg" role="radiogroup" aria-labelledby="arr-h">
          {options.map((d, i) => <button key={i} role="radio" aria-checked={arrive === i} onClick={() => setArrive(i)}>{time(d)}</button>)}
        </div>
      </section>

      <section className="section" aria-labelledby="cand-h">
        <div className="sec-head"><h2 id="cand-h">Verified caregivers nearby</h2><span className="t-xs">Free now first, then nearest</span></div>
        <ErrorBox msg={err || error} />
        {loading ? <div className="sk" style={{ height: 200 }} /> : data?.length === 0
          ? <div className="panel"><Empty icon="users" title="No verified caregivers nearby">Escalate to the Care Operations head and call the family.</Empty></div>
          : <div className="panel flush">
              {data?.map(c => (
                <div className={'cand' + (c.busy ? ' busy' : '')} key={c.id}>
                  <Avatar text={c.initials} tone="brand" />
                  <span className="c-t"><b>{c.name}</b><span>{c.busy ? 'On another shift now' : 'Free now'}, {c.area} {c.pin_code}, {years(c.years)}</span><Checks c={c} /></span>
                  <Btn className="sm" busy={busy === c.id} busyText="Assigning" disabled={!!busy || c.busy} onClick={() => assign(c)}>Assign {firstName(c.name)}</Btn>
                </div>
              ))}
            </div>}
      </section>
    </div>
  );
}
