import Link from 'next/link';
import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import CarForm from '@/app/components/CarForm';

export const dynamic = 'force-dynamic';

export default async function EditarCarroPage({ params }) {
  const supabase = createClient();
  const { data: car } = await supabase.from('cars').select('*').eq('id', params.id).single();
  if (!car) notFound();

  return (
    <>
      <header>
        <h1>{[car.marca, car.modelo].filter(Boolean).join(' ') || 'Carro'}</h1>
        <span className={`badge ${car.estado}`}>{car.estado}</span>
      </header>
      <CarForm car={car} />
      <p style={{ marginTop: 20 }}>
        <Link href="/stock" className="btn secondary small">← Voltar ao stock</Link>
      </p>
    </>
  );
}
