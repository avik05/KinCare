import { useLocation } from 'react-router-dom';
import { useAuth } from '../../lib/auth';
import { TabBar } from '../../components/ui';

export function StaffTabs({ alert, escalation }: { alert?: boolean; escalation?: boolean }) {
  const p = useLocation().pathname;
  const { profile } = useAuth();
  const alerts = { to: '/k', icon: 'bell', label: 'Alerts', active: p === '/k' || p === '/k/' || p.startsWith('/k/assign'), dot: alert };
  const cgs = { to: '/k/caregivers', icon: 'users', label: 'Caregivers', active: p.startsWith('/k/caregivers') };
  if (profile?.role === 'admin') {
    return <TabBar label="Care Operations" tabs={[
      { to: '/a', icon: 'chart', label: 'KPIs', active: p === '/a' || p === '/a/' },
      { to: '/a/escalations', icon: 'escal', label: 'Escalations', active: p.startsWith('/a/escalations'), dot: escalation },
      alerts, cgs,
      { to: '/a/settings', icon: 'gear', label: 'Settings', active: p.startsWith('/a/settings') },
    ]} />;
  }
  return <TabBar label="Coordinator" tabs={[alerts, cgs]} />;
}
