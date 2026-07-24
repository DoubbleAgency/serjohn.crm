import { createCarFolder, uploadImagesToFolder } from '@/lib/drive-write';
import { createAnonClient } from '@/lib/supabase/anon';

/**
 * POST /api/import-from-mobile — importação de um anúncio mobile.de para uma lead.
 * Mesmo contrato do endpoint antigo do site (a extensão Chrome não muda de código,
 * só de URL).
 *
 * Body: { leadId, car: { marca, modelo, ano, kms, combustivel, valorVenda,
 *                        extras, mobileDeUrl, photos: [...] } }
 *
 * Fluxo:
 *   1. Atualiza a lead no Supabase: dados do carro + URLs das fotos do anúncio
 *      + estado → Proposta. O PDF é gerado pelo próprio CRM (/api/propostas/[id]).
 *   2. (Opcional, legado) Se o Drive estiver configurado, cria pasta + upload
 *      das fotos — não é necessário para nada, fica só como arquivo.
 *
 * Returns: { ok, folderUrl, photoCount, photoErrors, leadId, propostaUrl }
 */
export const maxDuration = 60;

export async function POST(request) {
  if (!checkAuth(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders() });
  }

  let payload;
  try {
    payload = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400, headers: corsHeaders() });
  }

  const { leadId, car } = payload || {};
  if (!leadId) {
    return Response.json({ error: 'leadId is required' }, { status: 400, headers: corsHeaders() });
  }
  if (!car || typeof car !== 'object') {
    return Response.json({ error: 'car data is required' }, { status: 400, headers: corsHeaders() });
  }

  try {
    // 1. (Opcional/legado) Pasta Drive + fotos, se o Drive estiver configurado
    let folderUrl = '';
    let photoCount = 0;
    let photoErrors = 0;
    if (process.env.GOOGLE_SERVICE_ACCOUNT_JSON && process.env.DRIVE_PARENT_FOLDER_ID) {
      const folder = await createCarFolder(buildFolderName(car, leadId));
      folderUrl = folder.url;
      if (Array.isArray(car.photos) && car.photos.length > 0) {
        const uploads = await uploadImagesToFolder({
          folderId: folder.id,
          imageUrls: car.photos,
          prefix: slug(`${car.marca || ''}-${car.modelo || ''}`) || 'foto',
        });
        photoCount = uploads.filter((r) => r.ok).length;
        photoErrors = uploads.filter((r) => !r.ok).length;
      }
    }

    // 2. Atualizar a lead no Supabase
    const supabase = createAnonClient();
    const { data: updated, error } = await supabase.rpc('ext_import_update', {
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
        linkDrive: folderUrl || null,
        fotos: Array.isArray(car.photos) ? car.photos.slice(0, 40) : [],
      },
    });
    if (error) throw new Error(error.message);

    return Response.json(
      {
        ok: true,
        leadId,
        nome: updated?.nome || '',
        folderUrl,
        photoCount: Array.isArray(car.photos) ? car.photos.length : 0,
        photoErrors,
        propostaUrl: `/api/propostas/${leadId}`,
      },
      { headers: corsHeaders() }
    );
  } catch (err) {
    console.error('[/api/import-from-mobile] error:', err);
    return Response.json({ error: err.message }, { status: 500, headers: corsHeaders() });
  }
}

export async function OPTIONS() {
  return new Response(null, { status: 204, headers: corsHeaders() });
}

function checkAuth(request) {
  const secret = process.env.IMPORT_API_SECRET;
  if (!secret) return false;
  const auth = request.headers.get('authorization') || '';
  return auth === `Bearer ${secret}`;
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  };
}

function buildFolderName(car, leadId) {
  const parts = [car.marca, car.modelo, car.ano].filter(Boolean);
  const main = parts.join(' ') || 'Carro';
  const shortId = String(leadId).replace(/-/g, '').slice(0, 8);
  return `${main} — ${shortId}`;
}

function slug(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
