import { createClient } from '@/lib/supabase/server';
import { aplicarAnuncio, limpaCar } from '@/lib/aplicar-anuncio';

/**
 * POST /api/import-payload — recebe os dados de um anúncio já lidos no browser
 * do utilizador (bookmarklet "Enviar para o Serjohn" ou extensão) e cria/preenche
 * a lead. Autenticado pela sessão do CRM — não usa nenhum segredo partilhado.
 *
 * Body: { car: {...}, leadId? }
 * Returns: { ok, leadId, criada, propostaUrl }
 */
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function POST(request) {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return Response.json({ error: 'Sessão necessária.' }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const car = limpaCar(body?.car);
  if (!car.marca && !car.modelo && !car.valorVenda && car.photos.length === 0) {
    return Response.json(
      { error: 'Não recebi dados do anúncio. Confirme que estava numa página de anúncio.' },
      { status: 422 }
    );
  }

  try {
    const r = await aplicarAnuncio(supabase, {
      car,
      leadId: body?.leadId || null,
      nome: body?.nome,
      userId: session.user.id,
    });
    return Response.json({
      ok: true,
      ...r,
      car: {
        marca: car.marca,
        modelo: car.modelo,
        ano: car.ano,
        kms: car.kms,
        combustivel: car.combustivel,
        valorVenda: car.valorVenda,
        fotos: car.photos.length,
      },
      propostaUrl: `/api/propostas/${r.leadId}`,
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}
