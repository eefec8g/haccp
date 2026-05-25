import Link from 'next/link';
import type { Route } from 'next';
import type { ReactNode } from 'react';

/**
 * Bouton-lien primaire (CTA bleu plein) partage par les pages admin :
 * "+ Nouvelle boutique", "+ Nouvel equipement", "+ Inviter un utilisateur".
 *
 * Factorise la classe Tailwind dupliquee dans toutes les pages listing
 * (DRY, Clean Code #4). Reste un Server Component : `<Link>` Next.js
 * supporte le rendu serveur natif.
 */
interface PrimaryLinkButtonProps {
  readonly href: Route;
  readonly children: ReactNode;
  readonly 'data-testid'?: string;
}

const PRIMARY_LINK_CLASSES =
  'inline-flex items-center justify-center rounded-[7px] bg-[#5D87FF] px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-[#4570e6] focus:outline-none focus:ring-2 focus:ring-[#5D87FF] focus:ring-offset-2';

export function PrimaryLinkButton({
  href,
  children,
  'data-testid': dataTestid,
}: PrimaryLinkButtonProps) {
  return (
    <Link href={href} className={PRIMARY_LINK_CLASSES} data-testid={dataTestid}>
      {children}
    </Link>
  );
}
