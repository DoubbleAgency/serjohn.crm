import { createAnonClient } from '@/lib/supabase/anon';

/**
 * Aplica os dados de um anúncio (mobile.de) a uma lead.
 * Se não vier leadId, cria uma lead nova em nome do utilizador com sessão.
 *
 * @param supabase cliente Supabase com a sessão do utilizador
 * @param opts { car, leadId?, nome?, telefone?, email?, userId }
 * @returns { leadId, criada, nome }
 */
export async function aplicarAnuncio(supabase, { car, leadId = null, nome, telefone, email, userId }) {
  let criada = false;

  if (!leadId) {
    const titulo =
      [car.marca, car.modelo].filter(Boolean).join(' ') || car.titulo || 'Anúncio mobile.de';
    const { data, error } = await supabase
      .from('leads')
      .insert({
        nome: String(nome || '').trim() || `Proposta — ${titulo}`.slice(0, 120),
        telefone: String(telefone || '').trim() || null,
        email: String(email || '').trim() || null,
        origem: 'mobile.de',
        estado: 'Nova',
        vendedor_id: userId || null,
      })
      .select('id')
      .single();
    if (error) throw new Error('Erro a criar a lead: ' + error.message);
    leadId = data.id;
    criada = true;
  }

  const anon = createAnonClient();
  const { data: updated, error: rpcErr } = await anon.rpc('ext_import_update', {
    p_secret: process.env.IMPORT_API_SECRET,
    p_lead: leadId,
    p: {
      marca: car.marca || null,
      modelo: car.modelo || null,
      ano: Number.isFinite(car.ano) ? car.ano : null,
      kms: Number.isFinite(car.kms) ? car.kms : null,
      combustivel: car.combustivel || null,
      valorVenda: Number.isFinite(car.valorVenda) ? car.valorVenda : null,
      extras: car.extras || null,
      mobileDeUrl: car.mobileDeUrl || null,
      linkDrive: null,
      fotos: Array.isArray(car.photos) ? car.photos.slice(0, 40) : [],
    },
  });
  if (rpcErr) throw new Error('Erro a gravar na lead: ' + rpcErr.message);

  return { leadId, criada, nome: updated?.nome || '' };
}

/** Normaliza o objeto recebido do browser (bookmarklet/extensão). */
export function limpaCar(raw) {
  const n = (v) => {
    const x = typeof v === 'string' ? parseInt(v.replace(/\D/g, ''), 10) : v;
    return Number.isFinite(x) ? x : null;
  };
  return {
    marca: typeof raw?.marca === 'string' ? raw.marca.trim().slice(0, 80) : null,
    modelo: typeof raw?.modelo === 'string' ? raw.modelo.trim().slice(0, 160) : null,
    ano: n(raw?.ano),
    kms: n(raw?.kms),
    combustivel: typeof raw?.combustivel === 'string' ? raw.combustivel.trim().slice(0, 40) : null,
    valorVenda: n(raw?.valorVenda),
    extras: typeof raw?.extras === 'string' ? raw.extras.slice(0, 4000) : null,
    mobileDeUrl: typeof raw?.mobileDeUrl === 'string' ? raw.mobileDeUrl.slice(0, 500) : null,
    titulo: typeof raw?.titulo === 'string' ? raw.titulo.slice(0, 200) : null,
    photos: Array.isArray(raw?.photos)
      ? raw.photos.filter((u) => typeof u === 'string' && /^https:\/\//.test(u)).slice(0, 40)
      : [],
  };
}
