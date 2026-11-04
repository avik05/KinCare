import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { rpc } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { useLive } from '../../lib/hooks';
import { dayLabel, firstName, time, todayIST } from '../../lib/format';
import Icon from '../../components/Icon';
import { Avatar, ErrorBox } from '../../components/ui';

const HOLD_MS = 2000, RING = 723;

/** Large type, one big action. Kept deliberately simple for an older person on a shared phone or tablet. */
export default function ElderHome() {
  const nav = useNavigate();
  const { signOut } = useAuth();
  const { data, loading, error } = useLive(async () => (await rpc<any[]>('elder_today'))[0] ?? null, [], 30000);
  const [holding, setHolding] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const ring = useRef<SVGCircleElement>(null);
  const raf = useRef(0), start = useRef(0), fired = useRef(false);

  useEffect(() => { document.title = 'Today | KinCare'; return () => cancelAnimationFrame(raf.current); }, []);
  if (loading && !data) return <div className="elder"><div className="skel"><div className="sk" style={{ height: 220 }} /><div className="sk" style={{ height: 216, width: 216, borderRadius: '50%', alignSelf: 'center' }} /></div></div>;

  function tick() {
    const p = Math.min(1, (performance.now() - start.current) / HOLD_MS);
    if (ring.current) ring.current.style.strokeDashoffset = String(RING * (1 - p));
    if (p >= 1 && !fired.current) { fired.current = true; send(); return; }
    raf.current = requestAnimationFrame(tick);
  }
  function down(e: React.SyntheticEvent) {
    e.preventDefault(); setErr(null); fired.current = false; start.current = performance.now(); setHolding(true);
    if (ring.current) ring.current.style.transition = '';
    raf.current = requestAnimationFrame(tick);
    try { navigator.vibrate?.(30); } catch { /* not supported */ }
  }
  function up() {
    cancelAnimationFrame(raf.current); setHolding(false);
    if (ring.current && !fired.current) { ring.current.style.transition = 'stroke-dashoffset .3s'; ring.current.style.strokeDashoffset = String(RING); }
  }
  async function send() {
    setHolding(false);
    try { navigator.vibrate?.([60, 40, 60]); } catch { /* not supported */ }
    try { await rpc('raise_sos'); nav('/e/sent'); }
    catch (x: any) { fired.current = false; setErr(x.message); if (ring.current) ring.current.style.strokeDashoffset = String(RING); }
  }

  const cg = data?.caregiver_name;
  const phone = data?.family_phone?.replace(/[^\d+]/g, '');
  return (
    <main className="elder">
      <p className="elder-date">{dayLabel(todayIST())}</p>
      <ErrorBox msg={error || err} />
      <div className="elder-who">
        {cg ? <>
          <Avatar text={data.caregiver_initials} tone="brand" size="xl" />
          <h1>{firstName(cg)} {data.status === 'checked_in' ? 'is with you now' : data.status === 'completed' ? 'came today' : 'is coming today'}</h1>
          <p>{time(data.start_at)} to {time(data.end_at)}</p>
        </> : <><h1>Hello, {firstName(data?.parent_name)}</h1><p>No carer is booked for today.</p></>}
      </div>
      <div className="sos-wrap">
        <button className={'sos' + (holding ? ' holding' : '')} aria-label="SOS. Press and hold for 2 seconds to call for help"
          onPointerDown={down} onPointerUp={up} onPointerLeave={up} onPointerCancel={up} onContextMenu={e => e.preventDefault()}
          onKeyDown={e => { if ((e.key === ' ' || e.key === 'Enter') && !e.repeat) down(e); }} onKeyUp={e => { if (e.key === ' ' || e.key === 'Enter') up(); }}>
          <svg className="hold" viewBox="0 0 248 248" aria-hidden="true"><circle ref={ring} cx="124" cy="124" r="115" /></svg>
          SOS<small>{holding ? 'Keep holding' : 'Press and hold'}</small>
        </button>
        <p className="sos-help">Hold the red button for 2 seconds. Your family and KinCare are told at once.</p>
      </div>
      {data?.family_name && (
        phone
          ? <a className="call" href={`tel:${phone}`}><span className="c-ic"><Icon name="phone" /></span><span><b>Call {firstName(data.family_name)}</b><span>{data.family_phone}</span></span></a>
          : <div className="call"><span className="c-ic"><Icon name="phone" /></span><span><b>{firstName(data.family_name)}</b><span>No phone number added yet</span></span></div>
      )}
      <button className="elder-out" onClick={signOut}>Sign out</button>
    </main>
  );
}
