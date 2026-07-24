import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import LeadForm from '@/app/components/LeadForm';
import LeadActions from '@/app/components/LeadActions';
import TaskCheck from '@/app/components/TaskCheck';
import ImportAnuncio from '@/app/components/ImportAnuncio';

export const dynamic = 'force-dynamic';

export default async function LeadDetailPage({ params }) {
  const supabase = createClient();
  const { data: lead } = await supabase
    .from('leads')
    .select('*')
    .eq('id', params.id)
    .single();

  if (!lead) notFound();

  const [{ data: cars }, { data: vendedores }, { data: tasks }] = await Promise.all([
    supabase
      .from('cars')
      .select('id, marca, modelo, ano')
      .order('created_at', { ascending: false }),
    supabase.from('app_users').select('id, nome').eq('ativo', true),
    supabase
      .from('tasks')
      .select('*')
      .eq('lead_id', params.id)
      .order('estado', { ascending: true })
      .order('prazo', { ascending: true }),
  ]);

  return (
    <>
      <header>
        <h1>{lead.nome || 'Lead'}</h1>
        <span className={`badge ${lead.estado}`}>{lead.estado}</span>
      </header>

      <LeadActions lead={lead} />

      <LeadForm lead={lead} cars={cars || []} vendedores={vendedores || []} />

      <div style={{ marginTop: 16 }}>
        <ImportAnuncio leadId={lead.id} />
      </div>

      {(lead.mobile_de_url || lead.link_drive) && (
        <div className="card" style={{ marginTop: 16 }}>
          <h2 style={{ fontSize: 16, marginBottom: 8 }}>Proposta de importação</h2>
          {lead.mobile_de_url && (
            <p><a href={lead.mobile_de_url} target="_blank" style={{ textDecoration: 'underline' }}>Anúncio mobile.de ↗</a></p>
          )}
          {lead.link_drive && (
            <p><a href={lead.link_drive} target="_blank" style={{ textDecoration: 'underline' }}>Pasta de fotos no Drive ↗</a></p>
          )}
        </div>
      )}

      <h2 className="section-title">Tarefas desta lead</h2>
      <div className="card">
        {(tasks || []).length === 0 && <p className="empty">Sem tarefas.</p>}
        {(tasks || []).map((t) => (
          <TaskCheck key={t.id} task={t} />
        ))}
      </div>

      <p style={{ marginTop: 20 }}>
        <Link href="/leads" className="btn secondary small">← Voltar às leads</Link>
      </p>
    </>
  );
}
