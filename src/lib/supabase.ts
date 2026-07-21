import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://avtdbnenosrqufmfcqrf.supabase.co';
const supabaseAnonKey = 'sb_publishable_Bh-TgvAAYAcEUMTEbvP1Kg_PSbrHrjG';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 20,
    },
  },
});
