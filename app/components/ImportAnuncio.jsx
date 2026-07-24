'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

/**
 * "Importar anúncio" — cola-se o link do mobile.de e é a própria plataforma
 * que vai lá buscar marca, modelo, ano, km, combustível, preço, descrição e fotos.
 *
 * - Com leadId: preenche essa lead.
 * - Sem leadId: cria uma lead nova e abre-a.
 */
export default function ImportAnuncio({ leadId = null, compacto = false }) {
  const router = useRouter();
  const [url, setUrl] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  async function importar(e) {
    e.preventDefault();
    if (!url.trim() || busy) return;
    setBusy(true);
    setMsg({ t: 'info', m: 'A ler o anúncio…' });
    try {
      const res = await fetch('/api/import-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), leadId }),
      });
      const data = await res.json();
      if (!res.ok) {
        const e = new Error(data.error || `HTTP ${res.status}`);
        e.bloqueado = !!data.bloqueado;
        throw e;
      }
      const c = data.car || {};
      const resumo = [
        [c.marca, c.modelo].filter(Boolean).join(' '),
        c.ano,
        c.kms != null ? `${c.kms.toLocaleString('pt-PT')} km` : null,
        c.valorVenda != null ? `€${c.valorVenda.toLocaleString('pt-PT')}` : null,
        `${c.fotos || 0} fotos`,
      ]
        .filter(Boolean)
        .join(' · ');
      setMsg({ t: 'ok', m: `Importado: ${resumo}`, lead: data.leadId });
      setUrl('');
      if (data.criada) router.push(`/leads/${data.leadId}`);
      router.refresh();
    } catch (err) {
      setMsg({ t: 'error', m: err.message, bloqueado: !!err.bloqueado });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={compacto ? 'import-anuncio compacto' : 'card import-anuncio'}>
      {!compacto && <h2 style={{ fontSize: 16, marginBottom: 8 }}>Importar anúncio mobile.de</h2>}
      <form onSubmit={importar} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://suchen.mobile.de/fahrzeuge/details.html?id=…"
          style={{ flex: '1 1 320px', minWidth: 0 }}
          disabled={busy}
        />
        <button className="btn small" type="submit" disabled={busy || !url.trim()}>
          {busy ? 'A ler…' : '⬇︎ Importar'}
        </button>
      </form>
      {!compacto && (
        <p className="hint" style={{ marginTop: 8 }}>
          Cola o link do anúncio: a plataforma lê marca, modelo, ano, quilómetros, combustível,
          preço, descrição e fotos, e {leadId ? 'preenche esta lead' : 'cria a lead'} pronta para gerar o PDF.
        </p>
      )}
      {msg && (
        <p className={msg.t === 'error' ? 'error-msg' : 'ok-msg'} style={{ marginTop: 8 }}>
          {msg.m}
          {msg.t === 'error' && msg.bloqueado && (
            <>
              {' '}
              <a href="/importar" style={{ textDecoration: 'underline' }}>
                Usar o marcador “Enviar para o Serjohn”
              </a>
            </>
          )}
          {msg.t === 'ok' && msg.lead && (
            <>
              {' · '}
              <a
                href={`/api/propostas/${msg.lead}`}
                target="_blank"
                rel="noreferrer"
                style={{ textDecoration: 'underline' }}
              >
                Abrir proposta (PDF)
              </a>
            </>
          )}
        </p>
      )}
    </div>
  );
}
