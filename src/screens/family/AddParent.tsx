import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { rpc } from '../../lib/supabase';
import Icon from '../../components/Icon';
import { Btn, ErrorBox, useToast } from '../../components/ui';
import { Screen } from '../../components/layout';

const NEEDS = ['Medicines', 'Mobility help', 'Meals', 'Bathing', 'Companionship'];

export default function AddParent() {
  const nav = useNavigate();
  const toast = useToast();
  const [f, setF] = useState({ name: '', relation: '', age: '', address: '', pin: '', emergency: '' });
  const [needs, setNeeds] = useState<string[]>([]);
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [bad, setBad] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: any) => { setF({ ...f, [k]: e.target.value }); if (bad === k) setBad(null); };

  async function save(e: FormEvent) {
    e.preventDefault();
    const age = Number(f.age);
    if (f.name.trim().length < 2) { setBad('name'); return setErr('Enter your parent’s name.'); }
    if (!age || age < 40 || age > 120) { setBad('age'); return setErr('Enter an age between 40 and 120.'); }
    if (f.address.trim().length < 8) { setBad('address'); return setErr('Enter the full home address, with street and area.'); }
    if (!/^[1-9][0-9]{5}$/.test(f.pin.trim())) { setBad('pin'); return setErr('Enter a 6-digit pin code.'); }
    if (!consent) return setErr('Tick the consent box to save the profile.');
    setBusy(true); setErr(null);
    try {
      await rpc('add_parent', { p_name: f.name.trim(), p_relation: f.relation.trim(), p_age: age, p_address: f.address.trim(), p_pin: f.pin.trim(),
        p_needs: needs, p_emergency: f.emergency.trim(), p_consent: consent });
      toast(`${f.name.trim().split(' ')[0]}’s profile is saved`);
      nav('/f');
    } catch (x: any) { setErr(x.message); setBusy(false); }
  }

  return (
    <Screen title="Add a parent" sub="We use this to match caregivers near them and to brief each caregiver." back="/f" backLabel="Home"
      footer={<>
        <ErrorBox msg={err} />
        <Btn className="block" type="submit" form="parent-form" busy={busy} busyText="Saving profile" disabled={!consent}>Save profile</Btn>
      </>}>
      <form id="parent-form" className="stack-lg" onSubmit={save} noValidate>
        <fieldset className="fieldset">
          <legend>About them</legend>
          <div className="field"><label className="label" htmlFor="p-name">Full name</label>
            <input className="input" id="p-name" autoComplete="off" aria-invalid={bad === 'name'} value={f.name} onChange={set('name')} /></div>
          <div className="form-row wn">
            <div className="field"><label className="label" htmlFor="p-rel">What you call them <span className="opt">(optional)</span></label>
              <input className="input" id="p-rel" placeholder="Amma, Appa, Maa" value={f.relation} onChange={set('relation')} /></div>
            <div className="field"><label className="label" htmlFor="p-age">Age</label>
              <input className="input" id="p-age" inputMode="numeric" maxLength={3} aria-invalid={bad === 'age'} value={f.age} onChange={e => set('age')({ target: { value: e.target.value.replace(/\D/g, '') } })} /></div>
          </div>
        </fieldset>

        <fieldset className="fieldset">
          <legend>Home</legend>
          <div className="field"><label className="label" htmlFor="p-addr">Address</label>
            <input className="input" id="p-addr" placeholder="House number, street, area, city" autoComplete="street-address" aria-invalid={bad === 'address'} value={f.address} onChange={set('address')} />
            <span className="hint">Caregivers see this only while their shift is on.</span></div>
          <div className="field" style={{ maxWidth: 200 }}><label className="label" htmlFor="p-pin">Pin code</label>
            <input className="input" id="p-pin" inputMode="numeric" maxLength={6} autoComplete="postal-code" aria-invalid={bad === 'pin'} value={f.pin} onChange={e => set('pin')({ target: { value: e.target.value.replace(/\D/g, '') } })} /></div>
        </fieldset>

        <fieldset className="fieldset">
          <legend>Care needs</legend>
          <div className="chips" role="group" aria-label="Care needs">
            {NEEDS.map(n => <button type="button" key={n} className="chip" aria-pressed={needs.includes(n)} onClick={() => setNeeds(needs.includes(n) ? needs.filter(x => x !== n) : [...needs, n])}><Icon name="check" size="sm" />{n}</button>)}
          </div>
          <div className="field"><label className="label" htmlFor="p-ec">Emergency contact nearby <span className="opt">(optional)</span></label>
            <input className="input" id="p-ec" placeholder="Name, relation, phone" value={f.emergency} onChange={set('emergency')} />
            <span className="hint">Your coordinator calls this person first if your parent presses SOS.</span></div>
        </fieldset>

        <fieldset className="fieldset">
          <legend>Consent</legend>
          <button type="button" className="choice top" role="checkbox" aria-checked={consent} onClick={() => { setConsent(!consent); setErr(null); }}>
            <span className="box"><Icon name="check" className="" /></span>
            <span className="ch-t"><span style={{ color: 'var(--ink)', fontSize: 15 }}>I consent, on my parent’s behalf, to KinCare storing these details and the health readings recorded during visits, to arrange and check their care.</span></span>
          </button>
          <p className="note"><Icon name="lock" size="sm" /><span>Only you, your coordinator and the caregiver on shift can see health readings. Closing your account deletes all of it.</span></p>
        </fieldset>
      </form>
    </Screen>
  );
}
