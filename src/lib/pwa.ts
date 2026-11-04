import { useEffect, useState } from 'react';

// Chrome and Edge offer an install prompt; we keep it so a button can show it later.
let deferred: any = null;
const subs = new Set<() => void>();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: any) => { e.preventDefault(); deferred = e; subs.forEach(f => f()); });
  window.addEventListener('appinstalled', () => { deferred = null; subs.forEach(f => f()); });
}

export function useInstall() {
  const [, force] = useState(0);
  useEffect(() => { const f = () => force(n => n + 1); subs.add(f); return () => { subs.delete(f); }; }, []);
  const standalone = typeof window !== 'undefined' && (window.matchMedia?.('(display-mode: standalone)').matches || (navigator as any).standalone === true);
  const ios = typeof navigator !== 'undefined' && /iphone|ipad|ipod/i.test(navigator.userAgent);
  return {
    installed: standalone,
    canPrompt: !!deferred,
    ios,
    prompt: async () => { if (!deferred) return false; deferred.prompt(); const r = await deferred.userChoice; deferred = null; force(n => n + 1); return r?.outcome === 'accepted'; },
  };
}
