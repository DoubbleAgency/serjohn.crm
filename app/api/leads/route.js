import { createAnonClient } from '@/lib/supabase/anon';

/**
 * GET /api/leads?search= — picker de leads da extensão Chrome.
 * Mesmo contrato do endpoint antigo do site: devolve { leads: [...] }
 * com { id, marca, modelo, extras, estado, createdAt } — aqui `modelo` é o
 * nome do cliente e `extras` junta carro/contactos, que é o que a equipa
 * pesquisa.
 *
 * Auth: Authorization: Bearer <IMPORT_API_SECRET>  (ou ?key=)
 */
export async function GET(request) {
  const secret = process.env.IMPORT_API_SECRET;
  const url = new URL(request.url);
  const auth = request.headers.get('authorization') || '';
  const ok =
    secret && (auth === `Bearer ${secret}` || url.searchParams.get('key') === secret);
  if (!ok) {
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
  }

  const supabase = createAnonClient();
  const { data, error } = await supabase.rpc('ext_search_leads', {
    p_secret: secret,
    p_query: url.searchParams.get('search') || '',
  });

  if (error) {
    console.error('[/api/leads] error:', error);
    return Response.json({ error: error.message }, { status: 500, headers: corsHeaders() });
  }

  return Response.json({ leads: data || [] }, { headers: corsHeaders() });
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}
