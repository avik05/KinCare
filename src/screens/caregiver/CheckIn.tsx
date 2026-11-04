import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { rpc, supabase } from '../../lib/supabase';
import { useLive } from '../../lib/hooks';
import Icon from '../../components/Icon';
import { AppBar, ErrorBox, Loading, useToast } from '../../components/ui';
import { loadShifts } from './Today';

/** Shrinks a phone photo to at most 1280 px so it uploads quickly and fits the free storage tier. */
async function compress(file: File): Promise<Blob> {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale);
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise(res => canvas.toBlob(b => res(b!), 'image/jpeg', 0.75));
}

type Loc = { lat: number; lng: number; acc: number };

export default function CheckIn() {
  const { shiftId } = useParams();
  const nav = useNavigate();
  const toast = useToast();
  const { data, loading } = useLive(loadShifts, [], 0);
  const [loc, setLoc] = useState<Loc | null>(null);
  const [locErr, setLocErr] = useState<string | null>(null);
  const [photo, setPhoto] = useState<{ blob: Blob; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function locate() {
    setLocErr(null); setLoc(null);
    if (!navigator.geolocation) return setLocErr('This browser cannot share location. Use Chrome or Safari on your phone.');
    navigator.geolocation.getCurrentPosition(
      p => setLoc({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }),
      e => setLocErr(e.code === 1 ? 'Location is blocked. Allow location for this site in your browser settings, then try again.' : 'Could not find your location. Step outside or near a window and try again.'),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
  }
  useEffect(locate, []);

  if (loading) return <div className="shell"><Loading /></div>;
  const s = data?.find(x => x.shift_id === shiftId);
  if (!s) return <div className="shell"><main className="page"><AppBar title="Check in" back="/c" /><ErrorBox msg="This shift is not available to you right now." /></main></div>;

  async function onPhoto(f?: File) {
    if (!f) return;
    try { const blob = await compress(f); setPhoto({ blob, url: URL.createObjectURL(blob) }); }
    catch { setErr('Could not read that photo. Try taking it again.'); }
  }

  async function confirm() {
    if (!loc || !photo) return;
    setBusy(true); setErr(null);
    try {
      const path = `${s.parent_id}/${s.shift_id}/door-${Date.now()}.jpg`;
      const up = await supabase.storage.from('checkins').upload(path, photo.blob, { contentType: 'image/jpeg' });
      if (up.error) throw new Error('The photo did not upload. Check your connection and try again.');
      await rpc('check_in', { p_shift: s.shift_id, p_lat: loc.lat, p_lng: loc.lng, p_accuracy: loc.acc, p_photo: path });
      toast('Checked in. The family can see it now');
      nav(`/c/visit/${s.shift_id}`, { replace: true });
    } catch (x: any) { setErr(x.message); setBusy(false); }
  }

  return (
    <div className="shell"><main className="page stack">
      <AppBar title="Check in" back="/c" />
      <div className={'locbox' + (!loc && !locErr ? ' locating' : '')}>
        <span className="pulse" /><span className="pulse p2" />
        <span className="pin"><Icon name="pinfill" className="" /></span>
        <div className="locstate">
          {loc ? <><Icon name="check" size="sm" /><span><b>Location found</b>, accurate to {Math.round(loc.acc)} m</span></>
            : locErr ? <><Icon name="warn" size="sm" /><span>{locErr} <button className="linkbtn" onClick={locate}>Try again</button></span></>
            : <><span className="live" /><span>Finding your location{'…'}</span></>}
        </div>
      </div>
      <div className="camera">
        {photo && <img src={photo.url} alt="Your check-in photo" />}
        <span className="frame" />
        <label htmlFor="door-photo" style={photo ? { alignSelf: 'end', background: 'rgba(28,38,35,.7)', borderRadius: 12, padding: '8px 14px', margin: 12 } : undefined}>
          {!photo && <Icon name="cam" />}
          {photo ? 'Retake photo' : 'Take a photo at the front door'}
        </label>
        <input id="door-photo" className="sr" type="file" accept="image/*" capture="environment" onChange={e => onPhoto(e.target.files?.[0])} />
      </div>
      <ErrorBox msg={err} />
      <button className="btn" disabled={!loc || !photo || busy} onClick={confirm}>{busy ? 'Checking in…' : 'Confirm check-in'}</button>
      {(!loc || !photo) && <p className="tiny center" style={{ margin: 0 }}>Location and a photo are both needed to check in.</p>}
    </main></div>
  );
}
