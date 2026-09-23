import { createClient } from '@supabase/supabase-js';

const env = (import.meta as any).env || {};
const supabaseUrl = String(env.VITE_SUPABASE_URL || '').trim();
const supabasePublishableKey = String(env.VITE_SUPABASE_PUBLISHABLE_KEY || '').trim();

if (!supabaseUrl || !supabasePublishableKey) {
  console.warn('JARVIS Supabase Auth is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.');
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
