import { headers } from 'next/headers';
import { bookmarkletHref } from '@/lib/bookmarklet';
import ImportAnuncio from '@/app/components/ImportAnuncio';
import BookmarkletLink from '@/app/components/BookmarkletLink';

export const dynamic = 'force-dynamic';

export default function ImportarPage() {
  const h = headers();
  const host = h.get('x-forwarded-host') || h.get('host') || 'crm.serjohn.pt';
  const proto = host.startsWith('localhost') ? 'http' : 'https';
  const origin = `${proto}://${host}`;
  const href = bookmarkletHref(origin);

  return (
    <>
      <header>
        <h1>Importar anúncio</h1>
      </header>

      <div className="card">
        <h2 style={{ fontSize: 16, marginBottom: 8 }}>1. Marcador “Enviar para o Serjohn”</h2>
        <p className="hint" style={{ marginBottom: 12 }}>
          Arraste o botão abaixo para a barra de favoritos do browser (uma vez só). Depois, sempre que
          estiver num anúncio do mobile.de, carregue nele: o anúncio é lido e a lead fica criada com
          fotos, preço, ano, quilómetros e descrição — pronta para gerar o PDF.
        </p>
        <BookmarkletLink href={href}>⬇︎ Enviar para o Serjohn</BookmarkletLink>
        <p className="hint" style={{ marginTop: 12 }}>
          Se a barra de favoritos não estiver visível: <strong>⌘⇧B</strong> (Mac) ou{' '}
          <strong>Ctrl+Shift+B</strong> (Windows).
        </p>
      </div>

      <div style={{ marginTop: 16 }}>
        <ImportAnuncio />
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 16, marginBottom: 8 }}>Porque há duas maneiras?</h2>
        <p className="hint">
          O mobile.de recusa pedidos feitos por servidores, por isso colar o link nem sempre resulta.
          O marcador funciona sempre porque lê a página a partir do seu próprio browser — e não precisa
          de instalar nada nem de guardar palavras-passe: a gravação usa a sessão que já tem aberta aqui.
        </p>
      </div>
    </>
  );
}
