import { createAnonClient } from '@/lib/supabase/anon';

/**
 * GET /api/stock — feed público JSON dos carros (Disponível/Reservado/Vendido).
 * Alternativa para quem não quiser ler o Supabase diretamente.
 */
export const revalidate = 60;

export async function GET() {
  const supabase = createAnonClient();
  const { data, error } = await supabase
    .from('v_stock_publico')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
  return Response.json(
    { cars: data },
    { headers: { 'Access-Control-Allow-Origin': '*' } }
  );
}
