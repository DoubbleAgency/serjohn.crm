import { createClient } from '@/lib/supabase/server';
import TaskCheck from '@/app/components/TaskCheck';

export const dynamic = 'force-dynamic';

const DEPTOS = ['Vendas', 'Documentação', 'Preparação', null];

export default async function TarefasPage() {
  const supabase = createClient();
  const { data: tasks } = await supabase
    .from('tasks')
    .select('*')
    .order('estado', { ascending: true })
    .order('prazo', { ascending: true, nullsFirst: false })
    .limit(300);

  const abertas = (tasks || []).filter((t) => t.estado === 'Aberta');
  const feitas = (tasks || []).filter((t) => t.estado === 'Feita').slice(0, 20);

  return (
    <>
      <header>
        <h1>Tarefas ({abertas.length} abertas)</h1>
      </header>

      {DEPTOS.map((dep) => {
        const doDep = abertas.filter((t) => (dep ? t.departamento === dep : !t.departamento));
        if (doDep.length === 0) return null;
        return (
          <div key={dep || 'outras'}>
            <h2 className="section-title">{dep || 'Sem departamento'}</h2>
            <div className="card">
              {doDep.map((t) => (
                <TaskCheck key={t.id} task={t} />
              ))}
            </div>
          </div>
        );
      })}
      {abertas.length === 0 && (
        <div className="card"><p className="empty">Sem tarefas abertas. 🎉</p></div>
      )}

      {feitas.length > 0 && (
        <>
          <h2 className="section-title">Concluídas recentemente</h2>
          <div className="card">
            {feitas.map((t) => (
              <TaskCheck key={t.id} task={t} />
            ))}
          </div>
        </>
      )}
    </>
  );
}
