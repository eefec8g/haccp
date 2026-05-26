'use client';

import Image from 'next/image';
import { useEffect, useRef } from 'react';

/** Facteur de parallax : la photo se deplace a 30% du scroll utilisateur. */
const PARALLAX_FACTOR = 0.3;

/**
 * Image de fond du Hero avec effet parallax tres subtil (Client Component).
 *
 * L'image se deplace verticalement a 30% du scrollY pour creer une
 * sensation de profondeur sans m'as-tu-vu. L'animation est realisee via
 * transform: translate3d (GPU acceleration) et throttlee par
 * requestAnimationFrame (60fps).
 *
 * Respecte prefers-reduced-motion : parallax desactive si l'utilisateur
 * prefere reduire les animations.
 *
 * Isole en Client Component pour ne pas casser le SSR du contenu du Hero
 * (le wordmark MAISON GIVRE reste rendu cote serveur).
 */
export function HeroBackground() {
  const imageWrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (mediaQuery.matches) {
      return;
    }

    let animationFrameId: number | null = null;

    const updateParallax = () => {
      const node = imageWrapperRef.current;
      if (!node) {
        return;
      }
      const offset = window.scrollY * PARALLAX_FACTOR;
      node.style.transform = `translate3d(0, ${offset}px, 0)`;
      animationFrameId = null;
    };

    const onScroll = () => {
      if (animationFrameId === null) {
        animationFrameId = window.requestAnimationFrame(updateParallax);
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (animationFrameId !== null) {
        window.cancelAnimationFrame(animationFrameId);
      }
    };
  }, []);

  return (
    <div
      ref={imageWrapperRef}
      aria-hidden="true"
      className="absolute inset-0 z-0 will-change-transform"
    >
      <Image
        src="/illustrations/boutique-interieur.jpg"
        alt="Interieur de la boutique Maison Givre"
        fill
        priority
        quality={85}
        sizes="100vw"
        className="object-cover object-center"
        style={{ filter: 'grayscale(20%) brightness(0.55)' }}
      />
    </div>
  );
}
