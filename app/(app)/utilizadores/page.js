import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fmtDate } from '@/lib/format';

export const dynamic = 'force-dynamic';

export default async function UtilizadoresPage() {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const { data: me } = await supabase
    .from('app_users')
    .select('papel')
    .eq('id', session.user.id)
    .single();

  if (me?.papel !== 'admin') redirect('/');

  const { data: users } = await supabase
    .from('app_users')
    .select('*')
    .order('created_at', { ascending: true });

  return (
    <>
      <header>
        <h1>Utilizadores</h1>
      </header>
      <div className="card">
        <table className="tbl">
          <thead>
            <tr><th>Nome</th><th>Papel</th><th>Ativo</th><th>Desde</th></tr>
          </thead>
          <tbody>
            {(users || []).map((u) => (
              <tr key={u.id}>
                <td data-l="Nome"><b>{u.nome || '—'}</b></td>
                <td data-l="Papel"><span className="badge">{u.papel}</span></td>
                <td data-l="Ativo">{u.ativo ? 'Sim' : 'Não'}</td>
                <td data-l="Desde">{fmtDate(u.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="empty" style={{ maxWidth: 640 }}>
        Para adicionar um utilizador novo: cria-o em Supabase → Authentication → Add user
        (email + palavra-passe) e depois pede ao Claude para o ativar com o papel certo —
        ou faz-lo diretamente na tabela app_users. Os papéis são: admin, vendedor, stock.
      </p>
    </>
  );
}
