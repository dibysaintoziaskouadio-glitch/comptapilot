/**
 * Ruban lumineux animé (fond de l'écran de connexion).
 * Deux rubans d'environ soixante-dix courbes sinusoïdales décalées se tordent sur eux-mêmes ;
 * le mode de fusion « lighter » produit l'effet de lumière. Dessin sur <canvas>,
 * mis en pause quand l'onglet est caché ; image fixe si l'utilisateur limite les animations.
 */
import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

const COULEURS = ['#3b6bff', '#7c3aed', '#c026d3', '#ff3cac'];
const NB_COURBES = 72;
const PAS = 6; // px entre deux points d'une courbe

export function OndeFluide({ className }: { className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const reduit = matchMedia('(prefers-reduced-motion: reduce)').matches;
    let l = 0;
    let h = 0;
    let image = 0;
    let t0 = performance.now();

    const dimensionner = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const r = canvas.getBoundingClientRect();
      l = r.width;
      h = r.height;
      canvas.width = Math.round(l * dpr);
      canvas.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    /** Un ruban : faisceau de courbes autour d'une ligne médiane ondulante, qui se tord sur lui-même. */
    const ruban = (t: number, couleurs: string[], o: { dephasage: number; ampl: number; epaisseur: number; opacite: number; cy: number }) => {
      const degrade = ctx.createLinearGradient(0, 0, l, h);
      couleurs.forEach((c, i) => degrade.addColorStop(i / (couleurs.length - 1), c));
      ctx.strokeStyle = degrade;
      const mediane = (x: number) => o.cy + Math.sin(x * 0.0042 + t * 0.55 + o.dephasage) * h * o.ampl + Math.sin(x * 0.0017 - t * 0.32) * h * o.ampl * 0.6;

      // Halo large et diffus sous le ruban
      ctx.lineWidth = Math.max(36, h * 0.14);
      ctx.globalAlpha = 0.09 * o.opacite;
      ctx.beginPath();
      for (let x = -20; x <= l + 20; x += PAS * 2) x === -20 ? ctx.moveTo(x, mediane(x)) : ctx.lineTo(x, mediane(x));
      ctx.stroke();

      ctx.lineWidth = 1.3;
      for (let i = 0; i < NB_COURBES; i++) {
        const s = i / (NB_COURBES - 1) - 0.5; // position dans l'épaisseur du ruban, de -0,5 à 0,5
        ctx.globalAlpha = (0.12 + 0.5 * (1 - Math.abs(s) * 2) ** 2) * o.opacite;
        ctx.beginPath();
        for (let x = -20; x <= l + 20; x += PAS) {
          const enveloppe = Math.sin(Math.PI * Math.min(1, Math.max(0, (x + 20) / (l + 40))));
          const torsion = Math.sin(x * 0.0055 + t * 0.8 + o.dephasage + s * 0.7);
          const y = mediane(x) + s * h * o.epaisseur * torsion * (0.3 + 0.7 * enveloppe);
          x === -20 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
        }
        ctx.stroke();
      }
    };

    const dessiner = (t: number) => {
      ctx.clearRect(0, 0, l, h);
      ctx.globalCompositeOperation = 'lighter';
      ruban(t, ['#2563eb', '#22d3ee', '#6366f1'], { dephasage: 2.1, ampl: 0.13, epaisseur: 0.42, opacite: 0.55, cy: h * 0.5 });
      ruban(t, COULEURS, { dephasage: 0, ampl: 0.17, epaisseur: 0.62, opacite: 1, cy: h * 0.44 });
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    };

    const boucle = (maintenant: number) => {
      dessiner((maintenant - t0) / 1000);
      image = requestAnimationFrame(boucle);
    };
    const visibilite = () => {
      cancelAnimationFrame(image);
      if (!document.hidden && !reduit) image = requestAnimationFrame(boucle);
    };

    const ro = new ResizeObserver(() => {
      dimensionner();
      if (reduit) dessiner(2);
    });
    ro.observe(canvas);
    dimensionner();
    t0 = performance.now() - 2000; // démarre sur une forme déjà ondulée
    if (reduit) dessiner(2);
    else image = requestAnimationFrame(boucle);
    document.addEventListener('visibilitychange', visibilite);
    return () => {
      cancelAnimationFrame(image);
      ro.disconnect();
      document.removeEventListener('visibilitychange', visibilite);
    };
  }, []);

  return <canvas ref={ref} aria-hidden className={cn('block h-full w-full', className)} />;
}
