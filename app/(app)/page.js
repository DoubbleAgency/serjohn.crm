import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { fmtDate, hoje } from '@/lib/format';
import TaskCheck from '@/app/components/TaskCheck';

export const dynamic = 'force-dynamic';

export default async function MinhaArea() {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  const uid = session.user.id;

  const [tasksRes, leadsRes, carsRes, allLeadsRes] = await Promise.all([
    supabase
      .from('tasks')
      .select('id, titulo, descricao, prazo, prioridade, departamento, estado, lead_id, assignee_id')
      .eq('estado', 'Aberta')
      .or(`assignee_id.eq.${uid},assignee_id.is.null`)
      .order('prazo', { ascending: true, nullsFirst: false })
      .limit(30),
    supabase
      .from('leads')
      .select('id, nome, carro_interesse, estado, follow_up, tentativas')
      .lte('follow_up', hoje())
      .not('estado', 'in', '("Vendido","Perdido")')
      .order('follow_up', { ascending: true })
      .limit(30),
    supabase.from('cars').select('id, estado'),
    supabase.from('leads').select('id, estado'),
  ]);

  const tasks = tasksRes.data || [];
  const followups = leadsRes.data || [];
  const cars = carsRes.data || [];
  const allLeads = allLeadsRes.data || [];

  const nDisponivel = cars.filter((c) => c.estado === 'Disponível').length;
  const nAtivas = allLeads.filter((l) => !['Vendido', 'Perdido'].includes(l.estado)).length;
  const nVendidas = allLeads.filter((l) => l.estado === 'Vendido').length;

  return (
    <>
      <header>
        <h1>Minha Área</h1>
        <Link href="/leads/nova" className="btn">+ Nova lead</Link>
      </header>

      <div className="grid cols-4">
        <div className="card stat">
          <div className="num">{nDisponivel}</div>
          <div className="lbl">Carros disponíveis</div>
        </div>
        <div className="card stat">
          <div className="num">{nAtivas}</div>
          <div className="lbl">Leads ativas</div>
        </div>
        <div className="card stat">
          <div className="num">{followups.length}</div>
          <div className="lbl">Follow-ups para hoje</div>
        </div>
        <div className="card stat">
          <div className="num">{nVendidas}</div>
          <div className="lbl">Vendas (leads)</div>
        </div>
      </div>

      <h2 className="section-title">Follow-ups em atraso ou para hoje</h2>
      <div className="card">
        {followups.length === 0 && <p className="empty">Tudo em dia. 🚗</p>}
        {followups.length > 0 && (
          <table className="tbl">
            <thead>
              <tr><th>Lead</th><th>Carro</th><th>Estado</th><th>Follow-up</th><th>Tentativas</th></tr>
            </thead>
            <tbody>
              {followups.map((l) => (
                <tr key={l.id}>
                  <td data-l="Lead"><Link href={`/leads/${l.id}`}><b>{l.nome || '(sem nome)'}</b></Link></td>
                  <td data-l="Carro">{l.carro_interesse || '—'}</td>
                  <td data-l="Estado"><span className={`badge ${l.estado}`}>{l.estado}</span></td>
                  <td data-l="Follow-up">
                    <span className={l.follow_up < hoje() ? 'followup-late' : ''}>{fmtDate(l.follow_up)}</span>
                  </td>
                  <td data-l="Tentativas">{l.tentativas}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <h2 className="section-title">As minhas tarefas</h2>
      <div className="card">
        {tasks.length === 0 && <p className="empty">Sem tarefas abertas.</p>}
        {tasks.map((t) => (
          <TaskCheck key={t.id} task={t} />
        ))}
      </div>
    </>
  );
}
