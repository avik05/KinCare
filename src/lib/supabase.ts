import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

export const configured = Boolean(url && key);
export const supabase = createClient(url || 'https://example.supabase.co', key || 'missing', {
  auth: { persistSession: true, autoRefreshToken: true },
});

/** Calls a Postgres function and throws a readable error. */
export async function rpc<T = any>(fn: string, args: Record<string, any> = {}): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw new Error(cleanError(error.message));
  return data as T;
}

/** Runs a select and throws on error. */
export async function q<T = any>(promise: PromiseLike<{ data: any; error: any }>): Promise<T> {
  const { data, error } = await promise;
  if (error) throw new Error(cleanError(error.message));
  return data as T;
}

export function cleanError(msg: string) {
  if (!msg) return 'Something went wrong. Try again.';
  if (/Invalid login credentials/i.test(msg)) return 'That email and password do not match.';
  if (/Failed to fetch|NetworkError/i.test(msg)) return 'No connection. Check your internet and try again.';
  return msg.replace(/^.*?ERROR:\s*/, '');
}

export async function photoUrl(path: string | null): Promise<string | null> {
  if (!path || path === 'sample') return null;
  const { data } = await supabase.storage.from('checkins').createSignedUrl(path, 3600);
  return data?.signedUrl ?? null;
}
