import { SUPABASE_URL, SUPABASE_ANON_KEY } from './config.js';
export const isDemo = !SUPABASE_URL || !SUPABASE_ANON_KEY;
export let sb = null;
if (!isDemo) {
  const { createClient } = await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm');
  sb = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
