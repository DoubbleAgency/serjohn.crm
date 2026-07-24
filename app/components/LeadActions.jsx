'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

/**
 * Ações rápidas na lead:
 *  - "Tentei contactar (sem resposta)" → rpc registar_tentativa (follow-up +2, tarefa de ligar)
 *  - "Converter em stock" → cria um carro a partir dos dados da proposta e liga-o à lead
 */
export default function LeadActions({ lead }) {
  const router = useRouter();
  const [busy, setBusy] = useState('');
  const [msg, setMsg] = useState(null);

  async function tentativa() {
    setBusy('t');
    const supabase = createClient();
    const { error } = await supabase.rpc('registar_tentativa', { p_lead: lead.id });
    setBusy('');
    if (error) setMsg({ t: 'error', m: error.message });
    else {
      setMsg({ t: 'ok', m: 'Tentativa registada — follow-up daqui a 2 dias.' });
      router.refresh();
    }
  }

  async function converterEmStock() {
    setBusy('c');
    const supabase = createClient();
    const partes = (lead.carro_interesse || '').replace(/\((\d{4})\)/, '').trim().split(/\s+/);
    const marca = partes[0] || '';
    const modelo = partes.slice(1).join(' ') || lead.carro_interesse || '';
    const anoMatch = (lead.carro_interesse || '').match(/\((\d{4})\)/);
    const fotosLead = Array.isArray(lead.fotos) ? lead.fotos : [];
    const { data, error } = await supabase
      .from('cars')
      .insert({
        marca,
        modelo,
        ano: anoMatch ? parseInt(anoMatch[1], 10) : lead.proposta_ano || null,
        km: lead.proposta_km || null,
        combustivel: lead.proposta_combustivel || null,
        preco: lead.valor_proposta || null,
        estado: 'Disponível',
        link_drive: lead.link_drive || null,
        mobile_de_url: lead.mobile_de_url || null,
        descricao: lead.descricao_proposta || `Importado da lead de ${lead.nome || '—'}.`,
        fotos: fotosLead,
      })
      .select('id')
      .single();
    if (error) {
      setBusy('');
      setMsg({ t: 'error', m: 'Erro ao criar carro: ' + error.message });
      return;
    }
    await supabase.from('leads').update({ car_id: data.id }).eq('id', lead.id);
    // Copiar as fotos externas para o nosso Storage em segundo plano
    if (fotosLead.length > 0) {
      fetch('/api/stock/rehost-photos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ carId: data.id, urls: fotosLead }),
      }).catch(() => {});
    }
    setBusy('');
    router.push(`/stock/${data.id}`);
    router.refresh();
  }

  return (
    <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16, alignItems: 'center' }}>
      <button className="btn secondary small" onClick={tentativa} disabled={busy !== ''}>
        {busy === 't' ? 'A registar…' : '📞 Tentei contactar (sem resposta)'}
      </button>
      {(lead.carro_interesse || (Array.isArray(lead.fotos) && lead.fotos.length > 0) || lead.link_drive) && (
        <a className="btn small" href={`/api/propostas/${lead.id}`} target="_blank" rel="noreferrer">
          📄 Gerar proposta (PDF)
        </a>
      )}
      {!lead.car_id && (lead.carro_interesse || lead.link_drive) && (
        <button className="btn secondary small" onClick={converterEmStock} disabled={busy !== ''}>
          {busy === 'c' ? 'A criar…' : '🚗 Converter em carro de stock'}
        </button>
      )}
      {msg && <span className={msg.t === 'ok' ? 'ok-msg' : 'error-msg'}>{msg.m}</span>}
    </div>
  );
}
