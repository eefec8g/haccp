'use client';

import { useEffect, useRef, useState } from 'react';

interface FadeInSectionProps {
  readonly children: React.ReactNode;
  /** Delai en ms avant le declenchement de la transition (stagger). */
  readonly delay?: number;
  readonly className?: string;
}

/** Seuil de visibilite IntersectionObserver : 15% visible declenche l'animation. */
const VISIBILITY_THRESHOLD = 0.15;

/**
 * Wrapper d'animation "fade-in + translate-y" subtil au scroll.
 *
 * Utilise IntersectionObserver natif (aucune dependance externe) pour
 * declencher une transition opacity 0 -> 100 et translate-y 16px -> 0
 * lorsque l'element entre dans le viewport (15% visible). Animation
 * jouee une seule fois.
 *
 * Respecte prefers-reduced-motion : pour les utilisateurs ayant active
 * cette preference, l'enfant est rendu immediatement visible sans
 * transition.
 *
 * Client Component minimal (uniquement pour observer + state). Children
 * peuvent etre Server Components (pattern RSC compose dans Client).
 */
export function FadeInSection({
  children,
  delay = 0,
  className,
}: FadeInSectionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mediaQuery.matches) {
      setReducedMotion(true);
      setIsVisible(true);
      return;
    }

    const node = ref.current;
    if (!node) {
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: VISIBILITY_THRESHOLD }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const shouldAnimate = !reducedMotion;
  const baseClasses = shouldAnimate
    ? 'transition-all duration-700 ease-out'
    : '';
  const stateClasses = isVisible
    ? 'opacity-100 translate-y-0'
    : 'opacity-0 translate-y-4';
  const composedClassName = [baseClasses, stateClasses, className]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      ref={ref}
      className={composedClassName}
      style={
        shouldAnimate && delay > 0
          ? { transitionDelay: `${delay}ms` }
          : undefined
      }
    >
      {children}
    </div>
  );
}
