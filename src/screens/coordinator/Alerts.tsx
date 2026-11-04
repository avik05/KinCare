import { Link } from 'react-router-dom';
import { q, rpc, supabase } from '../../lib/supabase';
import { useAuth } from '../../lib/auth';
import { useLive, sweepNoShows } from '../../lib/hooks';
import { minutesLeft, time } from '../../lib/format';
import Icon from '../../components/Icon';
import { AppBar, ErrorBox, Loading, useToast } from '../../components/ui';
import { StaffTabs } from './staff';

export async function loadAlerts() {
  await sweepNoShows();
  const since = new Date(Date.now() - 24 * 3600e3).toISOString();
  const alerts = await q<any[]>(supabase.from('alerts')
    .select('*, parent:parents(name, pin_code, address, emergency_contact, family:profiles!parents_family_id_fkey(full_name, phone)), shift:shifts!alerts_shift_id_fkey(start_at, caregiver:caregivers(name))')
    .or(`resolved_at.is.null,resolved_at.gte.${since}`).order('raised_at'));
  return alerts;
}

export default function AlertQueue() {
  const toast = useToast();
  const { profile, signOut } = useAuth();
  const { data, loading, error, reload } = useLive(loadAlerts, [], 10000);
  if (loading && !data) return <div className="shell"><Loading /></div>;
  const open = (data ?? []).filter(a => !a.resolved_at);
  const done = (data ?? []).filter(a => a.resolved_at).reverse();

  async function handled(a: any) {
    try { await rpc('resolve_alert', { p_alert: a.id, p_note: 'Coordinator called and confirmed all is well.' }); toast('SOS marked handled. The family can see it'); reload(); }
    catch (x: any) { toast(x.message, true); }
  }

  return (
    <div className="shell"><main className="page stack">
      <AppBar title="Alerts" right={profile?.role === 'coordinator' && <button className="iconbtn" aria-label="Sign out" onClick={signOut}><Icon name="logout" /></button>} />
      <ErrorBox msg={error} />
      {open.length === 0 && <div className="surface empty">No open alerts. Missed check-ins and SOS calls appear here first.</div>}
      {open.map(a => a.type === 'sos' ? (
        <div className="qitem bad" key={a.id}>
          <span className="sev" />
          <div className="grow">
            <div className="row between"><b>SOS: {a.parent?.name}</b><span className="timer">{time(a.raised_at)}</span></div>
            <p className="small muted" style={{ margin: '2px 0 4px' }}>Pressed from their screen at home. {a.parent?.address}</p>
            <p className="small" style={{ margin: '0 0 10px' }}>Family: {a.parent?.family?.full_name}, {a.parent?.family?.phone ?? 'no number'}. Nearby: {a.parent?.emergency_contact ?? 'none listed'}</p>
            <button className="btn sm" onClick={() => handled(a)}><Icon name="check" size="sm" />Called, mark handled</button>
          </div>
        </div>
      ) : (
        <Link className="qitem bad" key={a.id} to={`/k/assign/${a.id}`}>
          <span className="sev" />
          <div className="grow">
            <div className="row between"><b>{a.level === 'escalated' ? 'Second miss' : 'No check-in'}: {a.parent?.name}</b><span className="timer">{a.due_by ? minutesLeft(a.due_by) : ''}</span></div>
            <p className="small muted" style={{ margin: '2px 0 0' }}>{a.shift?.caregiver?.name} due {time(a.shift?.start_at)}, no check-in. {a.parent?.pin_code}.{a.level === 'escalated' ? ' Escalated to the Care Operations head.' : ''}</p>
          </div>
          <Icon name="chev" />
        </Link>
      ))}
      {done.length > 0 && <h2 className="daylabel">Resolved in the last 24 hours</h2>}
      {done.map(a => (
        <div className="qitem" key={a.id}>
          <span className="sev done" />
          <div className="grow">
            <div className="row between"><b>{a.type === 'sos' ? 'SOS' : 'No check-in'}: {a.parent?.name}</b><span className="tiny">Resolved {time(a.resolved_at)}</span></div>
            <p className="small muted" style={{ margin: '2px 0 0' }}>{a.note}</p>
          </div>
        </div>
      ))}
    </main><StaffTabs alert={open.length > 0} /></div>
  );
}
