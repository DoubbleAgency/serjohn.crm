import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { fmtPrice, fmtKm } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function StockPage() {
  const supabase = createClient();
  const { data: cars } = await supabase
    .from('cars')
    .select('id, marca, modelo, versao, ano, km, combustivel, preco, preco_promo, estado, destaque, fotos')
    .order('estado', { ascending: true })
    .order('created_at', { ascending: false });

  const lista = cars || [];

  return (
    <>
      <header>
        <h1>Stock ({lista.filter((c) => c.estado !== 'Vendido').length} à venda)</h1>
        <Link href="/stock/novo" className="btn">+ Adicionar carro</Link>
      </header>

      <div className="stock-grid">
        {lista.map((c) => {
          const foto = Array.isArray(c.fotos) && c.fotos.length > 0 ? c.fotos[0] : null;
          return (
            <Link href={`/stock/${c.id}`} className="stock-card" key={c.id}>
              {foto ? (
                <img className="ph" src={foto} alt="" loading="lazy" />
              ) : (
                <div className="ph" />
              )}
              <div className="body">
                <div className="nm">
                  {[c.marca, c.modelo].filter(Boolean).join(' ')}
                  {c.destaque ? ' ★' : ''}
                </div>
                <div className="meta">
                  {[c.ano, fmtKm(c.km), c.combustivel].filter(Boolean).join(' · ')}
                </div>
                <div className="rowline">
                  <span className="pr">{fmtPrice(c.preco_promo || c.preco)}</span>
                  <span className={`badge ${c.estado}`}>{c.estado}</span>
                </div>
              </div>
            </Link>
          );
        })}
        {lista.length === 0 && <p className="empty">Ainda não há carros. Adiciona o primeiro.</p>}
      </div>
    </>
  );
}
