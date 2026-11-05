import { useState } from 'react';
import { q, rpc, supabase } from '../../lib/supabase';
import { useLive } from '../../lib/hooks';
import { ago, dayLabel, istDateOf, time, todayIST } from '../../lib/format';
import Icon from '../../components/Icon';
import { Btn, Empty, ErrorBox, Pill, useToast } from '../../components/ui';
import { Screen, ScreenLoading, useAttention } from '../../components/layout';

type Filter = 'new' | 'called' | 'closed';
const TONE: Record<string, 'warn' | 'brand' | undefined> = { new: 'warn', called: 'brand', closed: undefined };
const LABEL: Record<string, string> = { new: 'To call', called: 'Called', closed: 'Closed' };
const telOf = (p: string) => p.replace(/[^\d+]/g, '');
const show = (p: string) => (p.startsWith('+') ? p : p.length === 10 ? `${p.slice(0, 5)} ${p.slice(5)}` : p);

/** Requests left on the landing page. A coordinator calls back, notes what happened and closes the request. */
export default function Calls() {
  const toast = useToast();
  const { refresh } = useAttention();
  const { data, loading, error, reload } = useLive(() => q<any[]>(supabase.from('callbacks').select('*, handler:profiles!callbacks_handled_by_fkey(full_name)').order('created_at', { ascending: false }).limit(200)), [], 15000);
  const [filter, setFilter] = useState<Filter>('new');
  const [open, setOpen] = useState<string | null>(null);
  const [outcome, setOutcome] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  if (loading && !data) return <ScreenLoading title="Call requests" blocks={[44, 300]} />;

  const all = data ?? [];
  const count = (f: Filter) => all.filter(c => c.status === f).length;
  const rows = all.filter(c => c.status === filter);

  async function update(c: any, status: Filter) {
    if (status !== 'new' && outcome.trim().length < 3 && open === c.id) return setErr('Write a line about the call, for example what they need.');
    setBusy(c.id + status); setErr(null);
    try {
      await rpc('set_callback', { p_id: c.id, p_status: status, p_outcome: open === c.id ? outcome : null });
      toast(status === 'called' ? `Marked ${c.name} as called` : status === 'closed' ? `Closed ${c.name}’s request` : `${c.name} moved back to To call`);
      setOpen(null); setOutcome(''); reload(); refresh();
    } catch (x: any) { setErr(x.message); } finally { setBusy(null); }
  }

  return (
    <Screen title="Call requests" sub="Families who asked for a call from the KinCare website. Call back the same day." wide>
      <div className="stack" style={{ maxWidth: 820 }}>
        <ErrorBox msg={error} />
        <div className="seg compact" role="radiogroup" aria-label="Show" style={{ alignSelf: 'flex-start' }}>
          {(['new', 'called', 'closed'] as Filter[]).map(f => <button key={f} role="radio" aria-checked={filter === f} onClick={() => { setFilter(f); setOpen(null); setErr(null); }}>{LABEL[f]} ({count(f)})</button>)}
        </div>
        {rows.length === 0 ? (
          <div className="panel"><Empty icon="phone" title={filter === 'new' ? 'No one is waiting for a call' : `No ${LABEL[filter].toLowerCase()} requests`}>
            {filter === 'new' ? 'When someone asks for a call on the KinCare website, it appears here straight away.' : 'Requests move here once you update them.'}
          </Empty></div>
        ) : (
          <div className="panel flush">
            {rows.map(c => (
              <div className="cg-card" key={c.id}>
                <div className="row row-top">
                  <span className="av brand"><Icon name="phone" size="sm" /></span>
                  <div className="grow">
                    <div className="row between wrap" style={{ gap: 8 }}>
                      <b className="strong">{c.name}</b>
                      <Pill tone={TONE[c.status]} dot>{LABEL[c.status]}</Pill>
                    </div>
                    <div className="t-sm muted">Parent in {c.city}. Asked {istDateOf(c.created_at) === todayIST() ? `${ago(c.created_at)}, at ${time(c.created_at)}` : `on ${dayLabel(istDateOf(c.created_at))}, ${time(c.created_at)}`}.</div>
                    {c.note && <p className="t-sm" style={{ marginTop: 8, padding: '10px 12px', background: 'var(--inset)', borderRadius: 10 }}>“{c.note}”</p>}
                    {c.outcome && <p className="t-sm muted" style={{ marginTop: 8 }}><b className="strong" style={{ color: 'var(--ink)' }}>{c.handler?.full_name ?? 'Coordinator'}, {time(c.handled_at)}:</b> {c.outcome}</p>}
                    <div className="btn-row" style={{ marginTop: 12 }}>
                      <a className="btn sm" href={`tel:${telOf(c.phone)}`}><Icon name="phone" size="sm" />Call {show(c.phone)}</a>
                      {c.status !== 'closed' && open !== c.id && <button className="btn secondary sm" onClick={() => { setOpen(c.id); setOutcome(''); setErr(null); }}>Record the call</button>}
                      {c.status !== 'new' && <button className="btn quiet sm" disabled={!!busy} onClick={() => update(c, 'new')}>Move back to To call</button>}
                    </div>
                    {open === c.id && (
                      <div className="stack" style={{ marginTop: 12 }}>
                        <div className="field"><label className="label" htmlFor={`o-${c.id}`}>What happened on the call</label>
                          <textarea className="textarea" id={`o-${c.id}`} style={{ minHeight: 76 }} placeholder="Mother, 81, in Adyar. Wants 12-hour care from Monday. Sent the sign-up link." value={outcome} onChange={e => { setOutcome(e.target.value); setErr(null); }} /></div>
                        <ErrorBox msg={err} />
                        <div className="btn-row">
                          {c.status === 'new' && <Btn className="sm" busy={busy === c.id + 'called'} busyText="Saving" onClick={() => update(c, 'called')}>Called, follow up later</Btn>}
                          <Btn className="sm secondary" busy={busy === c.id + 'closed'} busyText="Saving" onClick={() => update(c, 'closed')}>Close request</Btn>
                          <button className="btn quiet sm" onClick={() => setOpen(null)}>Cancel</button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="note"><Icon name="lock" size="sm" /><span>Only coordinators and the Care Operations head can see these numbers. They are used only to call back about care.</span></p>
      </div>
    </Screen>
  );
}
