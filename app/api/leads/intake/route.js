import { createAnonClient } from '@/lib/supabase/anon';

/**
 * POST /api/leads/intake — chamado pelo site serjohn.pt quando alguém
 * submete o formulário "Peça o seu carro".
 *
 * Auth: header  x-api-key: <LEADS_INTAKE_SECRET>
 * Body: { nome, telefone, email, marca, modelo, ano, kmsMax, orcamento, extras }
 *       (formato do formulário do site — convertido aqui)
 *
 * Dedupe: mesmo email/telefone nas últimas 24h atualiza a lead existente.
 */
export async function POST(request) {
  const secret = process.env.LEADS_INTAKE_SECRET;
  if (!secret || request.headers.get('x-api-key') !== secret) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let data;
  try {
    data = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!data.nome || !data.email || !data.telefone) {
    return Response.json(
      { error: 'Nome, email e telefone são obrigatórios.' },
      { status: 400 }
    );
  }

  const carro = [data.marca, data.modelo, data.ano].filter(Boolean).join(' ');
  const notas = [
    data.extras || null,
    data.kmsMax ? `Kms máx: ${data.kmsMax}` : null,
    data.orcamento ? `Orçamento: ${data.orcamento}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const payload = {
    nome: data.nome,
    telefone: data.telefone,
    email: data.email,
    carro_interesse: carro || null,
    orcamento_max: parseOrcamento(data.orcamento),
    kms_max: parseKms(data.kmsMax),
    notas: notas || null,
  };

  const supabase = createAnonClient();
  const { data: result, error } = await supabase.rpc('intake_lead', {
    p_secret: secret,
    p: payload,
  });

  if (error) {
    console.error('[intake] error:', error);
    return Response.json({ error: 'Não foi possível registar o pedido.' }, { status: 500 });
  }

  return Response.json({ ok: true, id: result.id, deduped: result.deduped });
}

function parseOrcamento(label) {
  if (!label) return null;
  const nums = String(label).match(/\d[\d.]*/g);
  if (!nums || nums.length === 0) return null;
  const last = parseInt(nums[nums.length - 1].replace(/\./g, ''), 10);
  return Number.isFinite(last) ? last : null;
}

function parseKms(label) {
  if (!label) return null;
  const m = String(label).replace(/\./g, '').match(/\d+/);
  if (!m) return null;
  const n = parseInt(m[0], 10);
  return Number.isFinite(n) ? n : null;
}
