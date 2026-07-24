'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { fmtPrice, fmtDate, hoje } from '@/lib/format';

const ESTADOS = ['Nova', 'Contactado', 'Test-drive', 'Proposta', 'Negociação', 'Vendido', 'Perdido'];

export default function LeadsKanban({ initialLeads }) {
  const [leads, setLeads] = useState(initialLeads);
  const [err, setErr] = useState('');

  async function moveLead(id, estado) {
    const prev = leads;
    setLeads(leads.map((l) => (l.id === id ? { ...l, estado } : l)));
    const supabase = createClient();
    const { error } = await supabase.from('leads').update({ estado }).eq('id', id);
    if (error) {
      setErr('Não foi possível mover a lead: ' + error.message);
      setLeads(prev);
    } else {
      setErr('');
    }
  }

  return (
    <>
      {err && <p className="error-msg" style={{ marginBottom: 12 }}>{err}</p>}
      <div className="kanban">
        {ESTADOS.map((estado) => {
          const col = leads.filter((l) => l.estado === estado);
          return (
            <div className="col" key={estado}>
              <h3>
                {estado} <span>{col.length}</span>
              </h3>
              {col.map((l) => (
                <div className="kcard" key={l.id}>
                  <Link href={`/leads/${l.id}`}>
                    <div className="knome">{l.nome || '(sem nome)'}</div>
                    <div className="kinfo">
                      {l.carro_interesse || 'Sem carro definido'}
                      {l.valor_proposta ? ` · ${fmtPrice(l.valor_proposta)}` : ''}
                    </div>
                  </Link>
                  <div className="kfoot">
                    {l.follow_up ? (
                      <span className={l.follow_up <= hoje() && !['Vendido', 'Perdido'].includes(estado) ? 'followup-late' : 'kinfo'}>
                        {fmtDate(l.follow_up)}
                      </span>
                    ) : (
                      <span className="kinfo">{l.origem}</span>
                    )}
                    <select
                      value={estado}
                      onChange={(e) => moveLead(l.id, e.target.value)}
                      aria-label="Mudar estado"
                    >
                      {ESTADOS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </div>
                </div>
              ))}
              {col.length === 0 && <p className="empty" style={{ padding: '4px 2px', fontSize: 13 }}>—</p>}
            </div>
          );
        })}
      </div>
    </>
  );
}
