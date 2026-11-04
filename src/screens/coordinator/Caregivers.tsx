import { Link } from 'react-router-dom';
import { q, rpc, supabase } from '../../lib/supabase';
import { useLive } from '../../lib/hooks';
import { inr } from '../../lib/format';
import Icon from '../../components/Icon';
import { AppBar, Avatar, ErrorBox, Loading, useToast } from '../../components/ui';
import { StaffTabs } from './staff';

const CHECKS = [['id', 'id_checked', 'ID document checked'], ['police', 'police_checked', 'Police verification cleared'], ['training', 'training_done', 'Elder-care training completed']] as const;

export default function Caregivers() {
  const toast = useToast();
  const { data, loading, error, setData, reload } = useLive(() => q<any[]>(supabase.from('caregivers').select('*').order('verified').order('created_at', { ascending: false })), [], 30000);
  if (loading && !data) return <div className="shell"><Loading /></div>;

  async function flip(c: any, check: string, col: string) {
    const next = !c[col];
    const updated = { ...c, [col]: next };
    updated.verified = updated.id_checked && updated.police_checked && updated.training_done;
    setData(data!.map(x => (x.id === c.id ? updated : x)));
    try {
      await rpc('set_check', { p_caregiver: c.id, p_check: check, p_done: next });
      if (updated.verified && !c.verified) toast(`${c.name} is now visible to families`);
      if (!updated.verified && c.verified) toast(`${c.name} is hidden from families until all checks are done`);
    } catch (x: any) { toast(x.message, true); reload(); }
  }

  return (
    <div className="shell"><main className="page stack">
      <AppBar title="Caregivers" right={<Link className="iconbtn" to="/k/caregivers/new" aria-label="Add caregiver"><Icon name="plus" /></Link>} />
      <ErrorBox msg={error} />
      {data?.map(c => (
        <div className="surface" key={c.id}>
          <div className="row"><Avatar text={c.initials} tone={c.verified ? 'leaf' : undefined} />
            <div className="grow"><b>{c.name}</b><div className="tiny">{c.area} {c.pin_code}, {inr(c.rate_12)} per 12-hour day</div></div>
            {!c.verified && <span className="tag">Pending</span>}</div>
          <div className="divider" style={{ margin: '12px 0 4px' }} />
          {CHECKS.map(([key, col, label]) => (
            <div className="row between" style={{ padding: '7px 0' }} key={key}>
              <span className="small">{label}</span>
              <button className="toggle" role="switch" aria-checked={!!c[col]} aria-label={`${label}: ${c.name}`} onClick={() => flip(c, key, col)} />
            </div>
          ))}
          <p className="note" style={{ marginTop: 6, color: c.verified ? 'var(--leaf)' : undefined }}>
            <Icon name={c.verified ? 'check' : 'lock'} size="sm" /><span>{c.verified ? 'Visible to families in search.' : 'Hidden from families until all three checks are complete.'}</span></p>
        </div>
      ))}
    </main><StaffTabs /></div>
  );
}
