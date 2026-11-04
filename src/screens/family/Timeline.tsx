import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { photoUrl, q, supabase } from '../../lib/supabase';
import { useLive } from '../../lib/hooks';
import { dayLabel, firstName, istDateOf, time, todayIST } from '../../lib/format';
import Icon, { taskIcon } from '../../components/Icon';
import { AppBar, DoorPhoto, ErrorBox, Loading } from '../../components/ui';
import { FamilyTabs } from './booking';

type Ev = { key: string; at: string; kind: 'ok' | 'bad' | 'pending'; title: string; icon?: string; body?: string; photo?: { path: string; stamp: string }; reading?: any; loc?: any };

async function load(parentId?: string) {
  const parents = await q<any[]>(supabase.from('parents').select('id, name, relation').order('created_at'));
  const parent = parents.find(p => p.id === parentId) || parents[0];
  if (!parent) return { parents, parent: null, days: [] as [string, Ev[]][] };
  const from = todayIST(-6), to = todayIST();
  const [shifts, alerts, settings] = await Promise.all([
    q<any[]>(supabase.from('shifts').select('id, status, start_at, end_at, shift_date, replacement_of, caregiver:caregivers(name)').eq('parent_id', parent.id).gte('shift_date', from).lte('shift_date', to)),
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
      evs.push({ key: 'rep' + s.id, at: a?.resolved_at || s.created_at || s.start_at, kind: 'ok', title: `${who} assigned as replacement`, body: `Arriving by ${time(s.start_at)}.` });
    }
    if (v) {
      evs.push({ key: 'in' + v.id, at: v.check_in_at, kind: 'ok', title: `${firstName(who)} checked in`, icon: 'pin',
        body: v.lat ? `Location recorded${v.accuracy_m ? `, accurate to ${Math.round(v.accuracy_m)} m` : ''}` : 'At home',
        loc: v.lat ? { lat: v.lat, lng: v.lng } : null, photo: v.photo_path ? { path: v.photo_path, stamp: time(v.check_in_at) } : undefined });
      for (const [task, at] of Object.entries(v.tasks || {})) evs.push({ key: 't' + v.id + task, at: at as string, kind: 'ok', title: task, icon: taskIcon(task), body: `Done by ${firstName(who)}` });
      for (const r of readings.filter(r => r.visit_id === v.id)) evs.push({ key: 'r' + r.id, at: r.recorded_at, kind: 'ok', title: 'Readings', icon: 'heart', reading: r });
      if (v.check_out_at) evs.push({ key: 'out' + v.id, at: v.check_out_at, kind: 'ok', title: `${firstName(who)} checked out`, body: `${Object.keys(v.tasks || {}).length} tasks done.` });
    } else if (s.status === 'missed') {
      const a = alerts.find(x => x.shift_id === s.id);
      evs.push({ key: 'm' + s.id, at: a?.raised_at || s.start_at, kind: 'bad', title: `No check-in by ${time(new Date(new Date(s.start_at).getTime() + settings.no_show_minutes * 60000))}`,
        body: a?.level === 'escalated' ? 'The replacement did not arrive either. Escalated to the Care Operations head.' : `${who} did not arrive. You and your coordinator were alerted.` });
    } else if (s.status === 'scheduled') {
      evs.push({ key: 'due' + s.id, at: s.start_at, kind: 'pending', title: `${who} is due`, body: `You will be alerted if there is no check-in within ${settings.no_show_minutes} minutes.` });
    }
  }
  for (const a of alerts.filter(a => a.type === 'sos')) {
    evs.push({ key: 'sos' + a.id, at: a.raised_at, kind: 'bad', title: 'SOS pressed', icon: 'warn', body: a.resolved_at ? (a.note || 'Handled by your coordinator.') : 'Your coordinator is calling now.' });
  }
  const byDay = new Map<string, Ev[]>();
  for (const e of evs.sort((a, b) => a.at.localeCompare(b.at))) {
    const d = istDateOf(e.at); if (!byDay.has(d)) byDay.set(d, []); byDay.get(d)!.push(e);
  }
  return { parents, parent, days: [...byDay.entries()].sort((a, b) => b[0].localeCompare(a[0])) };
}

function Photo({ path, stamp }: { path: string; stamp: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => { photoUrl(path).then(setUrl); }, [path]);
  if (path === 'sample') return <DoorPhoto stamp={stamp + ', sample'} />;
  return url ? <img className="photo" src={url} alt={`Check-in photo at the door, ${stamp}`} loading="lazy" /> : <div className="photo" style={{ height: 120 }} />;
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

  if (loading && !data) return <div className="shell"><Loading /></div>;
  const parent = data?.parent;
  return (
    <div className="shell"><main className="page">
      <AppBar title={parent ? `${parent.relation !== 'Parent' ? parent.relation : parent.name}’s visits` : 'Visits'} />
      <ErrorBox msg={error} />
      {data && data.parents.length > 1 && (
        <div className="parent-tabs" style={{ marginBottom: 10 }}>
          {data.parents.map(p => <button key={p.id} className="pill" aria-pressed={p.id === parent?.id} onClick={() => nav(`/f/timeline/${p.id}`)}>{p.relation !== 'Parent' ? p.relation : p.name}</button>)}
        </div>
      )}
      {!parent && <div className="surface empty">Add a parent and book care to see visits here. <Link to="/f/add-parent">Add a parent</Link></div>}
      {parent && !data.days.length && <div className="surface empty">No visits in the last 7 days.</div>}
      {data?.days.map(([day, evs]) => (
        <section key={day}>
          <h2 className="daylabel">{day === todayIST() ? `Today, ${dayLabel(day).split(',')[1]?.trim() ?? ''}` : dayLabel(day)}</h2>
          <div className="tl">
            {evs.map(e => (
              <div key={e.key} className={'ev' + (e.kind === 'bad' ? ' bad' : e.kind === 'pending' ? ' pending' : '') + (fresh.has(e.key) ? ' new' : '')}>
                <span className="evtime">{time(e.at)}</span>
                <div className="evbody">
                  <h4>{e.icon && <Icon name={e.icon} size="sm" />}{e.title}</h4>
                  {e.body && <p>{e.body}{e.loc && <>{'. '}<a href={`https://www.google.com/maps?q=${e.loc.lat},${e.loc.lng}`} target="_blank" rel="noreferrer">View on map</a></>}</p>}
                  {e.photo && <Photo path={e.photo.path} stamp={e.photo.stamp} />}
                  {e.reading && <>
                    <div className="readings">
                      {e.reading.bp_systolic && <div className="reading"><b>{e.reading.bp_systolic}/{e.reading.bp_diastolic}</b><span>BP, mmHg</span></div>}
                      {e.reading.sugar && <div className="reading"><b>{e.reading.sugar}</b><span>Sugar, mg/dL</span></div>}
                    </div>
                    <p className="lock"><Icon name="lock" size="sm" />Visible to you, your coordinator and the caregiver on shift</p>
                  </>}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </main><FamilyTabs /></div>
  );
}
