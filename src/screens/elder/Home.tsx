import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { rpc } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { useLive } from '../../lib/hooks';
import { firstName, time } from '../../lib/format';
import Icon from '../../components/Icon';
import { Avatar, ErrorBox, Loading } from '../../components/ui';

const HOLD_MS = 2000, RING = 691;

export default function ElderHome() {
  const nav = useNavigate();
  const { signOut } = useAuth();
  const { data, loading, error } = useLive(async () => (await rpc<any[]>('elder_today'))[0] ?? null, [], 30000);
  const [holding, setHolding] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ring = useRef<SVGCircleElement>(null);
  const raf = useRef(0), start = useRef(0), fired = useRef(false);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  if (loading && !data) return <div className="shell white"><Loading /></div>;

  function tick() {
    const p = Math.min(1, (performance.now() - start.current) / HOLD_MS);
    if (ring.current) ring.current.style.strokeDashoffset = String(RING * (1 - p));
    if (p >= 1 && !fired.current) { fired.current = true; send(); return; }
    raf.current = requestAnimationFrame(tick);
  }
  function down(e: React.SyntheticEvent) {
    e.preventDefault(); fired.current = false; start.current = performance.now(); setHolding(true); raf.current = requestAnimationFrame(tick);
  }
  function up() {
    cancelAnimationFrame(raf.current); setHolding(false);
    if (ring.current && !fired.current) { ring.current.style.transition = 'stroke-dashoffset .3s'; ring.current.style.strokeDashoffset = String(RING); setTimeout(() => ring.current && (ring.current.style.transition = ''), 300); }
  }
  async function send() {
    setHolding(false);
    try { await rpc('raise_sos'); nav('/e/sent'); }
    catch (x: any) { fired.current = false; setErr(x.message); if (ring.current) ring.current.style.strokeDashoffset = String(RING); }
  }

  const cg = data?.caregiver_name;
  return (
    <div className="shell white"><main className="page" style={{ display: 'flex', flexDirection: 'column', paddingTop: 40 }}>
      <ErrorBox msg={error || err} />
      <div className="elder-today">
        {cg ? <>
          <div style={{ display: 'flex', justifyContent: 'center' }}><Avatar text={data.caregiver_initials} tone="leaf" size="xl" /></div>
          <h1>{firstName(cg)} {data.status === 'checked_in' ? 'is with you today' : 'is coming today'}</h1>
          <p>{time(data.start_at)} to {time(data.end_at)}</p>
        </> : <><h1>Hello, {firstName(data?.parent_name)}</h1><p>No carer is booked for today.</p></>}
      </div>
      <div className="sos-wrap">
        <button className={'sos' + (holding ? ' holding' : '')} aria-label="Hold for 2 seconds to send SOS"
          onPointerDown={down} onPointerUp={up} onPointerLeave={up} onPointerCancel={up} onContextMenu={e => e.preventDefault()}
          onKeyDown={e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) down(e); }} onKeyUp={e => { if (e.key === ' ' || e.key === 'Enter') up(); }}>
          <svg className="hold" viewBox="0 0 238 238" aria-hidden="true"><circle ref={ring} cx="119" cy="119" r="110" /></svg>
          SOS<small>Hold to call for help</small>
        </button>
        <p className="center" style={{ margin: 0, fontSize: 16, color: 'var(--ink-2)', maxWidth: '26ch' }}>Hold the button for 2 seconds. Your family and KinCare will be told at once.</p>
      </div>
      {data?.family_name && (
        <div className="surface" style={{ background: 'var(--leaf-faint)', marginTop: 'auto' }}>
          <p style={{ margin: 0, fontSize: 18 }}>To call {firstName(data.family_name)}:</p>
          <p style={{ margin: '4px 0 0', fontSize: 24, fontFamily: 'var(--display)', fontWeight: 600, userSelect: 'all' }}>
            {data.family_phone ? <a href={`tel:${data.family_phone.replace(/\s/g, '')}`} style={{ textDecoration: 'none' }}><Icon name="phone" /> {data.family_phone}</a> : 'Number not added'}
          </p>
        </div>
      )}
      <button className="linkbtn" style={{ marginTop: 18, alignSelf: 'center' }} onClick={signOut}>Sign out</button>
    </main></div>
  );
}
