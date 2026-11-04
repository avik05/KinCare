import { q, supabase } from '../../lib/supabase';
import { useLive } from '../../lib/hooks';
import { parentLabel, time } from '../../lib/format';
import Icon from '../../components/Icon';
import { ErrorBox, Pill } from '../../components/ui';
import { Screen, ScreenLoading } from '../../components/layout';
import { useParams } from 'react-router-dom';

type State = 'done' | 'bad' | 'now' | 'todo';
function Step({ state, title, body }: { state: State; title: string; body: string }) {
  return (
    <li className={'step ' + state}>
      <span className="sdot">{state === 'done' ? <Icon name="check" size="sm" /> : state === 'bad' ? <Icon name="x" size="sm" /> : null}</span>
      <div><h3>{title}</h3><p>{body}</p></div>
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
  if (loading && !data) return <ScreenLoading title="Alert" back="/f" blocks={[60, 280]} />;
  if (!data) return <Screen title="Alert" back="/f" backLabel="Home"><ErrorBox msg={error || 'This alert could not be found.'} /></Screen>;
  const { a, shift, rep, orig, settings } = data;
  const who = parentLabel(a.parent);
  const status = a.resolved_at ? <Pill tone="ok" dot>Resolved {time(a.resolved_at)}</Pill> : <Pill tone="bad" dot>Open, updates live</Pill>;

  if (a.type === 'sos') return (
    <Screen title={`SOS from ${who}`} sub={`Pressed at ${time(a.raised_at)}`} back="/f" backLabel="Home">
      <div className="stack-lg">
        <div>{status}</div>
        <div className="panel pad">
          <ol className="steps">
            <Step state="bad" title={`${who} pressed SOS`} body={`${time(a.raised_at)}, from their KinCare screen at home.`} />
            <Step state="done" title="You and your coordinator were alerted" body="Straight away, here and on the coordinator’s alert desk." />
            <Step state={a.resolved_at ? 'done' : 'now'} title={a.resolved_at ? 'Your coordinator handled it' : 'Your coordinator is calling now'} body={a.resolved_at ? `${time(a.resolved_at)}. ${a.note ?? ''}` : 'KinCare Chennai calls your parent and the nearby contact on their profile.'} />
          </ol>
        </div>
      </div>
    </Screen>
  );

  const escalated = a.level === 'escalated';
  const repState: State = !rep ? 'todo' : rep.status === 'scheduled' ? 'now' : rep.status === 'missed' ? 'bad' : 'done';
  return (
    <Screen title={escalated ? 'Replacement missed too' : 'Missed check-in'} sub={`${who}, ${time(shift?.start_at)} shift`} back="/f" backLabel="Home">
      <div className="stack-lg">
        <div>{status}</div>
        <div className="panel pad">
          <ol className="steps">
            {escalated && orig && <Step state="bad" title={`${orig.caregiver?.name} did not check in`} body={`Due at ${time(orig.start_at)}. A replacement was assigned.`} />}
            <Step state="bad" title={escalated ? `${shift?.caregiver?.name}, the replacement, did not arrive` : `No check-in within ${settings.no_show_minutes} minutes`}
              body={`${shift?.caregiver?.name} was due at ${time(shift?.start_at)}. The shift was marked missed.`} />
            <Step state="done" title={escalated ? 'Escalated to the Care Operations head' : 'You and your coordinator were alerted'} body={`At ${time(a.raised_at)}.`} />
            <Step state={a.resolved_at ? 'done' : 'now'} title={a.resolved_at ? (rep ? `${rep.caregiver?.name} assigned` : 'Resolved') : 'Assigning a verified replacement'}
              body={a.resolved_at ? `At ${time(a.resolved_at)}. ${a.note ?? ''}` : `Within ${settings.replacement_hours} hours of the alert.`} />
            <Step state={repState} title={rep && ['checked_in', 'completed'].includes(rep.status) ? `${rep.caregiver?.name} checked in` : 'Replacement arrives'}
              body={rep ? `Expected by ${time(rep.start_at)}.` : `Within ${settings.replacement_hours} hours.`} />
          </ol>
        </div>
        <p className="note"><Icon name="info" size="sm" /><span>You do not need to call anyone. KinCare arranges the replacement and this page updates on its own.</span></p>
      </div>
    </Screen>
  );
}
