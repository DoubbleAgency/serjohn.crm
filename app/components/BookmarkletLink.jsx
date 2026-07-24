'use client';

import { useEffect, useRef } from 'react';

/**
 * Link do marcador. O href `javascript:` é posto por setAttribute depois da
 * montagem — o React não deixa passar URLs javascript: em props.
 */
export default function BookmarkletLink({ href, children }) {
  const ref = useRef(null);

  useEffect(() => {
    if (ref.current) ref.current.setAttribute('href', href);
  }, [href]);

  return (
    <a
      ref={ref}
      className="btn"
      draggable="true"
      style={{ display: 'inline-block' }}
      onClick={(e) => {
        e.preventDefault();
        alert(
          'Não carregue aqui — arraste este botão para a barra de favoritos. Depois use-o quando estiver num anúncio do mobile.de.'
        );
      }}
    >
      {children}
    </a>
  );
}
