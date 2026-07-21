import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://mslhnlrpdhrffezjdwyf.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zbGhubHJwZGhyZmZlempkd3lmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2NDA1MjEsImV4cCI6MjEwMDIxNjUyMX0._Nx1aw_Wk1bZy0i_35lkIc6dTUbXLerqQ599wSNAqZY';

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
