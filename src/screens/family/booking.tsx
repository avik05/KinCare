import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { q, supabase } from '../../lib/supabase';
import { todayIST } from '../../lib/format';

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

export type ParentRow = { id: string; name: string; relation: string; age: number; address: string; pin_code: string; care_tasks: string[]; care_needs: string[] };

/** Everything the family home needs, for all of this family's parents. */
export async function loadFamilyOverview() {
  const today = todayIST();
  const parents = await q<ParentRow[]>(supabase.from('parents').select('id, name, relation, age, address, pin_code, care_tasks, care_needs').order('created_at'));
  const ids = parents.map(p => p.id);
  if (!ids.length) return { parents, bookings: [] as any[], shifts: [] as any[], visits: [] as any[], alerts: [] as any[], readings: [] as any[], settings: { no_show_minutes: 30 } };
  const [bookings, shifts, alerts, settings] = await Promise.all([
    q<any[]>(supabase.from('bookings').select('id, parent_id, shift_hours, start_date, end_date, days, status, rating, caregiver:caregivers(id, name, initials)')
      .in('parent_id', ids).neq('status', 'cancelled').order('start_date', { ascending: false })),
    q<any[]>(supabase.from('shifts').select('id, booking_id, parent_id, status, start_at, end_at, shift_date, replacement_of, caregiver:caregivers(name, initials)')
      .in('parent_id', ids).gte('shift_date', todayIST(-20)).lte('shift_date', todayIST(20)).order('start_at')),
    q<any[]>(supabase.from('alerts').select('id, parent_id, shift_id, type, level, raised_at, resolved_at, note, replacement_shift_id')
      .in('parent_id', ids).or(`resolved_at.is.null,resolved_at.gte.${new Date(Date.now() - 12 * 3600e3).toISOString()}`).order('raised_at', { ascending: false })),
    q<any>(supabase.from('settings').select('no_show_minutes').single()),
  ]);
  const todayShiftIds = shifts.filter(s => s.shift_date === today).map(s => s.id);
  const visits = todayShiftIds.length
    ? await q<any[]>(supabase.from('visits').select('id, shift_id, check_in_at, check_out_at, tasks').in('shift_id', todayShiftIds))
    : [];
  const readings = visits.length
    ? await q<any[]>(supabase.from('readings').select('visit_id, bp_systolic, bp_diastolic, sugar, recorded_at').in('visit_id', visits.map(v => v.id)).order('recorded_at', { ascending: false }))
    : [];
  return { parents, bookings, shifts, visits, alerts, readings, settings };
}

export function currentBooking(bookings: any[], parentId: string) {
  const today = todayIST();
  return bookings.find(b => b.parent_id === parentId && b.status === 'active' && b.start_date <= today && b.end_date >= today)
    || bookings.find(b => b.parent_id === parentId && b.status === 'active' && b.start_date > today)
    || null;
}

/** Where the family is in the three booking steps. */
export function bookStep(n: 1 | 2 | 3) {
  return `Step ${n} of 3: ${['Care details', 'Choose a caregiver', 'Review and confirm'][n - 1]}`;
}
