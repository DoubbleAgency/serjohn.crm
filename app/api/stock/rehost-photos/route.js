import { createClient } from '@/lib/supabase/server';

/**
 * POST /api/stock/rehost-photos — copia fotos externas (mobile.de / Drive)
 * para o Supabase Storage e atualiza cars.fotos com URLs permanentes.
 * Usado ao converter uma proposta em carro de stock — os URLs externos
 * podem expirar; os do Storage são nossos.
 *
 * Body: { carId, urls: [...] }
 * Auth: sessão do CRM (RLS/policies do Storage exigem papel stock/admin).
 */
export const maxDuration = 60;

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export async function POST(request) {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return Response.json({ error: 'Sessão necessária' }, { status: 401 });

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const { carId, urls } = body || {};
  if (!carId || !Array.isArray(urls) || urls.length === 0) {
    return Response.json({ error: 'carId e urls são obrigatórios' }, { status: 400 });
  }

  const fotos = [];
  const pad = String(urls.length).length;
  for (let i = 0; i < Math.min(urls.length, 40); i++) {
    try {
      const res = await fetch(urls[i], { headers: { 'User-Agent': UA, Accept: 'image/jpeg,image/*;q=0.8' } });
      if (!res.ok) continue;
      const buf = Buffer.from(await res.arrayBuffer());
      const ct = (res.headers.get('content-type') || 'image/jpeg').split(';')[0];
      const ext = ct.includes('png') ? 'png' : ct.includes('webp') ? 'webp' : 'jpg';
      const path = `${carId}/${String(i + 1).padStart(pad, '0')}.${ext}`;
      const { error } = await supabase.storage.from('car-photos').upload(path, buf, {
        contentType: ct,
        cacheControl: '31536000',
        upsert: true,
      });
      if (error) continue;
      const { data } = supabase.storage.from('car-photos').getPublicUrl(path);
      fotos.push(data.publicUrl);
    } catch {
      // ignora e continua
    }
  }

  if (fotos.length > 0) {
    const { error } = await supabase.from('cars').update({ fotos }).eq('id', carId);
    if (error) return Response.json({ error: error.message }, { status: 500 });
  }

  return Response.json({ ok: true, uploaded: fotos.length, requested: urls.length });
}
