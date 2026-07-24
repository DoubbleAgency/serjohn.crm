import { createClient as createSupabaseClient } from '@supabase/supabase-js';

/**
 * Cliente Supabase "puro" (anon key, sem cookies/sessão) para rotas de API
 * server-side. A autorização real destas rotas é feita por segredo partilhado
 * (x-api-key / Bearer) e, na base de dados, pelas funções RPC que validam o
 * segredo contra a tabela privada app_secrets.
 */
export function createAnonClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } }
  );
}
