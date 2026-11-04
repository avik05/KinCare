import { Link } from 'react-router-dom';
import { useLive } from '../../lib/hooks';
import { time } from '../../lib/format';
import Icon from '../../components/Icon';
import { Empty, ErrorBox, Pill } from '../../components/ui';
import { Screen, ScreenLoading } from '../../components/layout';
import { loadAlerts } from '../coordinator/Alerts';

/** BR5: a replacement that also misses check-in comes straight to the Care Operations head. */
export default function Escalations() {
  const { data, loading, error } = useLive(async () => (await loadAlerts()).filter(a => a.level === 'escalated'), [], 10000);
  if (loading && !data) return <ScreenLoading title="Escalations" blocks={[260]} />;
  const open = (data ?? []).filter(a => !a.resolved_at);
  const done = (data ?? []).filter(a => a.resolved_at);
  return (
    <Screen title="Escalations" sub="Cases where a replacement caregiver also missed check-in." wide>
      <div className="stack-lg" style={{ maxWidth: 760 }}>
        <ErrorBox msg={error} />
        {open.length === 0 && <div className="panel"><Empty icon="check" title="Nothing escalated">A case lands here when a replacement caregiver also misses check-in. You will see it in the sidebar count too.</Empty></div>}
        {open.map(a => (
          <article className="panel pad" key={a.id}>
            <div className="detail-head"><div><h2>{a.parent?.name}, {a.parent?.pin_code}</h2><p className="t-sm muted" style={{ marginTop: 2 }}>Escalated at {time(a.raised_at)}</p></div><Pill tone="bad" dot>Second miss</Pill></div>
            <ol className="steps" style={{ marginTop: 18 }}>
              <li className="step bad"><span className="sdot"><Icon name="x" size="sm" /></span><div><h3>The first caregiver missed check-in</h3><p>The coordinator assigned a replacement.</p></div></li>
              <li className="step bad"><span className="sdot"><Icon name="x" size="sm" /></span><div><h3>{a.shift?.caregiver?.name} missed {time(a.shift?.start_at)}</h3><p>No check-in, so the case came to you.</p></div></li>
              <li className="step now"><span className="sdot" /><div><h3>Your decision</h3><p>Send a senior caregiver and call the family: {a.parent?.family?.full_name}{a.parent?.family?.phone ? `, ${a.parent.family.phone}` : ''}.</p></div></li>
            </ol>
            <div className="btn-row" style={{ marginTop: 18 }}>
              <Link className="btn" to={`/k/assign/${a.id}`}>Choose a caregiver</Link>
              {a.parent?.family?.phone && <a className="btn secondary" href={`tel:${a.parent.family.phone.replace(/[^\d+]/g, '')}`}><Icon name="phone" size="sm" />Call the family</a>}
            </div>
          </article>
        ))}
        {done.length > 0 && (
          <section className="section" aria-labelledby="res-h">
            <div className="sec-head"><h2 id="res-h">Resolved in the last 24 hours</h2></div>
            <div className="panel flush">
              {done.map(a => <div className="li" key={a.id}><span className="av sm" style={{ background: 'var(--ok-tint)', color: 'var(--ok)' }}><Icon name="check" size="sm" /></span><span className="li-t"><b>{a.parent?.name}</b><span>{a.note}</span></span><span className="li-end">{time(a.resolved_at)}</span></div>)}
            </div>
          </section>
        )}
      </div>
    </Screen>
  );
}
