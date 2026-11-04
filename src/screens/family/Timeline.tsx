import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { photoUrl, q, supabase } from '../../lib/supabase';
import { useLive } from '../../lib/hooks';
import { dayLabel, firstName, istDateOf, parentLabel, relDay, time, todayIST } from '../../lib/format';
import Icon, { taskIcon } from '../../components/Icon';
import { DoorPhoto, Empty, ErrorBox, ProofCard } from '../../components/ui';
import { Screen, ScreenLoading } from '../../components/layout';

type Ev = { key: string; at: string; kind: 'major' | 'small' | 'bad' | 'pending'; title: string; icon: string; body?: string; photo?: { path: string; acc?: number; lat?: number; lng?: number }; reading?: any };

async function load(parentId?: string) {
  const parents = await q<any[]>(supabase.from('parents').select('id, name, relation').order('created_at'));
  const parent = parents.find(p => p.id === parentId) || parents[0];
  if (!parent) return { parents, parent: null, days: [] as [string, Ev[]][] };
  const from = todayIST(-6), to = todayIST();
  const [shifts, alerts, settings] = await Promise.all([
    q<any[]>(supabase.from('shifts').select('id, status, start_at, end_at, shift_date, replacement_of, created_at, caregiver:caregivers(name)').eq('parent_id', parent.id).gte('shift_date', from).lte('shift_date', to)),
    q<any[]>(supabase.from('alerts').select('*').eq('parent_id', parent.id).gte('raised_at', new Date(Date.now() - 7 * 864e5).toISOString())),
    q<any>(supabase.from('settings').select('no_show_minutes').single()),
  ]);
  const ids = shifts.map(s => s.id);
  const visits = ids.length ? await q<any[]>(supabase.from('visits').select('*').in('shift_id', ids)) : [];
  const readings = visits.length ? await q<any[]>(supabase.from('readings').select('*').in('visit_id', visits.map(v => v.id))) : [];

  const evs: Ev[] = [];
  for (const s of shifts) {
    if (s.status === 'reassigned') continue;
    const who = s.caregiver?.name ?? 'Caregiver';
    const v = visits.find(x => x.shift_id === s.id);
    if (s.replacement_of) {
      const a = alerts.find(x => x.replacement_shift_id === s.id);
      evs.push({ key: 'rep' + s.id, at: a?.resolved_at || s.created_at || s.start_at, kind: 'major', icon: 'users', title: `${who} assigned as replacement`, body: `Arriving by ${time(s.start_at)}.` });
    }
    if (v) {
      evs.push({ key: 'in' + v.id, at: v.check_in_at, kind: 'major', icon: 'door', title: `${firstName(who)} checked in`,
        body: v.lat ? 'At the front door, with location and photo.' : 'At the front door.',
        photo: v.photo_path ? { path: v.photo_path, acc: v.accuracy_m, lat: v.lat, lng: v.lng } : undefined });
      for (const [task, at] of Object.entries(v.tasks || {})) evs.push({ key: 't' + v.id + task, at: at as string, kind: 'small', icon: taskIcon(task), title: task });
      for (const r of readings.filter(r => r.visit_id === v.id)) evs.push({ key: 'r' + r.id, at: r.recorded_at, kind: 'major', icon: 'pulse', title: 'Readings recorded', reading: r });
      if (v.check_out_at) evs.push({ key: 'out' + v.id, at: v.check_out_at, kind: 'major', icon: 'check', title: `${firstName(who)} checked out`, body: `${Object.keys(v.tasks || {}).length} tasks done during the visit.` });
    } else if (s.status === 'missed') {
      const a = alerts.find(x => x.shift_id === s.id);
      evs.push({ key: 'm' + s.id, at: a?.raised_at || s.start_at, kind: 'bad', icon: 'warn', title: `No check-in by ${time(new Date(new Date(s.start_at).getTime() + settings.no_show_minutes * 60000))}`,
        body: a?.level === 'escalated' ? `${who}, the replacement, did not arrive either. Escalated to the Care Operations head.` : `${who} did not arrive. You and your coordinator were alerted.` });
    } else if (s.status === 'scheduled') {
      evs.push({ key: 'due' + s.id, at: s.start_at, kind: 'pending', icon: 'clock', title: `${who} is due`, body: `You will be alerted if there is no check-in within ${settings.no_show_minutes} minutes.` });
    }
  }
  for (const a of alerts.filter(a => a.type === 'sos')) {
    evs.push({ key: 'sos' + a.id, at: a.raised_at, kind: 'bad', icon: 'warn', title: 'SOS pressed', body: a.resolved_at ? `Handled at ${time(a.resolved_at)}. ${a.note || ''}` : 'Your coordinator is calling now.' });
  }
  const byDay = new Map<string, Ev[]>();
  for (const e of evs.sort((a, b) => a.at.localeCompare(b.at))) {
    const d = istDateOf(e.at); if (!byDay.has(d)) byDay.set(d, []); byDay.get(d)!.push(e);
  }
  return { parents, parent, days: [...byDay.entries()].sort((a, b) => b[0].localeCompare(a[0])) };
}

function Photo({ path, at, acc, lat, lng }: { path: string; at: string; acc?: number; lat?: number; lng?: number }) {
  const [url, setUrl] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => { if (path !== 'sample') photoUrl(path).then(u => (u ? setUrl(u) : setFailed(true))); }, [path]);
  const tags: { icon: string; text: string; href?: string }[] = [{ icon: 'clock', text: time(at) }];
  if (acc != null) tags.push({ icon: 'pin', text: `Within ${Math.round(acc)} m` });
  if (lat != null) tags.push({ icon: 'map', text: 'Open map', href: `https://www.google.com/maps?q=${lat},${lng}` });
  const img = path === 'sample' ? <DoorPhoto />
    : url ? <img src={url} alt={`Door photo taken at check-in, ${time(at)}`} loading="lazy" />
    : <div className="sk" style={{ position: 'absolute', inset: 0, borderRadius: 0, animation: failed ? 'none' : undefined }} />;
  return <ProofCard img={img} tags={tags} />;
}

export default function Timeline() {
  const { parentId } = useParams();
  const nav = useNavigate();
  const { data, loading, error } = useLive(() => load(parentId), [parentId], 10000);
  const seen = useRef<Set<string> | null>(null);
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  useEffect(() => {
    if (!data) return;
    const keys = data.days.flatMap(([, e]) => e.map(x => x.key));
    if (seen.current) setFresh(new Set(keys.filter(k => !seen.current!.has(k))));
    seen.current = new Set(keys);
  }, [data]);
  useEffect(() => { seen.current = null; }, [parentId]);

  if (loading && !data) return <ScreenLoading title="Visits" blocks={[48, 260, 120, 120]} />;
  const parent = data?.parent;
  return (
    <Screen title="Visits" sub={parent ? `${parentLabel(parent)}’s last 7 days, newest first. Updates live.` : undefined}>
      <ErrorBox msg={error} />
      {data && data.parents.length > 1 && (
        <div className="switcher" role="group" aria-label="Choose a parent" style={{ marginBottom: 8 }}>
          {data.parents.map(p => <button key={p.id} className="chip" aria-pressed={p.id === parent?.id} onClick={() => nav(`/f/timeline/${p.id}`)}>{parentLabel(p)}</button>)}
        </div>
      )}
      {!parent && <div className="panel"><Empty icon="tl" title="No visits yet" action={<Link className="btn" to="/f/add-parent">Add a parent</Link>}>Add a parent and book care. Every check-in, task and reading will appear here.</Empty></div>}
      {parent && !data!.days.length && <div className="panel"><Empty icon="tl" title="No visits in the last 7 days" action={<Link className="btn" to="/f/book">Book care</Link>}>When a caregiver checks in, the time, location and door photo appear here straight away.</Empty></div>}
      {data?.days.map(([day, evs]) => (
        <section key={day} aria-label={dayLabel(day)}>
          <h2 className="day-h">{relDay(day)}{day === todayIST() || day === todayIST(-1) ? <span>{dayLabel(day)}</span> : null}</h2>
          <ol className="tl">
            {evs.map(e => (
              <li key={e.key} className={'ev ' + e.kind + (fresh.has(e.key) ? ' new' : '')}>
                <span className="ev-time">{time(e.at)}</span>
                <span className="ev-node"><Icon name={e.kind === 'small' ? 'check' : e.icon} size="sm" /></span>
                <div className="ev-body">
                  <h3>{e.title}</h3>
                  {e.body && <p>{e.body}</p>}
                  {e.photo && <Photo path={e.photo.path} at={e.at} acc={e.photo.acc} lat={e.photo.lat} lng={e.photo.lng} />}
                  {e.reading && <>
                    <div className="readings">
                      {e.reading.bp_systolic && <div className="vital"><b>{e.reading.bp_systolic}/{e.reading.bp_diastolic}</b><span>Blood pressure, mmHg</span></div>}
                      {e.reading.sugar && <div className="vital"><b>{e.reading.sugar}</b><span>Blood sugar, mg/dL</span></div>}
                    </div>
                    <p className="lock"><Icon name="lock" size="sm" />Only you, your coordinator and the caregiver on shift can see this.</p>
                  </>}
                </div>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </Screen>
  );
}
