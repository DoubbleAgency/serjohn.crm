'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

const ORIGENS = ['site', 'telefone', 'stand', 'whatsapp', 'olx', 'meta-ads', 'outro'];
const ESTADOS = ['Nova', 'Contactado', 'Test-drive', 'Proposta', 'Negociação', 'Vendido', 'Perdido'];

export default function LeadForm({ lead, cars, vendedores }) {
  const router = useRouter();
  const isNew = !lead;
  const [f, setF] = useState({
    nome: lead?.nome || '',
    telefone: lead?.telefone || '',
    email: lead?.email || '',
    origem: lead?.origem || 'stand',
    estado: lead?.estado || 'Nova',
    vendedor_id: lead?.vendedor_id || '',
    follow_up: lead?.follow_up || '',
    carro_interesse: lead?.carro_interesse || '',
    car_id: lead?.car_id || '',
    orcamento_max: lead?.orcamento_max ?? '',
    kms_max: lead?.kms_max ?? '',
    valor_proposta: lead?.valor_proposta ?? '',
    retoma: lead?.retoma || false,
    retoma_descricao: lead?.retoma_descricao || '',
    matricula_retoma: lead?.matricula_retoma || '',
    financiamento: lead?.financiamento || false,
    notas: lead?.notas || '',
  });
  const [msg, setMsg] = useState(null);
  const [busy, setBusy] = useState(false);

  function set(k, v) {
    setF((prev) => ({ ...prev, [k]: v }));
  }

  async function onSubmit(e) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const supabase = createClient();
    const payload = {
      ...f,
      vendedor_id: f.vendedor_id || null,
      car_id: f.car_id || null,
      follow_up: f.follow_up || null,
      orcamento_max: f.orcamento_max === '' ? null : Number(f.orcamento_max),
      kms_max: f.kms_max === '' ? null : Number(f.kms_max),
      valor_proposta: f.valor_proposta === '' ? null : Number(f.valor_proposta),
    };
    let error;
    if (isNew) {
      const r = await supabase.from('leads').insert(payload).select('id').single();
      error = r.error;
      if (!error) {
        router.push(`/leads/${r.data.id}`);
        router.refresh();
        return;
      }
    } else {
      const r = await supabase.from('leads').update(payload).eq('id', lead.id);
      error = r.error;
    }
    if (error) setMsg({ t: 'error', m: 'Erro ao guardar: ' + error.message });
    else {
      setMsg({ t: 'ok', m: 'Guardado.' });
      router.refresh();
    }
    setBusy(false);
  }

  return (
    <form className="form card" onSubmit={onSubmit}>
      <div className="row three">
        <label className="field">Nome
          <input value={f.nome} onChange={(e) => set('nome', e.target.value)} required />
        </label>
        <label className="field">Telefone
          <input value={f.telefone} onChange={(e) => set('telefone', e.target.value)} />
        </label>
        <label className="field">Email
          <input type="email" value={f.email} onChange={(e) => set('email', e.target.value)} />
        </label>
      </div>

      <div className="row three">
        <label className="field">Origem
          <select value={f.origem} onChange={(e) => set('origem', e.target.value)}>
            {ORIGENS.map((o) => <option key={o}>{o}</option>)}
          </select>
        </label>
        <label className="field">Estado
          <select value={f.estado} onChange={(e) => set('estado', e.target.value)}>
            {ESTADOS.map((o) => <option key={o}>{o}</option>)}
          </select>
        </label>
        <label className="field">Vendedor
          <select value={f.vendedor_id} onChange={(e) => set('vendedor_id', e.target.value)}>
            <option value="">— sem dono —</option>
            {(vendedores || []).map((v) => (
              <option key={v.id} value={v.id}>{v.nome}</option>
            ))}
          </select>
        </label>
      </div>

      <div className="row three">
        <label className="field">Carro de interesse (texto)
          <input
            value={f.carro_interesse}
            onChange={(e) => set('carro_interesse', e.target.value)}
            placeholder="ex: BMW 320d 2019"
          />
        </label>
        <label className="field">Carro do stock
          <select value={f.car_id} onChange={(e) => set('car_id', e.target.value)}>
            <option value="">— nenhum —</option>
            {(cars || []).map((c) => (
              <option key={c.id} value={c.id}>
                {[c.marca, c.modelo, c.ano].filter(Boolean).join(' ')}
              </option>
            ))}
          </select>
        </label>
        <label className="field">Follow-up
          <input type="date" value={f.follow_up || ''} onChange={(e) => set('follow_up', e.target.value)} />
        </label>
      </div>

      <div className="row three">
        <label className="field">Orçamento máx. (€)
          <input type="number" value={f.orcamento_max} onChange={(e) => set('orcamento_max', e.target.value)} />
        </label>
        <label className="field">Kms máx.
          <input type="number" value={f.kms_max} onChange={(e) => set('kms_max', e.target.value)} />
        </label>
        <label className="field">Valor proposta (€)
          <input type="number" value={f.valor_proposta} onChange={(e) => set('valor_proposta', e.target.value)} />
        </label>
      </div>

      <div className="row">
        <label className="check">
          <input type="checkbox" checked={f.financiamento} onChange={(e) => set('financiamento', e.target.checked)} />
          Precisa de financiamento
        </label>
        <label className="check">
          <input type="checkbox" checked={f.retoma} onChange={(e) => set('retoma', e.target.checked)} />
          Tem retoma
        </label>
      </div>

      {f.retoma && (
        <div className="row">
          <label className="field">Viatura de retoma
            <input value={f.retoma_descricao} onChange={(e) => set('retoma_descricao', e.target.value)} placeholder="ex: Renault Clio 2016, 120.000 km" />
          </label>
          <label className="field">Matrícula da retoma
            <input value={f.matricula_retoma} onChange={(e) => set('matricula_retoma', e.target.value)} />
          </label>
        </div>
      )}

      <label className="field">Notas
        <textarea value={f.notas} onChange={(e) => set('notas', e.target.value)} />
      </label>

      {msg && <p className={msg.t === 'ok' ? 'ok-msg' : 'error-msg'}>{msg.m}</p>}
      <div>
        <button className="btn" disabled={busy}>{busy ? 'A guardar…' : isNew ? 'Criar lead' : 'Guardar alterações'}</button>
      </div>
    </form>
  );
}
