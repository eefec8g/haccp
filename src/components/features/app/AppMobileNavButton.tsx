'use client';

import { useCallback, useId, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import type { UserRole } from '@prisma/client';
import { BurgerIcon } from '@/components/ui/icons/MenuIcons';

interface AppMobileNavButtonProps {
  readonly viewerRole: UserRole;
}

/**
 * Drawer importe en dynamic + ssr:false :
 *   - Il n'est rendu que lorsque l'utilisateur clique sur le FAB mobile,
 *     donc sortir ses lignes (LogoutButton, getAppNavGroupsForRole,
 *     useFocusTrap) du chunk partage du layout `(app)` reduit le JS
 *     servi a chaque page authentifiee (~2-3 kB gzipped).
 *   - `ssr: false` est sain ici : le drawer n'est jamais visible cote
 *     serveur (visibilite controlee par `isOpen` qui demarre a false) et
 *     ses interactions (focus trap, scroll lock) sont strictement
 *     client.
 */
const AppMobileNavDrawer = dynamic(
  () =>
    import('./AppMobileNavDrawer').then((mod) => ({
      default: mod.AppMobileNavDrawer,
    })),
  { ssr: false }
);

/**
 * FAB (Floating Action Button) burger mobile-only (Client Component,
 * Epic RESPONSIVE).
 *
 * Pourquoi un FAB et pas un header global ?
 *   - Le finding initial dit : "il n'y a pas de layout (app)/layout.tsx :
 *     chaque page reinvente son chrome". On ne veut pas DOUBLER les
 *     headers existants (AppPageHeader, AdminHeader) -> on ajoute donc un
 *     overlay independant qui n'interfere pas avec eux.
 *   - Sur mobile uniquement (`md:hidden`) : sur desktop, les pages ont
 *     deja des liens "Retour" + leurs propres CTA et la chrome est
 *     visible. Le manque de navigation transversale est specifique au
 *     mobile.
 *   - Position `fixed bottom-6 right-6` : pouce naturel droitier, hors du
 *     flot de la page, accessible en saisie HACCP sans masquer le
 *     contenu metier. Le layout `(app)` compense via `pb-24 md:pb-0` sur
 *     le main pour eviter que le FAB ne masque "Enregistrer le releve"
 *     ou "Signer le registre" sur mobile etroit.
 *
 * a11y :
 *   - Cible tactile 56x56 (h-14 w-14) >> 44px WCAG 2.1 AA.
 *   - `aria-expanded` reflete l'etat.
 *   - `aria-controls` est conditionnel : pointe vers l'id du drawer
 *     seulement quand celui-ci est monte, jamais vers un id inexistant.
 *   - Focus visible via ring or, contraste AA sur fond noir.
 *   - Au close, on rend le focus au bouton (focus restore).
 */

const FAB_BASE_CLASSES =
  'fixed bottom-6 right-6 z-50 inline-flex h-14 w-14 items-center justify-center rounded-full bg-mg-noir text-mg-ivoire shadow-lg transition-colors hover:bg-mg-or hover:text-mg-noir focus:outline-none focus:ring-2 focus:ring-mg-or focus:ring-offset-2 focus:ring-offset-mg-ivoire md:hidden';

export function AppMobileNavButton({ viewerRole }: AppMobileNavButtonProps) {
  const [isOpen, setIsOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const drawerId = useId();
  const labelledById = `${drawerId}-title`;

  const handleClose = useCallback(() => {
    setIsOpen(false);
    // Focus restore : le bouton qui a ouvert reprend le focus apres close
    // pour respecter le contrat des dialogs WCAG (focus management).
    requestAnimationFrame(() => {
      buttonRef.current?.focus();
    });
  }, []);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setIsOpen(true)}
        aria-expanded={isOpen}
        aria-controls={isOpen ? drawerId : undefined}
        aria-label="Menu de navigation"
        className={FAB_BASE_CLASSES}
        data-testid="app-nav-button"
      >
        <BurgerIcon />
      </button>
      {isOpen ? (
        <div id={drawerId}>
          <AppMobileNavDrawer
            viewerRole={viewerRole}
            onClose={handleClose}
            labelledById={labelledById}
          />
        </div>
      ) : null}
    </>
  );
}
