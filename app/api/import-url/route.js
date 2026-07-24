import { createClient } from '@/lib/supabase/server';
import { createAnonClient } from '@/lib/supabase/anon';
import { lerAnuncioMobileDe, isMobileDeUrl, extraiDoHtml } from '@/lib/mobilede';

/**
 * Importação de um anúncio mobile.de feita pela própria plataforma — sem extensão.
 *
 * POST { url, leadId? }  (sessão do CRM)
 *   - lê o anúncio no servidor
 *   - se não vier leadId, cria uma lead nova "Proposta — <título>"
 *   - preenche a lead (marca/modelo/ano/km/combustível/preço/descrição/fotos)
 *   - devolve { ok, leadId, propostaUrl, car }
 *
 * GET ?url=...&key=<IMPORT_API_SECRET>[&raw=1]  → só leitura, não escreve nada.
 *   Serve para diagnóstico (ver o que o mobile.de devolve ao servidor).
 */
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function GET(request) {
  const sp = new URL(request.url).searchParams;
  const key = sp.get('key');
  if (!process.env.IMPORT_API_SECRET || key !== process.env.IMPORT_API_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  const url = sp.get('url');
  if (!url) return Response.json({ error: 'url em falta' }, { status: 400 });

  try {
    if (sp.get('raw')) {
      const res = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
          'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
        },
      });
      const html = await res.text();
      const dados = res.ok ? extraiDoHtml(html, url) : null;
      return Response.json({
        status: res.status,
        length: html.length,
        titulo: (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || null,
        temLdJson: /application\/ld\+json/i.test(html),
        temNextData: /__NEXT_DATA__/.test(html),
        amostra: html.slice(0, 1200),
        dados,
      });
    }
    const car = await lerAnuncioMobileDe(url);
    return Response.json({ ok: true, car });
  } catch (err) {
    return Response.json(
      { error: err.message, bloqueado: !!err.bloqueado },
      { status: err.bloqueado ? 502 : 500 }
    );
  }
}

export async function POST(request) {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) {
    return Response.json({ error: 'Sessão necessária.' }, { status: 401 });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const url = String(body?.url || '').trim();
  if (!url) return Response.json({ error: 'Cole o link do anúncio.' }, { status: 400 });
  if (!isMobileDeUrl(url)) {
    return Response.json(
      { error: 'Por agora só leio links do mobile.de. Verifique o endereço.' },
      { status: 400 }
    );
  }

  // 1. Ler o anúncio
  let car;
  try {
    car = await lerAnuncioMobileDe(url);
  } catch (err) {
    return Response.json(
      {
        error: err.bloqueado
          ? err.message + ' Use a extensão Chrome (lê a página a partir do seu browser).'
          : err.message,
        bloqueado: !!err.bloqueado,
      },
      { status: err.bloqueado ? 502 : 500 }
    );
  }

  if (!car.marca && !car.modelo && !car.valorVenda && car.photos.length === 0) {
    return Response.json(
      { error: 'Consegui abrir a página mas não reconheci nenhum anúncio. Confirme o link.' },
      { status: 422 }
    );
  }

  // 2. Lead: existente ou nova
  let leadId = body?.leadId || null;
  let criada = false;
  if (!leadId) {
    const titulo = [car.marca, car.modelo].filter(Boolean).join(' ') || car.titulo || 'Anúncio mobile.de';
    const { data, error } = await supabase
      .from('leads')
      .insert({
        nome: String(body?.nome || '').trim() || `Proposta — ${titulo}`.slice(0, 120),
        telefone: String(body?.telefone || '').trim() || null,
        email: String(body?.email || '').trim() || null,
        origem: 'mobile.de',
        estado: 'Nova',
        vendedor_id: session.user.id,
      })
      .select('id')
      .single();
    if (error) {
      return Response.json({ error: 'Erro a criar a lead: ' + error.message }, { status: 500 });
    }
    leadId = data.id;
    criada = true;
  }

  // 3. Preencher a lead com os dados do anúncio (mesma RPC usada pela extensão)
  const anon = createAnonClient();
  const { data: updated, error: rpcErr } = await anon.rpc('ext_import_update', {
    p_secret: process.env.IMPORT_API_SECRET,
    p_lead: leadId,
    p: {
      marca: car.marca,
      modelo: car.modelo,
      ano: car.ano,
      kms: car.kms,
      combustivel: car.combustivel,
      valorVenda: car.valorVenda,
      extras: car.extras,
      mobileDeUrl: car.mobileDeUrl,
      linkDrive: null,
      fotos: car.photos.slice(0, 40),
    },
  });
  if (rpcErr) {
    return Response.json({ error: 'Erro a gravar na lead: ' + rpcErr.message }, { status: 500 });
  }

  return Response.json({
    ok: true,
    leadId,
    criada,
    nome: updated?.nome || '',
    car: {
      marca: car.marca,
      modelo: car.modelo,
      ano: car.ano,
      kms: car.kms,
      combustivel: car.combustivel,
      valorVenda: car.valorVenda,
      fotos: car.photos.length,
    },
    propostaUrl: `/api/propostas/${leadId}`,
  });
}
