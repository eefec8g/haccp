import Link from 'next/link';
import type { Route } from 'next';
import type { ReactNode } from 'react';

/**
 * Bouton-lien primaire partage par les pages admin :
 * "+ Nouvelle boutique", "+ Nouvel equipement", "+ Inviter un utilisateur".
 *
 * Charte Maison Givre : fond noir profond, texte ivoire en capitales
 * tres espacees, hover or (inversion du contraste). Reste un Server
 * Component : `<Link>` Next.js supporte le rendu serveur natif.
 *
 * Factorise la classe Tailwind dupliquee dans toutes les pages listing
 * (DRY, Clean Code #4).
 */
interface PrimaryLinkButtonProps {
  readonly href: Route;
  readonly children: ReactNode;
  readonly 'data-testid'?: string;
}

const PRIMARY_LINK_CLASSES =
  'inline-flex h-10 items-center justify-center bg-mg-noir px-5 text-[10px] font-medium uppercase tracking-[0.25em] text-mg-ivoire transition-colors hover:bg-mg-or hover:text-mg-noir focus:outline-none focus:ring-1 focus:ring-mg-or focus:ring-offset-2 focus:ring-offset-mg-ivoire';

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
