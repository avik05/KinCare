import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { rpc } from '../../lib/supabase';
import Icon from '../../components/Icon';
import { AppBar, ErrorBox, useToast } from '../../components/ui';

const NEEDS = ['Medicines', 'Mobility help', 'Meals', 'Bathing', 'Companionship'];

export default function AddParent() {
  const nav = useNavigate();
  const toast = useToast();
  const [f, setF] = useState({ name: '', relation: '', age: '', address: '', pin: '', emergency: '' });
  const [needs, setNeeds] = useState<string[]>([]);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: any) => setF({ ...f, [k]: e.target.value });

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!/^[1-9][0-9]{5}$/.test(f.pin.trim())) return setErr('Enter a 6-digit pin code.');
    setBusy(true); setErr(null);
    try {
      await rpc('add_parent', { p_name: f.name, p_relation: f.relation, p_age: Number(f.age), p_address: f.address, p_pin: f.pin.trim(),
        p_needs: needs, p_emergency: f.emergency, p_consent: consent });
      toast(`${f.name.split(' ')[0]}'s profile saved with your consent`);
      nav('/f');
    } catch (x: any) { setErr(x.message); } finally { setBusy(false); }
  }

  return (
    <div className="shell"><main className="page">
      <AppBar title="Add a parent" back="/f" />
      <form className="stack" onSubmit={save}>
        <div><label className="label" htmlFor="p-name">Name</label><input className="field" id="p-name" required minLength={2} value={f.name} onChange={set('name')} /></div>
        <div className="row" style={{ gap: 10, alignItems: 'flex-start' }}>
          <div className="grow"><label className="label" htmlFor="p-rel">You call them</label><input className="field" id="p-rel" placeholder="Amma, Appa, Maa" value={f.relation} onChange={set('relation')} /></div>
          <div style={{ width: 90 }}><label className="label" htmlFor="p-age">Age</label><input className="field" id="p-age" required inputMode="numeric" pattern="[0-9]*" value={f.age} onChange={set('age')} /></div>
        </div>
        <div><label className="label" htmlFor="p-addr">Home address</label><input className="field" id="p-addr" required value={f.address} onChange={set('address')} /></div>
        <div><label className="label" htmlFor="p-pin">Pin code</label><input className="field" id="p-pin" required inputMode="numeric" maxLength={6} value={f.pin} onChange={set('pin')} /></div>
        <div><span className="label">Care needs</span><div className="pillset">
          {NEEDS.map(n => <button type="button" key={n} className="pill" aria-pressed={needs.includes(n)} onClick={() => setNeeds(needs.includes(n) ? needs.filter(x => x !== n) : [...needs, n])}>{n}</button>)}
        </div></div>
        <div><label className="label" htmlFor="p-ec">Emergency contact nearby</label><input className="field" id="p-ec" placeholder="Name, relation, phone" value={f.emergency} onChange={set('emergency')} /></div>
        <button type="button" className={'checkrow' + (consent ? ' on' : '')} role="checkbox" aria-checked={consent} onClick={() => setConsent(!consent)}>
          <span className="box"><Icon name="check" /></span>
          <span className="small">I consent, on my parent's behalf, to KinCare storing these details and the health readings recorded during visits, for arranging and checking their care.</span>
        </button>
        <p className="note"><Icon name="lock" size="sm" /><span>Only you, your coordinator and the caregiver on shift can see health readings.</span></p>
        <ErrorBox msg={err} />
        <button className="btn" disabled={!consent || busy}>{busy ? 'Saving…' : 'Save profile'}</button>
        {!consent && <p className="tiny center" style={{ margin: 0 }}>Tick the consent box to save.</p>}
      </form>
    </main></div>
  );
}
