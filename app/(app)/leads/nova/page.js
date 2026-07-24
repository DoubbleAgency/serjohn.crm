import { createClient } from '@/lib/supabase/server';
import LeadForm from '@/app/components/LeadForm';

export const dynamic = 'force-dynamic';

export default async function NovaLeadPage() {
  const supabase = createClient();
  const [{ data: cars }, { data: vendedores }] = await Promise.all([
    supabase
      .from('cars')
      .select('id, marca, modelo, ano')
      .neq('estado', 'Vendido')
      .order('created_at', { ascending: false }),
    supabase.from('app_users').select('id, nome').eq('ativo', true),
  ]);

  return (
    <>
      <header>
        <h1>Nova lead</h1>
      </header>
      <LeadForm cars={cars || []} vendedores={vendedores || []} />
    </>
  );
}
