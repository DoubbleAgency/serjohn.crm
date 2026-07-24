/**
 * Gerador do PDF de proposta de importação — substitui o fluxo Make/Slides.
 * Identidade Serjohn: Fraunces (serif) + Inter Tight, creme #f6f4ef, tinta #1a1a1a.
 */

import PDFDocument from 'pdfkit';
import path from 'path';

const CREME = '#f6f4ef';
const INK = '#1a1a1a';
const INK60 = '#5e5c58';

const F = (file) => path.join(process.cwd(), 'lib', 'fonts', file);

const UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

/** Descarrega uma imagem e devolve Buffer se for JPEG/PNG (pdfkit não lê webp). */
async function fetchImage(url) {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': UA, Accept: 'image/jpeg,image/png,image/*;q=0.8' },
    });
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const isJpeg = buf[0] === 0xff && buf[1] === 0xd8;
    const isPng = buf[0] === 0x89 && buf[1] === 0x50;
    return isJpeg || isPng ? buf : null;
  } catch {
    return null;
  }
}

/** Imagem recortada para preencher exatamente a caixa (object-fit: cover). */
function coverImage(doc, buf, x, y, w, h, radius = 10) {
  doc.save();
  doc.roundedRect(x, y, w, h, radius).clip();
  const img = doc.openImage(buf);
  const scale = Math.max(w / img.width, h / img.height);
  const iw = img.width * scale;
  const ih = img.height * scale;
  doc.image(buf, x - (iw - w) / 2, y - (ih - h) / 2, { width: iw, height: ih });
  doc.restore();
}

function fmtEUR(n) {
  if (n === null || n === undefined) return null;
  return '€' + Number(n).toLocaleString('pt-PT');
}
function fmtKm(n) {
  if (n === null || n === undefined) return null;
  return Number(n).toLocaleString('pt-PT') + ' km';
}

const PAGE_W = 595.28;
const PAGE_H = 841.89;
const M = 46;
const CW = PAGE_W - M * 2; // 503

function pageBase(doc) {
  doc.rect(0, 0, PAGE_W, PAGE_H).fill(CREME);
  // rodapé
  doc
    .font('it400')
    .fontSize(8.5)
    .fillColor(INK60)
    .text('Serjohn — Importação Automóvel   ·   serjohn.pt   ·   import@serjohn.pt   ·   +351 911 563 424', M, PAGE_H - 40, {
      width: CW,
      align: 'center',
    });
}

function header(doc, logoBuf) {
  if (logoBuf) {
    const img = doc.openImage(logoBuf);
    const h = 30;
    const w = (img.width / img.height) * h;
    doc.image(logoBuf, M, M - 6, { width: w, height: h });
  } else {
    doc.font('fr600').fontSize(24).fillColor(INK).text('Serjohn', M, M - 6);
  }
  doc
    .font('it600')
    .fontSize(9)
    .fillColor(INK60)
    .text('PROPOSTA DE IMPORTAÇÃO', M, M + 2, { width: CW, align: 'right', characterSpacing: 1.5 });
  doc
    .font('it400')
    .fontSize(9)
    .fillColor(INK60)
    .text(new Date().toLocaleDateString('pt-PT'), M, M + 15, { width: CW, align: 'right' });
}

/**
 * Constrói o PDF e devolve um Buffer.
 * @param {object} p — { titulo, cliente, ano, km, combustivel, preco, descricao, fotos: Buffer[] }
 */
export async function buildPropostaPdf(p) {
  const doc = new PDFDocument({ size: 'A4', margin: 0, autoFirstPage: false, info: { Title: `Proposta — ${p.titulo}` } });

  doc.registerFont('fr600', F('fraunces-latin-600-normal.woff'));
  doc.registerFont('fr400', F('fraunces-latin-400-normal.woff'));
  doc.registerFont('it400', F('inter-tight-latin-400-normal.woff'));
  doc.registerFont('it500', F('inter-tight-latin-500-normal.woff'));
  doc.registerFont('it600', F('inter-tight-latin-600-normal.woff'));

  const chunks = [];
  doc.on('data', (c) => chunks.push(c));
  const done = new Promise((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));

  const fotos = p.fotos || [];

  // ---------- Página 1 ----------
  doc.addPage({ size: 'A4', margin: 0 });
  pageBase(doc);
  header(doc, p.logo);

  let y = M + 52;
  if (p.cliente) {
    doc.font('it500').fontSize(10.5).fillColor(INK60).text(`Preparada para ${p.cliente}`, M, y);
    y += 18;
  }
  doc.font('fr600').fontSize(27).fillColor(INK).text(p.titulo, M, y, { width: CW });
  y = doc.y + 14;

  // Foto de capa
  if (fotos[0]) {
    coverImage(doc, fotos[0], M, y, CW, 290, 12);
    y += 290 + 18;
  }

  // Painel de preço + specs
  const panelH = 74;
  doc.roundedRect(M, y, CW, panelH, 12).fill(INK);
  const cols = [
    p.preco ? ['Preço chave na mão', fmtEUR(p.preco)] : null,
    p.ano ? ['Ano', String(p.ano)] : null,
    p.km != null ? ['Quilómetros', fmtKm(p.km)] : null,
    p.combustivel ? ['Combustível', p.combustivel] : null,
  ].filter(Boolean);
  const colW = CW / Math.max(cols.length, 1);
  cols.forEach(([label, value], i) => {
    const cx = M + i * colW;
    doc.font('it500').fontSize(8.5).fillColor('#b9b6ae').text(label.toUpperCase(), cx, y + 16, {
      width: colW,
      align: 'center',
      characterSpacing: 0.8,
    });
    doc.font('fr600').fontSize(i === 0 ? 19 : 16).fillColor(CREME).text(value, cx, y + 32, {
      width: colW,
      align: 'center',
    });
  });
  y += panelH + 22;

  // Descrição / equipamento
  if (p.descricao) {
    doc.font('it600').fontSize(11).fillColor(INK).text('Equipamento e destaques', M, y);
    y = doc.y + 8;
    const linhas = String(p.descricao)
      .split('\n')
      .map((s) => s.replace(/^[•\-•\s⁠]+/, '').trim())
      .filter(Boolean)
      .slice(0, 18);
    const colWidth = (CW - 20) / 2;
    const half = Math.ceil(linhas.length / 2);
    const startY = y;
    [linhas.slice(0, half), linhas.slice(half)].forEach((col, ci) => {
      let yy = startY;
      col.forEach((linha) => {
        if (yy > PAGE_H - 70) return;
        doc.circle(M + ci * (colWidth + 20) + 3, yy + 5, 1.6).fill(INK);
        doc.font('it400').fontSize(9.5).fillColor(INK).text(linha, M + ci * (colWidth + 20) + 12, yy, {
          width: colWidth - 12,
        });
        yy = doc.y + 5;
      });
    });
  }

  // ---------- Páginas de fotos ----------
  const resto = fotos.slice(1, 13);
  for (let i = 0; i < resto.length; i += 6) {
    doc.addPage({ size: 'A4', margin: 0 });
    pageBase(doc);
    header(doc, p.logo);
    doc.font('fr600').fontSize(16).fillColor(INK).text('Galeria', M, M + 46);
    const grid = resto.slice(i, i + 6);
    const gw = (CW - 14) / 2;
    const gh = 158;
    grid.forEach((buf, gi) => {
      const gx = M + (gi % 2) * (gw + 14);
      const gy = M + 76 + Math.floor(gi / 2) * (gh + 14);
      coverImage(doc, buf, gx, gy, gw, gh, 10);
    });
  }

  // ---------- Página final / condições ----------
  doc.addPage({ size: 'A4', margin: 0 });
  pageBase(doc);
  header(doc, p.logo);
  let fy = M + 60;
  doc.font('fr600').fontSize(20).fillColor(INK).text('Como funciona', M, fy);
  fy = doc.y + 14;
  const passos = [
    ['Reserva', 'Confirmação da proposta e reserva da viatura junto do vendedor.'],
    ['Inspeção e transporte', 'Verificação da viatura, tratamento da documentação e transporte para Portugal.'],
    ['Legalização', 'ISV, matrícula portuguesa e inspeção — tratamos de todo o processo.'],
    ['Entrega', 'Entrega da viatura pronta a circular, com toda a documentação em nome do cliente.'],
  ];
  passos.forEach(([t, d], i) => {
    doc.font('fr600').fontSize(13).fillColor(INK).text(`${i + 1}.  ${t}`, M, fy);
    doc.font('it400').fontSize(10).fillColor(INK60).text(d, M + 22, doc.y + 3, { width: CW - 22 });
    fy = doc.y + 14;
  });
  fy += 10;
  doc.roundedRect(M, fy, CW, 92, 12).fill('#ffffff');
  doc.font('it600').fontSize(10.5).fillColor(INK).text('Fale connosco', M + 20, fy + 16);
  doc
    .font('it400')
    .fontSize(10)
    .fillColor(INK60)
    .text('WhatsApp / Telefone: +351 911 563 424  ·  +351 918 630 288', M + 20, fy + 34)
    .text('Email: import@serjohn.pt', M + 20, fy + 50)
    .text('Prata Riverside Village, Lote 1, 1950-127 Lisboa', M + 20, fy + 66);

  doc.end();
  return await done;
}

export { fetchImage };
