'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

export default function TaskCheck({ task }) {
  const [done, setDone] = useState(task.estado === 'Feita');
  const router = useRouter();

  async function toggle() {
    const supabase = createClient();
    const novo = done ? 'Aberta' : 'Feita';
    setDone(!done);
    const { error } = await supabase.from('tasks').update({ estado: novo }).eq('id', task.id);
    if (error) setDone(done);
    else router.refresh();
  }

  const meta = [
    task.departamento,
    task.prazo ? `prazo ${new Date(task.prazo).toLocaleDateString('pt-PT')}` : null,
    task.prioridade !== 'Normal' ? task.prioridade : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <div className={`task-row ${done ? 'done' : ''}`}>
      <input type="checkbox" checked={done} onChange={toggle} />
      <div>
        <div className="tt">
          {task.lead_id ? <Link href={`/leads/${task.lead_id}`}>{task.titulo}</Link> : task.titulo}
        </div>
        {(meta || task.descricao) && (
          <div className="tm">{[task.descricao, meta].filter(Boolean).join(' — ')}</div>
        )}
      </div>
    </div>
  );
}
