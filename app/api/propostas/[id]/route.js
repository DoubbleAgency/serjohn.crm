import { createClient } from '@/lib/supabase/server';
import { buildPropostaPdf, fetchImage } from '@/lib/proposta-pdf';
import { extractDriveImages } from '@/lib/drive';

/**
 * GET /api/propostas/[id] — gera o PDF da proposta de importação de uma lead.
 * Substitui o antigo fluxo Make → Google Slides → PDF: agora é o CRM que gera.
 *
 * Auth: sessão de utilizador do CRM (o botão na página da lead abre este URL),
 * ou ?key=<IMPORT_API_SECRET> (link devolvido à extensão Chrome).
 * Fotos: leads.fotos (guardadas na importação mobile.de); fallback para a
 * pasta Drive (leads migradas do Notion).
 */
export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function GET(request, { params }) {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const key = new URL(request.url).searchParams.get('key');
  const keyOk = process.env.IMPORT_API_SECRET && key === process.env.IMPORT_API_SECRET;
  if (!session && !keyOk) {
    return Response.json({ error: 'Sessão necessária. Faça login no CRM.' }, { status: 401 });
  }

  let lead = null;
  if (session) {
    const { data } = await supabase.from('leads').select('*').eq('id', params.id).single();
    lead = data;
  } else {
    // via ?key= (extensão): a leitura passa pela RPC que valida o segredo
    const { data } = await supabase.rpc('ext_get_lead', {
      p_secret: key,
      p_lead: params.id,
    });
    lead = data;
  }
  if (!lead) {
    return Response.json({ error: 'Lead não encontrada' }, { status: 404 });
  }

  // URLs das fotos: da lead, ou extraídas da pasta Drive (leads migradas)
  let urls = Array.isArray(lead.fotos) ? lead.fotos.filter(Boolean) : [];
  if (urls.length === 0 && lead.link_drive) {
    urls = await extractDriveImages(lead.link_drive);
  }

  // Descarregar até 13 fotos (capa + 12 de galeria), 6 em paralelo
  const fotos = [];
  for (let i = 0; i < Math.min(urls.length, 13); i += 6) {
    const bufs = await Promise.all(urls.slice(i, i + 6).map(fetchImage));
    fotos.push(...bufs.filter(Boolean));
  }

  const logo = await fetchImage('https://serjohn.pt/logo.png');

  const titulo = (lead.carro_interesse || 'Proposta de importação').replace(/\s*\(\d{4}\)\s*$/, '');
  const cliente =
    lead.nome && !lead.nome.startsWith('Proposta —') ? lead.nome : null;

  try {
    const pdf = await buildPropostaPdf({
      titulo,
      cliente,
      ano: lead.proposta_ano,
      km: lead.proposta_km,
      combustivel: lead.proposta_combustivel,
      preco: lead.valor_proposta,
      descricao: lead.descricao_proposta,
      fotos,
      logo,
    });

    const nomeFicheiro = `Proposta Serjohn — ${titulo}.pdf`.replace(/[/\\]/g, '-');
    return new Response(pdf, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(nomeFicheiro)}`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (err) {
    console.error('[propostas] erro a gerar PDF:', err);
    return Response.json({ error: 'Erro a gerar o PDF: ' + err.message }, { status: 500 });
  }
}
