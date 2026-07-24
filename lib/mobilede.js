/**
 * Leitor de anúncios mobile.de — do lado do servidor.
 *
 * Objetivo: o CRM lê o anúncio sozinho a partir do link, sem extensão Chrome.
 * O mobile.de tem protecção anti-bot, por isso isto pode falhar; quando falha,
 * devolvemos um erro claro e o utilizador usa a extensão como alternativa.
 *
 * Estratégias de leitura, por ordem:
 *   1. JSON-LD (<script type="application/ld+json">) — Car / Vehicle / Product
 *   2. Estado embebido (__NEXT_DATA__ / __INITIAL_STATE__ / __PRELOADED_STATE__)
 *   3. Meta tags og:
 *   4. Regex sobre o texto visível (Erstzulassung, Kilometerstand, ...)
 */

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

const HEADERS = {
  'User-Agent': UA,
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'de-DE,de;q=0.9,pt-PT;q=0.8,pt;q=0.7,en;q=0.6',
  'Cache-Control': 'no-cache',
  Pragma: 'no-cache',
  'Sec-Ch-Ua': '"Chromium";v="126", "Google Chrome";v="126", "Not-A.Brand";v="99"',
  'Sec-Ch-Ua-Mobile': '?0',
  'Sec-Ch-Ua-Platform': '"macOS"',
  'Sec-Fetch-Dest': 'document',
  'Sec-Fetch-Mode': 'navigate',
  'Sec-Fetch-Site': 'none',
  'Sec-Fetch-User': '?1',
  'Upgrade-Insecure-Requests': '1',
};

const MARCAS_COMPOSTAS = [
  'Alfa Romeo',
  'Aston Martin',
  'Land Rover',
  'Mercedes-Benz',
  'Rolls-Royce',
  'Great Wall',
  'DS Automobiles',
];

// Ordem importa: "Hybrid (Petrol/Electric)" tem de dar Híbrido, não Gasolina.
const COMBUSTIVEIS = [
  [/plug.?in|steckdose/i, 'Híbrido Plug-In'],
  [/hybrid|híbrid|hibrid/i, 'Híbrido'],
  [/elektro|electric|eléctric|elétric/i, 'Elétrico'],
  [/diesel|gasóleo|gasoleo/i, 'Gasóleo'],
  [/benzin|petrol|gasoline|gasolina/i, 'Gasolina'],
  [/lpg|autogas/i, 'GPL'],
  [/cng|erdgas/i, 'GNC'],
];

function normalizaCombustivel(txt) {
  if (!txt) return null;
  for (const [re, valor] of COMBUSTIVEIS) if (re.test(txt)) return valor;
  return String(txt).trim().slice(0, 40) || null;
}

/**
 * Converte para inteiro, distinguindo separador de milhares de casas decimais:
 *   "44900.00" -> 44900   "44.900" -> 44900   "20.137 km" -> 20137
 */
function inteiro(v) {
  if (v === null || v === undefined) return null;
  if (typeof v === 'number') return Number.isFinite(v) ? Math.round(v) : null;
  const bruto = String(v).replace(/[\s\u00a0\u202f]/g, '');
  const m = bruto.match(/-?\d[\d.,]*/);
  if (!m) return null;
  let s = m[0];
  const dec = s.match(/^(-?[\d.,]*?)([.,])(\d{1,2})$/);
  if (dec && /^\d{1,3}([.,]\d{3})*$|^\d+$/.test(dec[1].replace(/^-/, ''))) {
    s = dec[1].replace(/[.,]/g, '') + '.' + dec[3];
  } else {
    s = s.replace(/[.,]/g, '');
  }
  const n = Math.round(parseFloat(s));
  return Number.isFinite(n) ? n : null;
}

function partirTitulo(titulo) {
  const t = String(titulo || '').replace(/\s+/g, ' ').trim();
  if (!t) return { marca: null, modelo: null };
  for (const b of MARCAS_COMPOSTAS) {
    if (t.toLowerCase().startsWith(b.toLowerCase())) {
      return { marca: b, modelo: t.slice(b.length).trim() || null };
    }
  }
  const [primeiro, ...resto] = t.split(' ');
  return { marca: primeiro, modelo: resto.join(' ') || null };
}

/** Sobe a resolução das fotos do CDN do mobile.de e limpa duplicados. */
function normalizaFoto(src) {
  if (!src) return null;
  let u = String(src).trim();
  if (u.startsWith('//')) u = 'https:' + u;
  if (!/^https?:\/\//i.test(u)) return null;
  if (!/classistatic\.de|s\.mobile\.de|mobile\.de\/.*images/i.test(u)) return null;
  // tem de ser mesmo uma imagem (e não só o domínio do CDN)
  if (!/\/(images|api)\//i.test(u) && !/\.(jpe?g|png)/i.test(u)) return null;
  // ignorar logos / ícones / avatares de stand
  if (/logo|icon|sprite|placeholder|dealer|handler|avatar/i.test(u)) return null;
  // formato novo: .../images/<id>?rule=mo-360.jpg  →  rule=mo-1600.jpg
  u = u.replace(/rule=[a-z0-9-]+\.(jpg|jpeg|png)/i, 'rule=mo-1600.jpg');
  // formato antigo: .../$_12.JPG  →  $_57.JPG (grande)
  u = u.replace(/\/\$_\d+(\.[A-Za-z]+)?$/, '/$_57.JPG');
  return u;
}

function chaveFoto(u) {
  return u.split('?')[0].replace(/\/\$_\d+(\.[A-Za-z]+)?$/, '');
}

function recolheFotos(html, extra = []) {
  const encontradas = [];
  const push = (s) => {
    const n = normalizaFoto(s);
    if (n) encontradas.push(n);
  };
  extra.forEach(push);
  // o HTML traz URLs com barras escapadas dentro de JSON — desfazer primeiro
  const limpo = String(html).replace(/\\\//g, '/');
  const re = /https?:\/\/[^"'\s\\)]*(?:classistatic\.de|s\.mobile\.de)[^"'\s\\)]*/gi;
  let m;
  while ((m = re.exec(limpo)) !== null) push(m[0]);

  const vistas = new Set();
  const out = [];
  for (const u of encontradas) {
    const k = chaveFoto(u);
    if (vistas.has(k)) continue;
    vistas.add(k);
    out.push(u);
  }
  return out.slice(0, 40);
}

/** Todos os blocos JSON-LD do documento. */
function jsonLd(html) {
  const out = [];
  const re = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    try {
      const parsed = JSON.parse(m[1].trim());
      Array.isArray(parsed) ? out.push(...parsed) : out.push(parsed);
    } catch {
      /* bloco inválido — ignorar */
    }
  }
  // desdobrar @graph
  const expandido = [];
  for (const n of out) {
    if (n && Array.isArray(n['@graph'])) expandido.push(...n['@graph']);
    else expandido.push(n);
  }
  return expandido.filter(Boolean);
}

function meta(html, prop) {
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${prop}["'][^>]+content=["']([^"']*)["']`,
    'i'
  );
  const m = html.match(re);
  if (m) return decodeHtml(m[1]);
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]+(?:property|name)=["']${prop}["']`,
    'i'
  );
  const m2 = html.match(re2);
  return m2 ? decodeHtml(m2[1]) : null;
}

function decodeHtml(s) {
  return String(s || '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&euro;/g, '€')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)));
}

/** Texto visível aproximado (sem scripts/estilos/tags). */
function textoVisivel(html) {
  return decodeHtml(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, ' ')
      .replace(/<style[\s\S]*?<\/style>/gi, ' ')
      .replace(/<[^>]+>/g, ' ')
  )
    .replace(/[\s ]+/g, ' ')
    .trim();
}

/** Procura "Etiqueta: valor" no texto visível, para várias etiquetas possíveis. */
function porEtiqueta(texto, etiquetas, janela = 60) {
  for (const et of etiquetas) {
    const re = new RegExp(et + '[^A-Za-z0-9€]{0,4}([^|]{0,' + janela + '})', 'i');
    const m = texto.match(re);
    if (m && m[1]) return m[1].trim();
  }
  return null;
}

/** Percorre um objeto à procura da primeira chave que satisfaça o teste. */
function procuraFundo(obj, teste, profundidade = 0) {
  if (!obj || profundidade > 8) return undefined;
  if (Array.isArray(obj)) {
    for (const it of obj) {
      const r = procuraFundo(it, teste, profundidade + 1);
      if (r !== undefined) return r;
    }
    return undefined;
  }
  if (typeof obj !== 'object') return undefined;
  for (const [k, v] of Object.entries(obj)) {
    if (teste(k, v)) return v;
  }
  for (const v of Object.values(obj)) {
    const r = procuraFundo(v, teste, profundidade + 1);
    if (r !== undefined) return r;
  }
  return undefined;
}

function estadoEmbebido(html) {
  const padroes = [
    /<script[^>]+id=["']__NEXT_DATA__["'][^>]*>([\s\S]*?)<\/script>/i,
    /window\.__INITIAL_STATE__\s*=\s*({[\s\S]*?})\s*;?\s*<\/script>/i,
    /window\.__PRELOADED_STATE__\s*=\s*({[\s\S]*?})\s*;?\s*<\/script>/i,
    /window\.__PUBLIC_CONFIG__[\s\S]{0,50}?({[\s\S]*?})\s*;?\s*<\/script>/i,
  ];
  for (const re of padroes) {
    const m = html.match(re);
    if (!m) continue;
    try {
      return JSON.parse(m[1]);
    } catch {
      /* ignorar */
    }
  }
  return null;
}

export function isMobileDeUrl(url) {
  try {
    const u = new URL(url);
    return /(^|\.)mobile\.de$/i.test(u.hostname);
  } catch {
    return false;
  }
}

/** Faz o pedido HTTP ao anúncio. Lança erro legível se for bloqueado. */
async function descarrega(url) {
  let res;
  try {
    res = await fetch(url, { headers: HEADERS, redirect: 'follow' });
  } catch (e) {
    throw new Error('Não foi possível contactar o mobile.de (' + e.message + ').');
  }
  if (res.status === 403 || res.status === 429 || res.status === 503) {
    const err = new Error(
      'O mobile.de bloqueou o pedido automático (HTTP ' + res.status + ').'
    );
    err.bloqueado = true;
    throw err;
  }
  if (!res.ok) throw new Error('O anúncio respondeu HTTP ' + res.status + '.');
  const html = await res.text();
  if (/captcha|are you a human|bist du ein mensch|access denied/i.test(html.slice(0, 4000))) {
    const err = new Error('O mobile.de devolveu uma página de verificação anti-bot.');
    err.bloqueado = true;
    throw err;
  }
  return html;
}

/**
 * Lê um anúncio mobile.de e devolve os dados no mesmo formato que a extensão.
 * @returns {Promise<{marca,modelo,ano,kms,combustivel,valorVenda,extras,photos,mobileDeUrl,titulo}>}
 */
export async function lerAnuncioMobileDe(url) {
  const html = await descarrega(url);
  return extraiDoHtml(html, url);
}

export function extraiDoHtml(html, url) {
  const out = {
    marca: null,
    modelo: null,
    ano: null,
    kms: null,
    combustivel: null,
    valorVenda: null,
    extras: null,
    photos: [],
    mobileDeUrl: url,
    titulo: null,
  };

  const nos = jsonLd(html);
  const carro = nos.find((n) => {
    const t = n && n['@type'];
    const tipos = Array.isArray(t) ? t : [t];
    return tipos.some((x) => /^(Car|Vehicle|Product|IndividualProduct)$/i.test(String(x || '')));
  });

  // ---- 1. JSON-LD ----
  if (carro) {
    out.titulo = carro.name || null;
    const marca = carro.brand?.name || carro.manufacturer?.name || carro.brand;
    if (typeof marca === 'string' && marca.trim()) out.marca = marca.trim();
    if (typeof carro.model === 'string' && carro.model.trim()) out.modelo = carro.model.trim();
    out.ano =
      inteiro(String(carro.vehicleModelDate || carro.productionDate || carro.modelDate || '').slice(0, 4)) ||
      null;
    const km = carro.mileageFromOdometer;
    out.kms = inteiro(typeof km === 'object' ? km?.value : km);
    const fuel = carro.fuelType;
    out.combustivel = normalizaCombustivel(typeof fuel === 'object' ? fuel?.name : fuel);
    const oferta = Array.isArray(carro.offers) ? carro.offers[0] : carro.offers;
    out.valorVenda = inteiro(oferta?.price ?? oferta?.priceSpecification?.price);
    if (typeof carro.description === 'string') out.extras = carro.description.trim();
    const imgs = Array.isArray(carro.image) ? carro.image : carro.image ? [carro.image] : [];
    out.photos = imgs.map((i) => (typeof i === 'object' ? i.url || i.contentUrl : i)).filter(Boolean);
  }

  // ---- 2. Estado embebido ----
  const estado = estadoEmbebido(html);
  if (estado) {
    const num = (chaves) =>
      inteiro(procuraFundo(estado, (k, v) => chaves.includes(k) && (typeof v === 'number' || typeof v === 'string')));
    const txt = (chaves) => {
      const v = procuraFundo(estado, (k, val) => chaves.includes(k) && typeof val === 'string' && val.trim());
      return typeof v === 'string' ? v.trim() : null;
    };
    if (out.ano == null) out.ano = num(['firstRegistration', 'firstRegistrationYear', 'year', 'modelYear']);
    if (out.kms == null) out.kms = num(['mileage', 'kilometers', 'km', 'odometer']);
    if (out.valorVenda == null) out.valorVenda = num(['grossAmount', 'consumerPriceGross', 'priceAmount']);
    if (!out.combustivel) out.combustivel = normalizaCombustivel(txt(['fuel', 'fuelType', 'fuelCategory']));
    if (!out.titulo) out.titulo = txt(['adTitle', 'title', 'headline']);
    if (!out.extras) out.extras = txt(['description', 'sellerNotes', 'vehicleDescription']);
  }

  // ---- 3. Meta og: ----
  if (!out.titulo) out.titulo = meta(html, 'og:title') || meta(html, 'twitter:title');
  const ogDesc = meta(html, 'og:description') || meta(html, 'description');
  if (!out.extras && ogDesc) out.extras = ogDesc;

  // ---- 4. Texto visível ----
  const texto = textoVisivel(html).slice(0, 60000);
  if (out.ano == null) {
    const s = porEtiqueta(texto, ['Erstzulassung', 'First Registration', 'Matrícula', 'Registration']);
    const m = s && s.match(/(19|20)\d{2}/);
    if (m) out.ano = parseInt(m[0], 10);
  }
  if (out.kms == null) {
    const s = porEtiqueta(texto, ['Kilometerstand', 'Mileage', 'Quilómetros', 'Kilometraje']);
    if (s) out.kms = inteiro(s.replace(/km.*/i, ''));
  }
  if (!out.combustivel) {
    const s = porEtiqueta(texto, ['Kraftstoffart', 'Kraftstoff', 'Fuel type', 'Combustível']);
    out.combustivel = normalizaCombustivel(s);
  }
  if (out.valorVenda == null) {
    const m = texto.match(/(?:€|EUR)\s?([\d.  ]{4,12})/) || texto.match(/([\d.  ]{4,12})\s?(?:€|EUR)/);
    if (m) {
      const n = inteiro(m[1]);
      if (n && n > 500 && n < 5000000) out.valorVenda = n;
    }
  }

  // ---- Marca/modelo a partir do título, se ainda faltarem ----
  if (out.titulo) {
    const limpo = out.titulo
      .replace(/\s*\|\s*mobile\.de.*$/i, '')
      .replace(/\s*-\s*gebraucht.*$/i, '')
      .trim();
    out.titulo = limpo;
    if (!out.marca || !out.modelo) {
      const p = partirTitulo(limpo);
      out.marca = out.marca || p.marca;
      out.modelo = out.modelo || p.modelo;
    }
  }
  if (out.marca && out.modelo && out.modelo.toLowerCase().startsWith(out.marca.toLowerCase())) {
    out.modelo = out.modelo.slice(out.marca.length).trim();
  }

  // ---- Fotos ----
  out.photos = recolheFotos(html, out.photos);

  // ---- Limpeza da descrição ----
  if (out.extras) {
    out.extras = decodeHtml(out.extras)
      .replace(/\r/g, '')
      .replace(/[ \t ]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
      .slice(0, 4000);
  }

  return out;
}

export { normalizaCombustivel, partirTitulo, recolheFotos };
