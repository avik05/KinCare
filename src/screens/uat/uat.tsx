import { FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase, rpc, cleanError } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import Icon from '../../components/Icon';
import { BrandMark, Btn, DoneMark, ErrorBox } from '../../components/ui';
import { AuthSide } from '../auth/Login';

/* Milestone 4, Layer 4: a self-guided user test. The tester gets a private sample family, does three timed tasks
   in the real app, then rates it. Only an anonymous code (P1, P2 ...) is stored with the results. */

type Uat = { code: string; pin: string; task: number; at: number; done: number[] };
const KEY = 'kincare-uat';
export function readUat(): Uat | null { try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { return null; } }
function writeUat(u: Uat | null) { try { u ? localStorage.setItem(KEY, JSON.stringify(u)) : localStorage.removeItem(KEY); } catch { /* private mode */ } }

export const TASKS = [
  { title: 'Add your father and book care',
    text: (pin: string) => <>Your father, <b>Venkat Rao</b>, is 80 and lives with Amma at <b>9, 2nd Cross Street, Kalakshetra Colony, Thiruvanmiyur, Chennai</b>, pin code <b>{pin}</b>. Add him to KinCare, then book 12-hour care for him for 14 days, starting any day next week.</>,
    short: 'Add Venkat Rao and book 12-hour care for 14 days',
    ask: null },
  { title: 'Check yesterday’s visit',
    text: () => <>Find Amma’s visit record from <b>yesterday</b>. What time did the caregiver check in, and what was Amma’s blood pressure?</>,
    short: 'Yesterday: check-in time and Amma’s BP',
    ask: ['Check-in time', 'Blood pressure'] },
  { title: 'Find out about today’s missed visit',
    text: () => <>Today’s caregiver did not turn up. Find out <b>who replaced her</b>, and <b>what time the replacement checked in</b>.</>,
    short: 'Today: who replaced the caregiver, and when she checked in',
    ask: ['Replacement’s name', 'Check-in time'] },
];

const fmt = (ms: number) => { const s = Math.round(ms / 1000); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
function device() {
  const ua = navigator.userAgent;
  if (/iPhone|iPad|iPod/.test(ua)) return 'iPhone or iPad';
  if (/Android/.test(ua)) return 'Android phone';
  return 'Laptop or desktop';
}

/** The floating bar shown inside the app while a task is running. */
export function UatBar() {
  const loc = useLocation();
  const nav = useNavigate();
  const [u, setU] = useState<Uat | null>(readUat());
  const [open, setOpen] = useState(false);
  const [a, setA] = useState(['', '']);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const logged = useRef(false);
  const bar = useRef<HTMLDivElement>(null);
  // Push the app down by the bar's real height, so the bar never covers a page title.
  useEffect(() => {
    const el = bar.current; if (!el) return;
    const set = () => document.documentElement.style.setProperty('--uat-h', el.offsetHeight + 'px');
    set(); const ro = new ResizeObserver(set); ro.observe(el); return () => ro.disconnect();
  });

  useEffect(() => { setU(readUat()); }, [loc.pathname]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, []);
  // Task 1 finishes by itself when the booking is confirmed.
  useEffect(() => {
    if (u && u.task === 1 && /^\/f\/book\/done\//.test(loc.pathname) && !logged.current) {
      logged.current = true;
      rpc('uat_log', { p_task: 1, p_event: 'done', p_answer: null }).catch(() => {});
      const nu = { ...u, done: [...u.done, 1], task: 2, at: 0 }; writeUat(nu); setU(nu);
      setTimeout(() => nav('/try'), 2200);
    }
  }, [loc.pathname, u]);

  if (!u || !u.task || u.task > 3 || !u.at || !loc.pathname.startsWith('/f')) return null;
  const t = TASKS[u.task - 1];

  async function finish(event: 'done' | 'skip', e?: FormEvent) {
    e?.preventDefault();
    if (!u) return;
    setBusy(true);
    const answer = event === 'done' && t.ask ? t.ask.map((q, i) => `${q}: ${a[i].trim()}`).join(' | ') : null;
    await rpc('uat_log', { p_task: u.task, p_event: event, p_answer: answer }).catch(() => {});
    const nu = { ...u, done: event === 'done' ? [...u.done, u.task] : u.done, task: u.task + 1, at: 0 };
    writeUat(nu); setU(nu); setOpen(false); setA(['', '']); setBusy(false);
    nav('/try');
  }

  return (
    <div className="uat-bar" role="region" aria-label="Test task" ref={bar}>
      {!open ? (
        <div className="uat-in">
          <div className="uat-t"><span className="uat-k">Task {u.task} of 3 · {fmt(now - u.at)}</span><b>{t.short}</b></div>
          <div className="uat-b">
            <button className="btn sm ghost-on" onClick={() => finish('skip')} disabled={busy}>I’m stuck</button>
            {t.ask && <button className="btn sm" onClick={() => setOpen(true)}>I found it</button>}
          </div>
        </div>
      ) : (
        <form className="uat-in col" onSubmit={e => finish('done', e)}>
          <b>{t.short}</b>
          {t.ask!.map((q, i) => (
            <label key={q} className="field"><span className="label" style={{ color: '#fff' }}>{q}</span>
              <input className="input" value={a[i]} onChange={e => { const n = [...a]; n[i] = e.target.value; setA(n); }} autoFocus={i === 0} required /></label>
          ))}
          <div className="uat-b"><button type="button" className="btn sm ghost-on" onClick={() => setOpen(false)}>Back</button>
            <Btn className="sm" busy={busy} busyText="Saving">Submit answer</Btn></div>
        </form>
      )}
    </div>
  );
}

const PARENTS = ['In the same city as me', 'In another city in India', 'In another country', 'I live with them'];
const AGES = ['Under 25', '25 to 34', '35 to 44', '45 or older'];

/** /try: intro and profile, then each task card, then the feedback form. */
export default function Try() {
  const nav = useNavigate();
  const { session, profile, refresh, signOut } = useAuth();
  const [u, setU] = useState<Uat | null>(readUat());
  const [p, setP] = useState({ parents: '', age: '', care: '' });
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [fb, setFb] = useState({ ease: 0, useful: 0, would: '', pay: '', comment: '' });
  const [thanks, setThanks] = useState<string | null>(null);

  useEffect(() => { document.title = 'Test KinCare | KinCare'; }, []);
  // A staff or demo account must not take the test: their data is real demo data.
  const otherAccount = session && profile && !u && !session.user.is_anonymous;

  async function start(e: FormEvent) {
    e.preventDefault();
    if (!p.parents || !p.age || !p.care) return setErr('Answer the three questions above.');
    if (!consent) return setErr('Tick the box to agree before you start.');
    setBusy(true); setErr(null);
    try {
      if (!session) {
        const { error } = await supabase.auth.signInAnonymously({ options: { data: { full_name: 'Test family' } } });
        if (error) throw new Error(/disabled/i.test(error.message) ? 'Testing is not open yet. Try again later.' : cleanError(error.message));
      }
      const r = await rpc<{ code: string; pin: string }>('uat_start', { p_profile: { ...p, device: device() } });
      await refresh();
      const nu: Uat = { code: r.code, pin: r.pin, task: 1, at: 0, done: [] }; writeUat(nu); setU(nu);
      window.scrollTo(0, 0);
    } catch (x: any) { setErr(x.message); }
    setBusy(false);
  }

  async function begin() {
    if (!u) return;
    await rpc('uat_log', { p_task: u.task, p_event: 'start', p_answer: null }).catch(() => {});
    const nu = { ...u, at: Date.now() }; writeUat(nu); setU(nu);
    nav('/f');
  }

  async function send(e: FormEvent) {
    e.preventDefault();
    if (!fb.ease || !fb.useful || !fb.would || !fb.pay) return setErr('Answer the four questions to finish.');
    setBusy(true); setErr(null);
    try {
      await rpc('uat_finish', { p_ease: fb.ease, p_useful: fb.useful, p_would: fb.would, p_pay: fb.pay, p_comment: fb.comment });
      const code = u?.code || '';
      writeUat(null); setU(null); await signOut().catch(() => {});
      setThanks(code);
    } catch (x: any) { setErr(x.message); }
    setBusy(false);
  }

  const seg = (opts: string[], val: string, set: (v: string) => void, label: string) => (
    <div className="stack-sm" role="radiogroup" aria-label={label}>
      {opts.map(o => <button type="button" key={o} className="choice" role="radio" aria-checked={val === o} onClick={() => { set(o); setErr(null); }}>
        <span className="ch-t">{o}</span></button>)}
    </div>
  );
  const scale = (val: number, set: (v: number) => void, low: string, high: string, label: string) => (
    <div>
      <div className="seg" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map(n => <button type="button" key={n} role="radio" aria-checked={val === n} onClick={() => { set(n); setErr(null); }}>{n}</button>)}
      </div>
      <div className="row t-sm muted" style={{ justifyContent: 'space-between', marginTop: 6 }}><span>{low}</span><span>{high}</span></div>
    </div>
  );

  let body;
  if (thanks) {
    body = <div className="center"><DoneMark /><h1>Thank you</h1>
      <p className="lede">Your answers are saved as tester {thanks}, with no name or contact details. Your sample family has been deleted.</p>
      <Link className="btn block" style={{ marginTop: 24 }} to="/">See what KinCare does</Link></div>;
  } else if (otherAccount) {
    body = <><h1>Sign out first</h1>
      <p className="lede">You are signed in to a KinCare account. The test uses its own sample family, so sign out to start it.</p>
      <button className="btn block" style={{ marginTop: 24 }} onClick={() => signOut()}>Sign out and start the test</button></>;
  } else if (!u) {
    body = <>
      <h1>Help us test KinCare</h1>
      <p className="lede">KinCare helps families who live away from an elderly parent arrange home care and see proof of every visit. Try three short tasks in the app; it takes about 5 minutes. You get a sample family of your own, so nothing you do affects anyone else.</p>
      <form className="stack-lg" style={{ marginTop: 28 }} onSubmit={start}>
        <fieldset className="fieldset"><legend>Where do your parents live?</legend>{seg(PARENTS, p.parents, v => setP({ ...p, parents: v }), 'Where your parents live')}</fieldset>
        <fieldset className="fieldset"><legend>Your age</legend>{seg(AGES, p.age, v => setP({ ...p, age: v }), 'Your age')}</fieldset>
        <fieldset className="fieldset"><legend>Has your family ever arranged a caregiver or home nurse?</legend>{seg(['Yes', 'No'], p.care, v => setP({ ...p, care: v }), 'Arranged care before')}</fieldset>
        <button type="button" className="choice top" role="checkbox" aria-checked={consent} onClick={() => { setConsent(!consent); setErr(null); }}>
          <span className="box"><Icon name="check" /></span>
          <span className="ch-t"><span style={{ color: 'var(--ink)', fontSize: 15 }}>I agree that my answers, task times and ratings are saved anonymously for a GLIM student project. No name, phone or email is collected.</span></span>
        </button>
        <ErrorBox msg={err} />
        <Btn className="block" busy={busy} busyText="Setting up your sample family">Start the test</Btn>
      </form>
    </>;
  } else if (u.task <= 3) {
    const t = TASKS[u.task - 1];
    const prev = u.task > 1;
    body = <>
      {prev && <p className="pill ok" style={{ marginBottom: 16 }}><Icon name="check" size="sm" />Task {u.task - 1} saved</p>}
      <p className="t-sm muted" style={{ fontWeight: 600 }}>Task {u.task} of 3</p>
      <h1>{t.title}</h1>
      <p className="lede" style={{ fontSize: 17 }}>{t.text(u.pin)}</p>
      <div className="callout" style={{ marginTop: 20 }}><Icon name="clock" size="sm" /><span>The timer starts when you tap Start. Use the app as you normally would. {t.ask ? 'When you have the answer, tap “I found it” at the bottom of the screen.' : 'The task ends by itself when the booking is confirmed.'} If you get stuck, tap “I’m stuck”; that is useful to us too.</span></div>
      <button className="btn block" style={{ marginTop: 24 }} onClick={begin}>Start task {u.task}</button>
    </>;
  } else {
    body = <>
      <p className="t-sm muted" style={{ fontWeight: 600 }}>Last step</p>
      <h1>What did you think?</h1>
      <form className="stack-lg" style={{ marginTop: 24 }} onSubmit={send}>
        <fieldset className="fieldset"><legend>How easy was KinCare to use?</legend>{scale(fb.ease, v => setFb({ ...fb, ease: v }), 'Very hard', 'Very easy', 'Ease of use')}</fieldset>
        <fieldset className="fieldset"><legend>How useful would it be for a family like yours?</legend>{scale(fb.useful, v => setFb({ ...fb, useful: v }), 'Not useful', 'Very useful', 'Usefulness')}</fieldset>
        <fieldset className="fieldset"><legend>Would you use KinCare for your parents?</legend>{seg(['Yes', 'Maybe', 'No'], fb.would, v => setFb({ ...fb, would: v }), 'Would use')}</fieldset>
        <fieldset className="fieldset"><legend>KinCare costs ₹1,999 a month plus the caregiver’s day rate (₹850 to ₹1,200 for 12 hours). Would you pay that?</legend>
          {seg(['Yes, at that price', 'Yes, if it cost less', 'No'], fb.pay, v => setFb({ ...fb, pay: v }), 'Willing to pay')}</fieldset>
        <div className="field"><label className="label" htmlFor="fb-c">Anything confusing or missing? <span className="opt">(optional)</span></label>
          <textarea className="textarea" id="fb-c" rows={3} maxLength={600} value={fb.comment} onChange={e => setFb({ ...fb, comment: e.target.value })} /></div>
        <ErrorBox msg={err} />
        <Btn className="block" busy={busy} busyText="Saving">Finish and delete my sample family</Btn>
      </form>
    </>;
  }

  return (
    <div className="auth">
      <AuthSide />
      <main className="auth-main">
        <Link className="logo" to="/" aria-label="KinCare home"><BrandMark /><b>KinCare</b></Link>
        {body}
      </main>
    </div>
  );
}
