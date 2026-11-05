import { FormEvent, useEffect, useRef, useState } from 'react';
import { cleanError, supabase } from '../../lib/supabase';
import { inr } from '../../lib/format';
import Icon from '../../components/Icon';
import { Btn, DoorPhoto, ErrorBox } from '../../components/ui';

/* ---------------- missed-visit simulator ---------------- */

const END = 150; // minutes after 8:00 am shown on the slider (8:00 to 10:30)
const MARKS = [
  { t: 0, label: 'Shift starts' },
  { t: 30, label: 'Family alerted' },
  { t: 45, label: 'Replacement assigned' },
  { t: 112, label: 'Replacement checks in' },
];
const clock = (t: number) => {
  const m = 8 * 60 + Math.round(t);
  const h = Math.floor(m / 60), mm = m % 60;
  return `${((h + 11) % 12) + 1}:${String(mm).padStart(2, '0')} ${h < 12 ? 'am' : 'pm'}`;
};
type Tone = 'ok' | 'bad' | 'wait' | 'calm';
type View = { tone: Tone; head: string; sub: string; extra?: 'photo' | 'countdown' | 'map' };

function views(t: number): { stage: number; caption: string; family: View; cg: { who: string } & View; desk: View; elder: { who: string; when: string } } {
  if (t < 30) return {
    stage: 0, caption: 'Lakshmi is due at Amma’s door at 8:00 am. Nobody has checked in yet.',
    family: { tone: 'wait', head: 'Lakshmi is due at 8:00 am', sub: 'You will be alerted if there is no check-in by 8:30.' },
    cg: { who: 'Lakshmi', tone: 'wait', head: 'Check in at the door', sub: 'Amma’s home, Adyar. Shift started at 8:00 am.' },
    desk: { tone: 'ok', head: 'All clear', sub: 'No missed check-ins in Chennai right now.' },
    elder: { who: 'Lakshmi is coming today', when: '8:00 am to 8:00 pm' },
  };
  if (t < 45) return {
    stage: 1, caption: '30 minutes, no check-in. The shift is marked missed and the family and coordinator are alerted together.',
    family: { tone: 'bad', head: 'Lakshmi has not checked in', sub: 'Alert at 8:30 am. KinCare is assigning a replacement.' },
    cg: { who: 'Lakshmi', tone: 'bad', head: 'Shift marked missed', sub: 'No check-in by 8:30 am, so cover is being arranged.' },
    desk: { tone: 'bad', head: 'No check-in: Kamala Iyer', sub: 'Replace by 12:30 pm. Selvi M. is free nearby.', extra: 'countdown' },
    elder: { who: 'Lakshmi is coming today', when: '8:00 am to 8:00 pm' },
  };
  if (t < 112) return {
    stage: 2, caption: 'The coordinator assigns Selvi, a verified caregiver nearby. The family sees it at once, with no calls needed.',
    family: { tone: 'wait', head: 'Selvi is on the way', sub: 'Replacement caregiver, arriving by 10:00 am.' },
    cg: { who: 'Selvi', tone: 'wait', head: 'New cover shift, 10:00 am', sub: 'Amma’s home, Adyar. Address shown for this shift.', extra: 'map' },
    desk: { tone: 'ok', head: 'Selvi M. assigned at 8:45 am', sub: 'The family has been told. Arriving by 10:00 am.' },
    elder: { who: 'Selvi is coming today', when: 'Arriving by 10:00 am' },
  };
  return {
    stage: 3, caption: 'Selvi checks in at the door at 9:52 am, well inside the 4-hour promise. The record carries on as normal.',
    family: { tone: 'ok', head: 'Selvi checked in at 9:52 am', sub: 'Location and door photo recorded.', extra: 'photo' },
    cg: { who: 'Selvi', tone: 'ok', head: 'Checked in at 9:52 am', sub: 'Log tasks and readings as you go.' },
    desk: { tone: 'calm', head: 'Resolved at 9:52 am', sub: 'Replaced in 1 hour 22 minutes.' },
    elder: { who: 'Selvi is with you now', when: 'Until 8:00 pm' },
  };
}

function SimCard({ label, icon, v, k }: { label: string; icon: string; v: View; k: string }) {
  return (
    <div className="lp-sim-card">
      <div className="lp-sim-label"><Icon name={icon} size="sm" />{label}</div>
      <div key={k} className={'lp-sim-now ' + v.tone}>
        <span className="lp-sim-dot" />
        <div><b>{v.head}</b><span>{v.sub}</span></div>
      </div>
      {v.extra === 'photo' && <div className="lp-sim-photo"><DoorPhoto /><div className="proof-tags"><span><Icon name="clock" size="sm" />9:52 am</span><span><Icon name="pin" size="sm" />Within 9 m</span></div></div>}
      {v.extra === 'countdown' && <div className="lp-sim-count"><div><span>Time left to replace</span><b>4 h</b></div><i><em /></i></div>}
      {v.extra === 'map' && <div className="lp-sim-btn"><Icon name="map" size="sm" />Open in Maps</div>}
    </div>
  );
}

/** Drag the clock, or press play, to watch one missed visit from four people's screens at once. */
export function Simulator() {
  const [t, setT] = useState(0);
  const [playing, setPlaying] = useState(false);
  const raf = useRef(0), last = useRef(0), auto = useRef(false);
  const box = useRef<HTMLDivElement>(null);
  const v = views(t);

  useEffect(() => {
    if (!playing) return;
    last.current = performance.now();
    const step = (now: number) => {
      const dt = now - last.current; last.current = now;
      let stop = false;
      setT(x => { const n = Math.min(END, x + dt * (END / 10000)); if (n >= END) stop = true; return n; });
      if (stop) { setPlaying(false); return; }
      raf.current = requestAnimationFrame(step);
    };
    raf.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf.current);
  }, [playing]);
  useEffect(() => { if (t >= END) setPlaying(false); }, [t]);

  // Play once by itself when the section first comes into view, unless the visitor prefers less motion.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches || !box.current) return;
    const io = new IntersectionObserver(es => { if (es[0].isIntersecting && !auto.current) { auto.current = true; setTimeout(() => setPlaying(true), 600); } }, { threshold: .45 });
    io.observe(box.current);
    return () => io.disconnect();
  }, []);

  const play = () => { if (t >= END) setT(0); setPlaying(p => !p); };
  return (
    <div className="lp-sim" ref={box}>
      <div className="lp-sim-top">
        <div className="lp-sim-clock" aria-live="polite"><time>{clock(t)}</time><p>{v.caption}</p></div>
        <button className="btn secondary lp-sim-play" onClick={play} aria-label={playing ? 'Pause' : t >= END ? 'Replay' : 'Play'}>
          {playing ? <svg className="ic" viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="5" width="3.5" height="14" rx="1" fill="currentColor" /><rect x="14" y="5" width="3.5" height="14" rx="1" fill="currentColor" /></svg>
            : t >= END ? <Icon name="refresh" /> : <svg className="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" fill="currentColor" /></svg>}
          {playing ? 'Pause' : t >= END ? 'Replay' : 'Play'}
        </button>
      </div>
      <div className="lp-sim-track">
        <input type="range" min={0} max={END} step={1} value={Math.round(t)} aria-label="Time of day" aria-valuetext={clock(t)}
          onChange={e => { setPlaying(false); setT(Number(e.target.value)); }} style={{ ['--p' as any]: `${(t / END) * 100}%` }} />
        <div className="lp-sim-marks" aria-hidden="true">
          {MARKS.map((m, i) => (
            <button key={m.t} tabIndex={-1} className={'lp-sim-mark' + (v.stage >= i ? ' on' : '') + (i === 1 ? ' bad' : '')} style={{ left: `${(m.t / END) * 100}%` }} onClick={() => { setPlaying(false); setT(m.t); }}>
              <i /><span>{clock(m.t)}</span><small>{m.label}</small>
            </button>
          ))}
        </div>
      </div>
      <div className="lp-sim-grid">
        <SimCard label="Meera’s phone, Singapore" icon="user" v={v.family} k={'f' + v.stage} />
        <SimCard label={`${v.cg.who}’s phone, caregiver`} icon="door" v={v.cg} k={'c' + v.stage} />
        <SimCard label="Ravi’s alert desk, KinCare" icon="bell" v={v.desk} k={'d' + v.stage} />
        <div className="lp-sim-card lp-sim-elder">
          <div className="lp-sim-label"><Icon name="home" size="sm" />Amma’s screen, Chennai</div>
          <div key={'e' + v.stage} className="lp-sim-elder-body">
            <b>{v.elder.who}</b><span>{v.elder.when}</span>
            <div className="lp-sos sm">SOS</div>
          </div>
        </div>
      </div>
      <p className="lp-sim-foot"><Icon name="escal" size="sm" />If the replacement misses too, the case goes straight to the head of care operations.</p>
    </div>
  );
}

/* ---------------- cost calculator ---------------- */

const RATES = { 12: { min: 850, max: 1200, def: 1100 }, 24: { min: 1500, max: 1900, def: 1700 } } as const;
const FEE = 1999, AGENCY = { min: 900, max: 2000 };

/** What a block of care costs with KinCare, next to what an agency paid in cash charges for the same days. */
export function Calculator() {
  const [hours, setHours] = useState<12 | 24>(12);
  const [days, setDays] = useState(14);
  const [rate, setRate] = useState<number>(RATES[12].def);
  const r = RATES[hours];
  const care = rate * days;
  const total = care + FEE * Math.ceil(days / 30);
  return (
    <article className="lp-plan lp-calc">
      <span className="what">Work out your cost</span>
      <div className="lp-calc-ctl">
        <div className="seg" role="radiogroup" aria-label="Shift">
          {([12, 24] as const).map(h => <button key={h} role="radio" aria-checked={hours === h} onClick={() => { setHours(h); setRate(RATES[h].def); }}>{h === 12 ? '12-hour day' : '24-hour live-in'}</button>)}
        </div>
        <div className="seg" role="radiogroup" aria-label="Days">
          {[14, 21, 28].map(d => <button key={d} role="radio" aria-checked={days === d} onClick={() => setDays(d)}>{d} days</button>)}
        </div>
        <label className="lp-calc-rate">
          <span><span>Caregiver’s day rate</span><b>{inr(rate)}</b></span>
          <input type="range" min={r.min} max={r.max} step={50} value={rate} onChange={e => setRate(Number(e.target.value))} style={{ ['--p' as any]: `${((rate - r.min) / (r.max - r.min)) * 100}%` }} />
          <small><span>{inr(r.min)}</span><span>{inr(r.max)}</span></small>
        </label>
      </div>
      <div className="lp-calc-out">
        <div className="lp-rate"><span>Care, {days} days at {inr(rate)}</span><b>{inr(care)}</b></div>
        <div className="lp-rate"><span>KinCare membership, 1 month</span><b>{inr(FEE)}</b></div>
        <div className="lp-calc-total"><span>Total for {days} days</span><b>{inr(total)}</b></div>
        <p className="lp-calc-per">That is {inr(Math.round(total / days))} a day, all in.</p>
      </div>
      <div className="lp-example">
        An agency paid in cash charges about <b>{inr(AGENCY.min * days)} to {inr(AGENCY.max * days)}</b> for the same {days} days, with no police check you can see, no record of the visit and no promise of cover if someone does not come.
      </div>
    </article>
  );
}

/* ---------------- request a call ---------------- */

/** A real lead: saved to the database and shown on the coordinator's Call requests page. */
export function CallForm() {
  const [f, setF] = useState({ name: '', phone: '', city: '', note: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: any) => { setF({ ...f, [k]: e.target.value }); setErr(null); };

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (f.name.trim().length < 2) return setErr('Enter your name.');
    const digits = f.phone.replace(/[^\d+]/g, '');
    if (!/^\+?\d{10,13}$/.test(digits)) return setErr('Enter a 10-digit mobile number, or include the country code.');
    if (!f.city) return setErr('Choose where your parent lives.');
    setBusy(true); setErr(null);
    const { data, error } = await supabase.rpc('request_callback', { p_name: f.name.trim(), p_phone: digits, p_city: f.city, p_note: f.note.trim() || null });
    setBusy(false);
    if (error) return setErr(/request_callback/.test(error.message) ? 'Call requests are not open yet. Please try again later.' : cleanError(error.message));
    setDone(data === 'already' ? 'We already have your request from a few minutes ago.' : 'Request received.');
  }

  if (done) return (
    <div className="lp-call lp-call-done" role="status">
      <span className="lp-call-ok"><Icon name="check" /></span>
      <h3>{done}</h3>
      <p>A KinCare coordinator in {f.city === 'Other' ? 'your parent’s city' : f.city} will call you on {f.phone.trim()}, usually the same day. You do not need to do anything else.</p>
      <button className="btn secondary sm" onClick={() => { setDone(null); setF({ name: '', phone: '', city: '', note: '' }); }}>Request another call</button>
    </div>
  );
  return (
    <form className="lp-call" onSubmit={submit} noValidate>
      <h3>Rather talk it through first?</h3>
      <p>Leave your number and a coordinator will call you, usually the same day.</p>
      <div className="lp-call-fields">
        <div className="field"><label className="label" htmlFor="cb-name">Your name</label><input className="input" id="cb-name" autoComplete="name" value={f.name} onChange={set('name')} /></div>
        <div className="field"><label className="label" htmlFor="cb-phone">Mobile number</label><input className="input" id="cb-phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="98400 12345" value={f.phone} onChange={set('phone')} /></div>
      </div>
      <div className="field" style={{ marginTop: 14 }}>
        <span className="label" id="cb-city">Where your parent lives</span>
        <div className="seg" role="radiogroup" aria-labelledby="cb-city">
          {['Chennai', 'Kolkata', 'Other'].map(c => <button type="button" key={c} role="radio" aria-checked={f.city === c} onClick={() => { setF({ ...f, city: c }); setErr(null); }}>{c === 'Other' ? 'Somewhere else' : c}</button>)}
        </div>
      </div>
      <div className="field" style={{ marginTop: 14 }}><label className="label" htmlFor="cb-note">Anything we should know <span className="opt">(optional)</span></label>
        <input className="input" id="cb-note" maxLength={300} placeholder="Mother, 81, needs help after a fall" value={f.note} onChange={set('note')} /></div>
      <div style={{ marginTop: 14 }}><ErrorBox msg={err} /></div>
      <Btn className="block" style={{ marginTop: err ? 12 : 0 }} busy={busy} busyText="Sending">Request a call</Btn>
      <p className="lp-call-small">We use your number only to call you about care. Only KinCare coordinators can see it.</p>
    </form>
  );
}
