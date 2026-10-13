/**
 * Logo de Vision Technologie, éditeur de Comptapilot.
 * Tracé vectoriel fidèle à public/brand/vision-technologie.png (même géométrie, mêmes couleurs).
 */
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
