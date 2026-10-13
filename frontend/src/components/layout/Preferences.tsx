/** Choix de la langue de l'interface et de la monnaie d'affichage. */
import { useEffect, useRef, useState } from 'react';
import { Check, Globe, Info } from 'lucide-react';
import { toast } from 'sonner';
import { LANGUES, traduire, useT, type Langue } from '@/lib/i18n';
import { DEVISES } from '@/lib/devises';
import { montant, symboleDevise } from '@/lib/format';
import { cn } from '@/lib/utils';

export function MenuPreferences() {
  const { t, langue, devise, changer, erreur } = useT();
  const [ouvert, setOuvert] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ouvert) return;
    const clic = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOuvert(false);
    const touche = (e: KeyboardEvent) => e.key === 'Escape' && setOuvert(false);
    document.addEventListener('mousedown', clic);
    document.addEventListener('keydown', touche);
    return () => {
      document.removeEventListener('mousedown', clic);
      document.removeEventListener('keydown', touche);
    };
  }, [ouvert]);

  const appliquer = (p: { langue?: Langue; devise?: string }) =>
    changer(p)
      .then(() => toast.success(traduire(p.langue ?? langue, 'prefs.enregistrees')))
      .catch((e) => toast.error(erreur(e)));

  const d = DEVISES.find((x) => x.code === devise);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOuvert((o) => !o)}
        className={cn('carte flex h-12 items-center gap-1.5 rounded-2xl px-3.5 text-[13px] font-semibold text-attenue transition-all duration-300 hover:border-accent/40 hover:text-texte', ouvert && 'text-texte ring-1 ring-accent/40')}
        aria-label={t('prefs.titre')}
        aria-expanded={ouvert}
        title={t('prefs.titre')}
      >
        <Globe className="size-[18px]" />
        <span className="hidden sm:inline">
          {langue.toUpperCase()} · {symboleDevise()}
        </span>
      </button>

      {ouvert && (
        <div className="absolute right-0 top-14 z-40 w-[min(92vw,340px)] carte carte-pleine p-4 shadow-flottant animate-in fade-in slide-in-from-top-1" role="dialog" aria-label={t('prefs.titre')}>
          <p className="font-display text-[15px] font-semibold">{t('prefs.titre')}</p>

          <p className="mb-1.5 mt-4 text-[11px] font-semibold uppercase tracking-wider text-attenue">{t('prefs.langue')}</p>
          <div className="grid grid-cols-2 gap-1 rounded-xl bg-surface-2 p-1">
            {LANGUES.map((l) => (
              <button
                key={l.code}
                onClick={() => l.code !== langue && appliquer({ langue: l.code })}
                className={cn('flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-[13px] font-medium transition-all', langue === l.code ? 'bg-surface text-texte shadow-carte' : 'text-attenue hover:text-texte')}
                aria-pressed={langue === l.code}
                lang={l.code}
              >
                {langue === l.code && <Check className="size-3.5 text-accent-texte" />}
                {l.nom}
              </button>
            ))}
          </div>

          <label className="mb-1.5 mt-4 block text-[11px] font-semibold uppercase tracking-wider text-attenue" htmlFor="pref-devise">
            {t('prefs.devise')}
          </label>
          <select id="pref-devise" value={devise} onChange={(e) => appliquer({ devise: e.target.value })} className="h-10 w-full rounded-xl border border-bordure bg-surface px-3 text-sm focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15">
            {DEVISES.map((x) => (
              <option key={x.code} value={x.code}>
                {x.code} — {x.nom[langue]}
              </option>
            ))}
          </select>
          {d && <p className="mt-1.5 text-[11.5px] leading-snug text-attenue">{d.region[langue]}</p>}
          <p className="mt-2 rounded-lg bg-accent-doux px-2.5 py-1.5 text-[12.5px] font-semibold text-accent-texte montant">{t('prefs.exemple', { montant: montant('1234567.891') })}</p>

          <div className="mt-4 space-y-2 border-t border-bordure pt-3 text-[11.5px] leading-snug text-attenue">
            <p className="flex gap-2">
              <Info className="mt-px size-3.5 shrink-0" /> {t('prefs.noteDevise')}
            </p>
            {langue !== 'fr' && (
              <p className="flex gap-2">
                <Info className="mt-px size-3.5 shrink-0" /> {t('prefs.noteLangue')}
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** Bascule FR / EN compacte, pour l'écran de connexion (toujours sombre). */
export function BasculeLangue() {
  const { langue, changer } = useT();
  return (
    <div className="flex rounded-full border border-white/15 bg-white/5 p-0.5 text-[11px] font-bold" role="group" aria-label="Langue / Language">
      {LANGUES.map((l) => (
        <button
          key={l.code}
          type="button"
          onClick={() => changer({ langue: l.code })}
          aria-pressed={langue === l.code}
          lang={l.code}
          className={cn('rounded-full px-2.5 py-1 uppercase tracking-wider transition-colors', langue === l.code ? 'bg-white text-[#1a1540]' : 'text-white/60 hover:text-white')}
          title={l.nom}
        >
          {l.code}
        </button>
      ))}
    </div>
  );
}
