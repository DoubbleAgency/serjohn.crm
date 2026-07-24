import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import LeadsKanban from '@/app/components/LeadsKanban';

export const dynamic = 'force-dynamic';

export default async function LeadsPage() {
  const supabase = createClient();
  const { data: leads } = await supabase
    .from('leads')
    .select('id, nome, telefone, carro_interesse, estado, follow_up, tentativas, origem, valor_proposta, created_at')
    .order('created_at', { ascending: false })
    .limit(400);

  return (
    <>
      <header>
        <h1>Leads</h1>
        <Link href="/leads/nova" className="btn">+ Nova lead</Link>
      </header>
      <LeadsKanban initialLeads={leads || []} />
    </>
  );
}
