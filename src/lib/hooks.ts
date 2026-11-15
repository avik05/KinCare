import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';

/** Loads data, refreshes it every `every` ms while the page is visible, and exposes reload(). */
export function useLive<T>(load: () => Promise<T>, deps: any[] = [], every = 15000) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const loadRef = useRef(load);
  loadRef.current = load;

  const reload = useCallback(async () => {
    try {
      const d = await loadRef.current();
      setData(d); setError(null);
    } catch (e: any) {
      setError(e.message || 'Could not load this screen.');
    } finally { setLoading(false); }
  }, []);

  useEffect(() => {
    setLoading(true); reload();
    if (!every) return;
    const id = setInterval(() => { if (document.visibilityState === 'visible') reload(); }, every);
    const onVis = () => document.visibilityState === 'visible' && reload();
    document.addEventListener('visibilitychange', onVis);
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', onVis); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, error, loading, reload, setData };
}

/** Runs the missed check-in sweep. The database also runs it every minute; this makes alerts appear immediately. */
export async function sweepNoShows(): Promise<number> {
  try { const { data } = await supabase.rpc('check_no_shows'); return (data as number) || 0; } catch { return 0; /* the cron job is the source of truth */ }
}

/** v1.2 (B04): load a screen and run the sweep at the same time; load again only if the sweep marked a shift missed. */
export async function withSweep<T>(load: () => Promise<T>): Promise<T> {
  const [found, data] = await Promise.all([sweepNoShows(), load()]);
  return found > 0 ? load() : data;
}
