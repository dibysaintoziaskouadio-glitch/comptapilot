/**
 * Logos : Comptapilot (l'application, public/brand/comptapilot.svg) et Vision Technologie, son éditeur
 * (tracé vectoriel fidèle à public/brand/vision-technologie.png).
 */
import { useId } from 'react';
import { cn } from '@/lib/utils';

export const MARQUE = { societe: 'Vision Technologie', nuit: '#0f172a', turquoise: '#14b8a6' } as const;

/** Le V seul : blanc par défaut (ou `currentColor`), point turquoise. */
function TraceV({ couleur = '#ffffff' }: { couleur?: string }) {
  return (
    <>
      <circle cx="600" cy="323" r="48" fill={MARQUE.turquoise} />
      <g fill={couleur}>
        <path d="M278 315H452L561 546L378 567Z" />
        <path d="M748 315H921L842 515L643 537Z" />
        <path d="M396 608L581 587L600 627L620 582L823 560L678 924H522Z" />
      </g>
    </>
  );
}

/** Pastille carrée bleu nuit (usage principal : barre latérale, écran de connexion). */
export function LogoVision({ className, titre = MARQUE.societe }: { className?: string; titre?: string }) {
  return (
    <svg viewBox="0 0 1200 1200" role="img" aria-label={titre} className={cn('shrink-0 rounded-xl', className)}>
      <rect width="1200" height="1200" fill={MARQUE.nuit} />
      <TraceV />
    </svg>
  );
}

/** Le V sans fond, pour un usage sur une surface déjà sombre ou en filigrane. */
export function MonogrammeVision({ className, couleur = 'currentColor' }: { className?: string; couleur?: string }) {
  return (
    <svg viewBox="250 250 700 700" aria-hidden className={cn('shrink-0', className)}>
      <TraceV couleur={couleur} />
    </svg>
  );
}

/**
 * Logo de Comptapilot : barres de comptabilité et avion en papier sur fond bleu nuit → turquoise.
 * Même dessin que public/brand/comptapilot.svg ; identifiants de dégradés uniques par instance.
 */
export function LogoComptapilot({ className, titre = 'Comptapilot' }: { className?: string; titre?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 1024 1024" role="img" aria-label={titre} className={cn('shrink-0 rounded-xl', className)}>
      <defs>
        <linearGradient id={`${id}f`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#0B2A5B" />
          <stop offset="1" stopColor="#0E7C86" />
        </linearGradient>
        <linearGradient id={`${id}b`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0" stopColor="#FFFFFF" stopOpacity="0.55" />
          <stop offset="1" stopColor="#FFFFFF" />
        </linearGradient>
        <linearGradient id={`${id}a`} x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#FFB547" />
          <stop offset="1" stopColor="#FFD978" />
        </linearGradient>
      </defs>
      <rect width="1024" height="1024" rx="228" fill={`url(#${id}f)`} />
      <path d="M 742 300 A 300 300 0 1 0 742 724" fill="none" stroke="#FFFFFF" strokeOpacity="0.18" strokeWidth="56" strokeLinecap="round" />
      <rect x="318" y="560" width="92" height="170" rx="22" fill={`url(#${id}b)`} />
      <rect x="456" y="470" width="92" height="260" rx="22" fill={`url(#${id}b)`} />
      <rect x="594" y="380" width="92" height="350" rx="22" fill={`url(#${id}b)`} />
      <path d="M 300 520 Q 470 470 560 360 T 700 250" fill="none" stroke="#FFD978" strokeWidth="18" strokeLinecap="round" strokeDasharray="2 34" />
      <g transform="translate(724 238) rotate(-35)">
        <path d="M 90 0 L -70 -62 L -30 0 L -70 62 Z" fill={`url(#${id}a)`} />
        <path d="M 90 0 L -30 0 L -70 62 Z" fill="#E8932A" />
      </g>
    </svg>
  );
}
