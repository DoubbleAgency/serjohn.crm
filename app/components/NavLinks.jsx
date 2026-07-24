'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const LINKS = [
  { href: '/', label: 'Minha Área' },
  { href: '/leads', label: 'Leads' },
  { href: '/stock', label: 'Stock' },
  { href: '/tarefas', label: 'Tarefas' },
];

export default function NavLinks({ isAdmin }) {
  const pathname = usePathname();
  const links = isAdmin
    ? [...LINKS, { href: '/utilizadores', label: 'Utilizadores' }]
    : LINKS;

  return (
    <>
      {links.map((l) => {
        const active =
          l.href === '/' ? pathname === '/' : pathname.startsWith(l.href);
        return (
          <Link key={l.href} href={l.href} className={`nav-item ${active ? 'active' : ''}`}>
            <span className="ini">{l.label[0]}</span>
            <span className="txt">{l.label}</span>
          </Link>
        );
      })}
    </>
  );
}
