import { useParams } from 'react-router-dom';
import { q, supabase } from '../../lib/supabase';
import { useLive } from '../../lib/hooks';
import { time } from '../../lib/format';
import Icon from '../../components/Icon';
import { AppBar, ErrorBox, Loading } from '../../components/ui';

function Step({ state, title, body }: { state: 'done' | 'bad' | 'now' | ''; title: string; body: string }) {
  return (
    <li className={'step ' + state}>
      <span className="sdot">{state === 'done' ? <Icon name="check" size="sm" /> : state === 'bad' ? <Icon name="x" size="sm" /> : null}</span>
      <div><h4>{title}</h4><p>{body}</p></div>
    </li>
  );
}

export default function AlertDetail() {
  const { id } = useParams();
  const { data, loading, error } = useLive(async () => {
    const a = await q<any>(supabase.from('alerts').select('*, parent:parents(name, relation)').eq('id', id).single());
    const shift = a.shift_id ? await q<any>(supabase.from('shifts').select('*, caregiver:caregivers(name)').eq('id', a.shift_id).single()) : null;
    const rep = a.replacement_shift_id ? await q<any>(supabase.from('shifts').select('*, caregiver:caregivers(name)').eq('id', a.replacement_shift_id).single()) : null;
    const orig = shift?.replacement_of ? await q<any>(supabase.from('shifts').select('*, caregiver:caregivers(name)').eq('id', shift.replacement_of).single()) : null;
    const settings = await q<any>(supabase.from('settings').select('no_show_minutes, replacement_hours').single());
    return { a, shift, rep, orig, settings };
  }, [id], 10000);
  if (loading && !data) return <div className="shell"><Loading /></div>;
  if (!data) return <div className="shell"><main className="page"><AppBar title="Alert" back="/f" /><ErrorBox msg={error} /></main></div>;
  const { a, shift, rep, orig, settings } = data;
  const who = a.parent?.relation !== 'Parent' ? a.parent?.relation : a.parent?.name;

  if (a.type === 'sos') return (
    <div className="shell"><main className="page">
      <AppBar title={`SOS from ${who}`} back="/f" />
      <ol className="steps">
        <Step state="bad" title={`${who} pressed SOS`} body={`${time(a.raised_at)}, from their KinCare screen at home`} />
        <Step state="done" title="You and your coordinator were alerted" body="Shown here and on the coordinator's alert queue straight away" />
        <Step state={a.resolved_at ? 'done' : 'now'} title={a.resolved_at ? 'Your coordinator handled it' : 'Your coordinator is calling now'} body={a.resolved_at ? `${time(a.resolved_at)}. ${a.note ?? ''}` : 'KinCare Chennai'} />
      </ol>
    </main></div>
  );

  const escalated = a.level === 'escalated';
  return (
    <div className="shell"><main className="page stack">
      <AppBar title="Missed check-in" back="/f" />
      <ol className="steps">
        {escalated && orig && <Step state="bad" title={`${orig.caregiver?.name} did not check in`} body={`Due ${time(orig.start_at)}. A replacement was assigned.`} />}
        <Step state="bad" title={escalated ? `${shift?.caregiver?.name}, the replacement, did not arrive either` : `No check-in within ${settings.no_show_minutes} minutes`}
          body={`${shift?.caregiver?.name} was due at ${time(shift?.start_at)}. The shift was marked missed.`} />
        <Step state="done" title={escalated ? 'Escalated to the Care Operations head' : 'You and your coordinator were alerted'} body={`${time(a.raised_at)}`} />
        <Step state={a.resolved_at ? 'done' : 'now'} title={a.resolved_at ? (rep ? `${rep.caregiver?.name} assigned` : 'Resolved') : 'Assigning a verified replacement'}
          body={a.resolved_at ? `${time(a.resolved_at)}. ${a.note ?? ''}` : `Within ${settings.replacement_hours} hours of the alert`} />
        <Step state={rep && rep.status !== 'scheduled' ? 'done' : rep ? 'now' : ''} title={rep?.status === 'checked_in' || rep?.status === 'completed' ? `${rep.caregiver?.name} checked in` : 'Replacement arrives'}
          body={rep ? `Expected by ${time(rep.start_at)}` : `Within ${settings.replacement_hours} hours`} />
      </ol>
      <div className="surface"><p className="small" style={{ margin: 0 }}>You do not need to call anyone. KinCare arranges the replacement and keeps this page updated.</p></div>
    </main></div>
  );
}
