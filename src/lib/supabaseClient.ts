import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!url || !anon) {
  // 开发时若未配置，在控制台可见，避免 import 时直接 throw 影响 HMR
  console.warn('Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in frontend/.env')
}

export const supabase = createClient(url ?? '', anon ?? '')
