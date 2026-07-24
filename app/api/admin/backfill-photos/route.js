import { extractDriveImages } from '@/lib/drive';
import { createAnonClient } from '@/lib/supabase/anon';

/**
 * POST /api/admin/backfill-photos — extrai as fotos das pastas Drive dos
 * carros que ainda não têm `fotos` e grava os URLs na base de dados.
 *
 * Idempotente: só toca em carros com fotos vazias e link_drive preenchido.
 * Chamar repetidamente até `remaining` ser 0 (processa `limit` por chamada).
 *
 * Auth: Authorization: Bearer <IMPORT_API_SECRET>
 * Query: ?limit=12
 */
export const maxDuration = 60;

export async function POST(request) {
  const secret = process.env.IMPORT_API_SECRET;
  const auth = request.headers.get('authorization') || '';
  if (!secret || auth !== `Bearer ${secret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const url = new URL(request.url);
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '12', 10) || 12, 30);

  const supabase = createAnonClient();
  const { data: rows, error } = await supabase
    .from('v_stock_publico')
    .select('id, link_drive, fotos')
    .not('link_drive', 'is', null);

  if (error) return Response.json({ error: error.message }, { status: 500 });

  const pending = (rows || []).filter(
    (r) => r.link_drive && (!Array.isArray(r.fotos) || r.fotos.length === 0)
  );
  const batch = pending.slice(0, limit);

  const results = [];
  // Processar em grupos de 6 em paralelo
  for (let i = 0; i < batch.length; i += 6) {
    const chunk = batch.slice(i, i + 6);
    const extracted = await Promise.all(
      chunk.map(async (r) => ({
        id: r.id,
        fotos: await extractDriveImages(r.link_drive),
      }))
    );
    results.push(...extracted);
  }

  const withFotos = results.filter((r) => r.fotos.length > 0);
  let updated = 0;
  if (withFotos.length > 0) {
    const { data: n, error: e2 } = await supabase.rpc('backfill_fotos', {
      p_secret: secret,
      p: withFotos,
    });
    if (e2) return Response.json({ error: e2.message }, { status: 500 });
    updated = n;
  }

  return Response.json({
    processed: batch.length,
    updated,
    failed: results.filter((r) => r.fotos.length === 0).map((r) => r.id),
    remaining: pending.length - batch.length,
  });
}
