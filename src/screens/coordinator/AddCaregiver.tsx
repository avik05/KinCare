import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { rpc } from '../../lib/supabase';
import Icon from '../../components/Icon';
import { Btn, ErrorBox, useToast } from '../../components/ui';
import { Screen } from '../../components/layout';

export default function AddCaregiver() {
  const nav = useNavigate();
  const toast = useToast();
  const [f, setF] = useState({ name: '', phone: '', pin: '', area: '', years: '', languages: '', r12: '', r24: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [bad, setBad] = useState<string | null>(null);
  const num = (k: keyof typeof f, max: number) => (e: any) => { setF({ ...f, [k]: e.target.value.replace(/\D/g, '').slice(0, max) }); setBad(null); };
  const txt = (k: keyof typeof f) => (e: any) => { setF({ ...f, [k]: e.target.value }); setBad(null); };

  async function save(e: FormEvent) {
    e.preventDefault();
    const fail = (k: string, m: string) => { setBad(k); setErr(m); };
    if (f.name.trim().length < 2) return fail('name', 'Enter the caregiver’s full name.');
    if (!/^[1-9][0-9]{5}$/.test(f.pin)) return fail('pin', 'Enter a 6-digit pin code.');
    if (!Number(f.r12)) return fail('r12', 'Enter the 12-hour rate in rupees.');
    if (!Number(f.r24)) return fail('r24', 'Enter the 24-hour rate in rupees.');
    setBusy(true); setErr(null);
    try {
      await rpc('add_caregiver', { p_name: f.name.trim(), p_phone: f.phone.trim(), p_pin: f.pin, p_area: f.area.trim(), p_years: Number(f.years || 0),
        p_languages: f.languages.trim(), p_rate12: Number(f.r12), p_rate24: Number(f.r24) });
      toast(`${f.name.trim()} added. Complete the three checks to list them`); nav('/k/caregivers');
    } catch (x: any) { setErr(x.message); setBusy(false); }
  }

  return (
    <Screen title="Add a caregiver" sub="They stay hidden from families until their ID, police check and training are marked complete." back="/k/caregivers" backLabel="Caregivers"
      footer={<><ErrorBox msg={err} /><Btn className="block" type="submit" form="cg-form" busy={busy} busyText="Adding caregiver">Add caregiver</Btn></>}>
      <form id="cg-form" className="stack-lg" onSubmit={save} noValidate>
        <fieldset className="fieldset">
          <legend>Person</legend>
          <div className="field"><label className="label" htmlFor="c-name">Full name</label><input className="input" id="c-name" aria-invalid={bad === 'name'} value={f.name} onChange={txt('name')} /></div>
          <div className="form-row two">
            <div className="field"><label className="label" htmlFor="c-phone">Phone <span className="opt">(optional)</span></label><input className="input" id="c-phone" inputMode="tel" placeholder="+91 90000 00000" value={f.phone} onChange={txt('phone')} /></div>
            <div className="field"><label className="label" htmlFor="c-lang">Languages <span className="opt">(optional)</span></label><input className="input" id="c-lang" placeholder="Tamil, English" value={f.languages} onChange={txt('languages')} /></div>
          </div>
          <div className="field" style={{ maxWidth: 200 }}><label className="label" htmlFor="c-years">Years of experience</label><input className="input" id="c-years" inputMode="numeric" value={f.years} onChange={num('years', 2)} /></div>
        </fieldset>
        <fieldset className="fieldset">
          <legend>Where they work</legend>
          <div className="form-row two">
            <div className="field"><label className="label" htmlFor="c-area">Area <span className="opt">(optional)</span></label><input className="input" id="c-area" placeholder="Adyar" value={f.area} onChange={txt('area')} /></div>
            <div className="field"><label className="label" htmlFor="c-pin">Pin code</label><input className="input" id="c-pin" inputMode="numeric" aria-invalid={bad === 'pin'} value={f.pin} onChange={num('pin', 6)} /></div>
          </div>
          <p className="hint" style={{ marginTop: -8 }}>Families see caregivers whose pin code is close to their parent’s.</p>
        </fieldset>
        <fieldset className="fieldset">
          <legend>Daily rate</legend>
          <div className="form-row two">
            <div className="field"><label className="label" htmlFor="c-r12">12-hour shift, ₹</label><input className="input" id="c-r12" inputMode="numeric" placeholder="900" aria-invalid={bad === 'r12'} value={f.r12} onChange={num('r12', 5)} /></div>
            <div className="field"><label className="label" htmlFor="c-r24">24-hour shift, ₹</label><input className="input" id="c-r24" inputMode="numeric" placeholder="1500" aria-invalid={bad === 'r24'} value={f.r24} onChange={num('r24', 5)} /></div>
          </div>
        </fieldset>
        <p className="note"><Icon name="shield" size="sm" /><span>After adding, mark each check on the Caregivers page once you have seen the document or result.</span></p>
      </form>
    </Screen>
  );
}
