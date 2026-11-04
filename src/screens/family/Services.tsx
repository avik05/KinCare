import Icon from '../../components/Icon';
import { AppBar } from '../../components/ui';
import { FamilyTabs } from './booking';

/** Out of scope for version 1 (BRD section 4): shown so families know what is coming. */
export default function Services() {
  const items = [['pill', 'Medicine delivery', 'From pharmacies near your parent'], ['cart', 'Grocery delivery', 'Weekly essentials to their door']];
  return (
    <div className="shell"><main className="page">
      <AppBar title="Services" />
      <p className="muted small" style={{ margin: '0 0 12px' }}>More ways to look after your parent, coming after launch.</p>
      <div className="stack">
        {items.map(([i, t, d]) => <div className="soon" key={t}><span className="qi"><Icon name={i} /></span><div><b>{t}</b><div className="tiny">{d}</div></div><span className="soontag">Coming soon</span></div>)}
      </div>
    </main><FamilyTabs /></div>
  );
}
