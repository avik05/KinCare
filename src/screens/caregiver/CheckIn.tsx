import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { rpc, supabase } from '../../lib/supabase';
import { useLive } from '../../lib/hooks';
import Icon from '../../components/Icon';
import { Btn, Empty, ErrorBox, useToast } from '../../components/ui';
import { Screen, ScreenLoading } from '../../components/layout';
import { loadShifts } from './Today';

/** Shrinks a phone photo to at most 1280 px so it uploads quickly and fits the free storage tier. */
async function compress(file: File): Promise<Blob> {
  const img = await createImageBitmap(file);
  const scale = Math.min(1, 1280 / Math.max(img.width, img.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(img.width * scale); canvas.height = Math.round(img.height * scale);
  canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
  return new Promise((res, rej) => canvas.toBlob(b => (b ? res(b) : rej(new Error('encode'))), 'image/jpeg', 0.75));
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
    if (!navigator.geolocation) return setLocErr('This browser cannot share location. Open KinCare in Chrome or Safari on your phone.');
    navigator.geolocation.getCurrentPosition(
      p => setLoc({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }),
      e => setLocErr(e.code === 1 ? 'Location is blocked. Allow location for this site in your browser settings, then try again.' : 'Could not find your location. Step near a window or outside and try again.'),
      { enableHighAccuracy: true, timeout: 20000, maximumAge: 0 });
  }
  useEffect(locate, []);
  useEffect(() => () => { if (photo) URL.revokeObjectURL(photo.url); }, [photo]);

  if (loading) return <ScreenLoading title="Check in" back="/c" blocks={[200, 300]} />;
  const s = data?.find(x => x.shift_id === shiftId);
  if (!s || s.status !== 'scheduled') return (
    <Screen title="Check in" back="/c" backLabel="Today">
      <div className="panel"><Empty icon="cal" title={s?.status === 'checked_in' ? 'You are already checked in' : 'This shift is not open for check-in'}>
        {s?.status === 'checked_in' ? 'Go back and log tasks and readings.' : 'Check-in opens an hour before the shift starts. If this looks wrong, call your coordinator.'}
      </Empty></div>
    </Screen>
  );

  async function onPhoto(f?: File) {
    if (!f) return;
    setErr(null);
    try { const blob = await compress(f); setPhoto({ blob, url: URL.createObjectURL(blob) }); }
    catch { setErr('Could not read that photo. Take it again.'); }
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

  const missing = !loc && !photo ? 'Location and a door photo are both needed.' : !loc ? 'Waiting for your location.' : !photo ? 'Take the door photo to finish.' : '';
  return (
    <Screen title="Check in" sub={`${s.parent_name}’s home`} back="/c" backLabel="Today"
      footer={<>
        <ErrorBox msg={err} />
        <Btn className="lg block" busy={busy} busyText="Checking in" disabled={!loc || !photo} onClick={confirm}>Confirm check-in</Btn>
        {missing && <p className="t-xs faint center">{missing}</p>}
      </>}>
      <div className="stack-lg">
        <section className="panel pad">
          <div className={'cstep' + (loc ? ' done' : '')}>
            <span className="n">{loc ? <Icon name="check" size="sm" /> : 1}</span>
            <div className="grow">
              <h2>Your location</h2>
              <p className="t-sm muted" role="status">{loc ? `Found, accurate to ${Math.round(loc.acc)} m.` : locErr ? locErr : 'Finding where you are…'}</p>
              {locErr && <button className="btn secondary sm" style={{ marginTop: 10 }} onClick={locate}><Icon name="refresh" size="sm" />Try again</button>}
            </div>
          </div>
          <div className={'locmap ' + (loc ? 'found' : locErr ? 'failed' : 'finding')} aria-hidden="true">
            <span className="ring" /><span className="ring r2" /><span className="pin"><Icon name="pinfill" className="" /></span>
          </div>
        </section>
        <section className="panel pad">
          <div className={'cstep' + (photo ? ' done' : '')}>
            <span className="n">{photo ? <Icon name="check" size="sm" /> : 2}</span>
            <div className="grow"><h2>Photo at the front door</h2><p className="t-sm muted">Stand at the door so the family can see you arrived.</p></div>
          </div>
          <div className="camera">
            {photo && <img src={photo.url} alt="Your check-in photo" />}
            {!photo && <span className="frame" />}
            <label htmlFor="door-photo" className={photo ? 'retake' : ''}>
              {photo ? <><Icon name="cam" size="sm" />Retake</> : <><span className="cam-ic"><Icon name="cam" /></span>Take photo</>}
            </label>
            <input id="door-photo" className="sr" type="file" accept="image/*" capture="environment" onChange={e => { onPhoto(e.target.files?.[0]); e.target.value = ''; }} />
          </div>
        </section>
      </div>
    </Screen>
  );
}
