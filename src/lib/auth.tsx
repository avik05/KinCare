import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from './supabase';

export type Role = 'family' | 'elder' | 'caregiver' | 'coordinator' | 'admin';
export type Profile = { id: string; role: Role; full_name: string; phone: string | null; closed_at: string | null };

type Ctx = { session: Session | null; profile: Profile | null; ready: boolean; refresh: () => Promise<void>; signOut: () => Promise<void> };
const AuthCtx = createContext<Ctx>({ session: null, profile: null, ready: false, refresh: async () => {}, signOut: async () => {} });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [ready, setReady] = useState(false);

  async function loadProfile(s: Session | null) {
    if (!s) { setProfile(null); return; }
    const { data } = await supabase.from('profiles').select('id, role, full_name, phone, closed_at').eq('id', s.user.id).maybeSingle();
    setProfile((data as Profile) ?? null);
  }

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session); await loadProfile(data.session); setReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'USER_UPDATED') {
        // defer: Supabase must not be called inside this callback
        setTimeout(() => { loadProfile(s).finally(() => setReady(true)); }, 0);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const value: Ctx = {
    session, profile, ready,
    refresh: () => loadProfile(session),
    signOut: async () => { await supabase.auth.signOut(); setProfile(null); },
  };
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);

export const HOME: Record<Role, string> = { family: '/f', elder: '/e', caregiver: '/c', coordinator: '/k', admin: '/a' };
