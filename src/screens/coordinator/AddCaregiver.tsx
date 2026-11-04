import { FormEvent, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { rpc } from '../../lib/supabase';
import { AppBar, ErrorBox, useToast } from '../../components/ui';

export default function AddCaregiver() {
  const nav = useNavigate();
  const toast = useToast();
  const [f, setF] = useState({ name: '', phone: '', pin: '', area: '', years: '', languages: '', r12: '', r24: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: any) => setF({ ...f, [k]: e.target.value });

  async function save(e: FormEvent) {
    e.preventDefault();
    if (!/^[1-9][0-9]{5}$/.test(f.pin)) return setErr('Enter a 6-digit pin code.');
    setBusy(true); setErr(null);
    try {
      await rpc('add_caregiver', { p_name: f.name, p_phone: f.phone, p_pin: f.pin, p_area: f.area, p_years: Number(f.years || 0),
        p_languages: f.languages, p_rate12: Number(f.r12), p_rate24: Number(f.r24) });
      toast(`${f.name} added. Complete the three checks to list them`); nav('/k/caregivers');
    } catch (x: any) { setErr(x.message); setBusy(false); }
  }

  const fld = (k: keyof typeof f, label: string, props: any = {}) => (
    <div className="grow"><label className="label" htmlFor={'c-' + k}>{label}</label><input className="field" id={'c-' + k} value={f[k]} onChange={set(k)} {...props} /></div>
  );
  return (
    <div className="shell"><main className="page">
      <AppBar title="Add a caregiver" back="/k/caregivers" />
      <form className="stack" onSubmit={save}>
        {fld('name', 'Full name', { required: true, minLength: 2 })}
        {fld('phone', 'Phone', { inputMode: 'tel' })}
        <div className="row" style={{ alignItems: 'flex-start' }}>{fld('pin', 'Pin code', { required: true, inputMode: 'numeric', maxLength: 6 })}{fld('area', 'Area')}</div>
        <div className="row" style={{ alignItems: 'flex-start' }}>{fld('years', 'Years of experience', { inputMode: 'numeric' })}{fld('languages', 'Languages')}</div>
        <div className="row" style={{ alignItems: 'flex-start' }}>{fld('r12', '12-hour rate (₹)', { required: true, inputMode: 'numeric' })}{fld('r24', '24-hour rate (₹)', { required: true, inputMode: 'numeric' })}</div>
        <p className="note">New caregivers stay hidden from families until ID, police check and training are all marked complete.</p>
        <ErrorBox msg={err} />
        <button className="btn" disabled={busy}>{busy ? 'Adding…' : 'Add caregiver'}</button>
      </form>
    </main></div>
  );
}
