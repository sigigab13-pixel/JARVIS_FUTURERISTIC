import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL_FALLBACK = 'https://wyblfoxpaycguuxdehpn.supabase.co';
const SUPABASE_PUBLISHABLE_KEY_FALLBACK = 'sb_publishable_INHj3zpInACddS-bm0ueKQ_cnfJXIn5';

const supabaseUrl = String(import.meta.env.VITE_SUPABASE_URL || SUPABASE_URL_FALLBACK).trim();
const supabasePublishableKey = String(
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || SUPABASE_PUBLISHABLE_KEY_FALLBACK,
).trim();

export const supabaseConfigured = Boolean(supabaseUrl && supabasePublishableKey);

export const supabase = supabaseConfigured
  ? createClient(supabaseUrl, supabasePublishableKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;
