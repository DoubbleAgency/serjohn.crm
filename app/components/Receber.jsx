'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';

/**
 * Recebe, por postMessage, o anúncio lido pelo bookmarklet na página do mobile.de
 * e cria/preenche a lead. Só aceita mensagens vindas de *.mobile.de.
 */
export default function Receber() {
  const [estado, setEstado] = useState('espera'); // espera | a-gravar | ok | erro
  const [msg, setMsg] = useState('');
  const [resultado, setResultado] = useState(null);
  const tratado = useRef(false);

  useEffect(() => {
    function onMessage(ev) {
      let host = '';
      try {
        host = new URL(ev.origin).hostname;
      } catch {
        return;
      }
      if (!/(^|\.)mobile\.de$/i.test(host)) return;
      if (!ev.data || ev.data.type !== 'serjohn-anuncio') return;

      // confirmar ao bookmarklet para ele parar de reenviar
      try {
        ev.source?.postMessage({ type: 'serjohn-ok' }, ev.origin);
      } catch {
        /* ignorar */
      }
      if (tratado.current) return;
      tratado.current = true;
      guardar(ev.data.car);
    }

    async function guardar(car) {
      setEstado('a-gravar');
      try {
        const res = await fetch('/api/import-payload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ car }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        setResultado(data);
        setEstado('ok');
      } catch (err) {
        setMsg(err.message);
        setEstado('erro');
      }
    }

    window.addEventListener('message', onMessage);
    const limite = setTimeout(() => {
      if (!tratado.current) {
        setEstado('erro');
        setMsg('Não recebi nada do anúncio. Volte à página do mobile.de e carregue outra vez no marcador.');
      }
    }, 30000);
    return () => {
      window.removeEventListener('message', onMessage);
      clearTimeout(limite);
    };
  }, []);

  if (estado === 'espera' || estado === 'a-gravar') {
    return (
      <div className="card">
        <p>{estado === 'espera' ? 'À espera dos dados do anúncio…' : 'A guardar na lead…'}</p>
        <p className="hint" style={{ marginTop: 8 }}>
          Pode deixar esta janela aberta — fecha-se sozinha quando terminar.
        </p>
      </div>
    );
  }

  if (estado === 'erro') {
    return (
      <div className="card">
        <p className="error-msg">{msg}</p>
        <p style={{ marginTop: 12 }}>
          <Link href="/importar" className="btn secondary small">← Voltar a Importar</Link>
        </p>
      </div>
    );
  }

  const c = resultado?.car || {};
  const linhas = [
    ['Carro', [c.marca, c.modelo].filter(Boolean).join(' ')],
    ['Ano', c.ano],
    ['Quilómetros', c.kms != null ? c.kms.toLocaleString('pt-PT') + ' km' : null],
    ['Combustível', c.combustivel],
    ['Preço', c.valorVenda != null ? '€' + c.valorVenda.toLocaleString('pt-PT') : null],
    ['Fotos', c.fotos],
  ].filter(([, v]) => v !== null && v !== undefined && v !== '');

  return (
    <div className="card">
      <p className="ok-msg" style={{ marginBottom: 12 }}>
        {resultado.criada ? 'Lead criada e preenchida.' : 'Lead actualizada.'}
      </p>
      <table className="tbl" style={{ marginBottom: 16 }}>
        <tbody>
          {linhas.map(([k, v]) => (
            <tr key={k}>
              <td style={{ width: 160, color: 'var(--ink-60)' }}>{k}</td>
              <td>{String(v)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <a className="btn small" href={`/api/propostas/${resultado.leadId}`} target="_blank" rel="noreferrer">
          📄 Abrir proposta (PDF)
        </a>
        <Link className="btn secondary small" href={`/leads/${resultado.leadId}`}>
          Abrir a lead
        </Link>
      </div>
    </div>
  );
}
