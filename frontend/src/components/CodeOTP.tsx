/**
 * Saisie d'un code à 6 chiffres en cases séparées : avance automatique, retour arrière,
 * collage du code complet et remplissage automatique du code reçu par SMS (autocomplete="one-time-code").
 */
import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

export function CodeOTP({
  valeur,
  onChange,
  onComplet,
  desactive,
  invalide,
  libelle,
  autoFocus,
}: {
  valeur: string;
  onChange: (v: string) => void;
  onComplet?: (v: string) => void;
  desactive?: boolean;
  invalide?: boolean;
  libelle: string;
  autoFocus?: boolean;
}) {
  const cases = useRef<(HTMLInputElement | null)[]>([]);
  const chiffres = valeur.padEnd(6, ' ').slice(0, 6).split('');

  useEffect(() => {
    if (autoFocus) cases.current[0]?.focus();
  }, [autoFocus]);

  const fixer = (v: string, focus?: number) => {
    const propre = v.replace(/\D/g, '').slice(0, 6);
    onChange(propre);
    if (focus !== undefined) cases.current[Math.min(focus, 5)]?.focus();
    if (propre.length === 6) onComplet?.(propre);
  };

  return (
    <div className="flex justify-between gap-1.5 sm:gap-2" role="group" aria-label={libelle}>
      {chiffres.map((c, i) => (
        <input
          key={i}
          ref={(el) => (cases.current[i] = el)}
          value={c.trim()}
          disabled={desactive}
          inputMode="numeric"
          autoComplete={i === 0 ? 'one-time-code' : 'off'}
          aria-label={`${libelle} — ${i + 1}/6`}
          maxLength={6}
          onFocus={(e) => e.target.select()}
          onChange={(e) => {
            const saisi = e.target.value.replace(/\D/g, '');
            if (!saisi) return;
            // Collage ou remplissage automatique : plusieurs chiffres d'un coup.
            if (saisi.length > 1) return fixer(valeur.slice(0, i) + saisi, i + saisi.length);
            const t = chiffres.slice();
            t[i] = saisi;
            fixer(t.join('').replace(/ /g, ''), i + 1);
          }}
          onKeyDown={(e) => {
            if (e.key === 'Backspace') {
              e.preventDefault();
              const t = chiffres.slice();
              const j = t[i].trim() ? i : Math.max(0, i - 1);
              t[j] = ' ';
              onChange(t.join('').trimEnd().replace(/ /g, ''));
              cases.current[j]?.focus();
            } else if (e.key === 'ArrowLeft') cases.current[Math.max(0, i - 1)]?.focus();
            else if (e.key === 'ArrowRight') cases.current[Math.min(5, i + 1)]?.focus();
          }}
          onPaste={(e) => {
            e.preventDefault();
            fixer(e.clipboardData.getData('text'), 5);
          }}
          className={cn(
            'h-12 w-full min-w-0 rounded-xl border bg-white/[.06] text-center font-display text-xl font-semibold text-white transition-all focus:outline-none disabled:opacity-50',
            invalide ? 'border-[#fb7185]/70' : c.trim() ? 'border-[#a855f7]/70 bg-white/[.09]' : 'border-white/15',
            'focus:border-[#a855f7] focus:shadow-[0_0_0_4px_rgb(168_85_247/.22)]',
          )}
        />
      ))}
    </div>
  );
}
