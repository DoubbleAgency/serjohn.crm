import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import NavLinks from '@/app/components/NavLinks';

/**
 * Layout autenticado. O middleware já validou o utilizador com getUser();
 * aqui usamos getSession() (lê o cookie, sem rede) — não trocar para getUser().
 */
export default async function AppLayout({ children }) {
  const supabase = createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session) redirect('/login');

  const { data: me } = await supabase
    .from('app_users')
    .select('id, nome, papel, ativo')
    .eq('id', session.user.id)
    .single();

  if (!me || !me.ativo) {
    return (
      <div className="login-wrap">
        <div className="login-card">
          <h1>Sem acesso</h1>
          <p className="sub">
            Esta conta ainda não está ativa no CRM. Fale com o administrador.
          </p>
          <form action="/auth/signout" method="post">
            <button className="btn secondary">Sair</button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          Serjohn<span>CRM</span>
        </div>
        <NavLinks isAdmin={me.papel === 'admin'} />
        <div className="spacer" />
        <div className="user">
          <b>{me.nome || session.user.email}</b>
          {me.papel}
        </div>
        <form action="/auth/signout" method="post">
          <button>Sair</button>
        </form>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
