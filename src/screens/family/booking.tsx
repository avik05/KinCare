import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { q, supabase } from '../../lib/supabase';
import { todayIST } from '../../lib/format';
import { TabBar } from '../../components/ui';
import { useLocation } from 'react-router-dom';

export type Draft = { parentId: string | null; hours: 12 | 24; start: string; days: number; caregiverId: string | null };
const empty = (): Draft => ({ parentId: null, hours: 12, start: todayIST(1), days: 14, caregiverId: null });

const Ctx = createContext<{ draft: Draft; set: (p: Partial<Draft>) => void; reset: () => void }>({ draft: empty(), set: () => {}, reset: () => {} });

export function BookingProvider({ children }: { children: ReactNode }) {
  const [draft, setDraft] = useState<Draft>(() => {
    try { const s = sessionStorage.getItem('kincare-draft'); if (s) return { ...empty(), ...JSON.parse(s) }; } catch { /* storage may be blocked */ }
    return empty();
  });
  useEffect(() => { try { sessionStorage.setItem('kincare-draft', JSON.stringify(draft)); } catch { /* ignore */ } }, [draft]);
  return <Ctx.Provider value={{ draft, set: p => setDraft(d => ({ ...d, ...p })), reset: () => setDraft(empty()) }}>{children}</Ctx.Provider>;
}
export const useDraft = () => useContext(Ctx);

export function FamilyTabs({ alert }: { alert?: boolean }) {
  const p = useLocation().pathname;
  return <TabBar label="Family" tabs={[
    { to: '/f', icon: 'home', label: 'Home', active: p === '/f' || p === '/f/', dot: alert },
    { to: '/f/timeline', icon: 'tl', label: 'Timeline', active: p.startsWith('/f/timeline') },
    { to: '/f/book', icon: 'cal', label: 'Book care', active: p.startsWith('/f/book') },
    { to: '/f/services', icon: 'grid', label: 'Services', active: p.startsWith('/f/services') },
  ]} />;
}

export type ParentRow = { id: string; name: string; relation: string; age: number; address: string; pin_code: string; care_tasks: string[]; care_needs: string[] };

/** Everything the family home needs, for all of this family's parents. */
export async function loadFamilyOverview() {
  const today = todayIST();
  const parents = await q<ParentRow[]>(supabase.from('parents').select('id, name, relation, age, address, pin_code, care_tasks, care_needs').order('created_at'));
  const ids = parents.map(p => p.id);
  if (!ids.length) return { parents, bookings: [], shifts: [], visits: [], alerts: [] };
  const [bookings, shifts, alerts] = await Promise.all([
    q<any[]>(supabase.from('bookings').select('id, parent_id, shift_hours, start_date, end_date, days, status, rating, caregiver:caregivers(id, name, initials)')
      .in('parent_id', ids).neq('status', 'cancelled').order('start_date', { ascending: false })),
    q<any[]>(supabase.from('shifts').select('id, booking_id, parent_id, status, start_at, end_at, shift_date, replacement_of, caregiver:caregivers(name, initials)')
      .in('parent_id', ids).gte('shift_date', todayIST(-20)).lte('shift_date', todayIST(20)).order('start_at')),
    q<any[]>(supabase.from('alerts').select('id, parent_id, shift_id, type, level, raised_at, resolved_at, note, replacement_shift_id')
      .in('parent_id', ids).or(`resolved_at.is.null,resolved_at.gte.${new Date(Date.now() - 12 * 3600e3).toISOString()}`).order('raised_at', { ascending: false })),
  ]);
  const todayShiftIds = shifts.filter(s => s.shift_date === today).map(s => s.id);
  const visits = todayShiftIds.length
    ? await q<any[]>(supabase.from('visits').select('id, shift_id, check_in_at, check_out_at, tasks').in('shift_id', todayShiftIds))
    : [];
  return { parents, bookings, shifts, visits, alerts };
}

export function currentBooking(bookings: any[], parentId: string) {
  const today = todayIST();
  return bookings.find(b => b.parent_id === parentId && b.status === 'active' && b.start_date <= today && b.end_date >= today)
    || bookings.find(b => b.parent_id === parentId && b.status === 'active' && b.start_date > today)
    || null;
}
