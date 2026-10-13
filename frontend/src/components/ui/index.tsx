import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes, type InputHTMLAttributes, type ReactNode, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

type Variante = 'primaire' | 'secondaire' | 'fantome' | 'danger';
const VARIANTES: Record<Variante, string> = {
  primaire: 'degrade-bouton text-white shadow-[0_8px_24px_-8px_hsl(var(--magenta)/.65)] hover:shadow-[0_10px_30px_-8px_hsl(var(--magenta)/.8)]',
  secondaire: 'bg-surface border border-bordure hover:bg-surface-2 text-texte',
  fantome: 'hover:bg-surface-2 text-attenue hover:text-texte',
  danger: 'bg-danger/10 text-danger hover:bg-danger/15',
};

export const Bouton = forwardRef<HTMLButtonElement, ButtonHTMLAttributes<HTMLButtonElement> & { variante?: Variante; taille?: 'sm' | 'md'; chargement?: boolean }>(
  ({ className, variante = 'secondaire', taille = 'md', chargement, children, disabled, ...p }, ref) => (
    <button
      ref={ref}
      disabled={disabled || chargement}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all active:scale-[.98] disabled:opacity-50 disabled:pointer-events-none whitespace-nowrap',
        taille === 'sm' ? 'h-8 px-3 text-[13px]' : 'h-10 px-4 text-sm',
        VARIANTES[variante],
        className,
      )}
      {...p}
    >
      {chargement && <Loader2 className="size-4 animate-spin" />}
      {children}
    </button>
  ),
);

export const Carte = ({ className, ...p }: HTMLAttributes<HTMLDivElement>) => <div className={cn('carte', className)} {...p} />;

export const Champ = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { suffixe?: string; invalide?: boolean }>(({ className, suffixe, invalide, ...p }, ref) => (
  <div className="relative">
    <input
      ref={ref}
      className={cn(
        'h-10 w-full rounded-xl border bg-surface px-3 text-sm text-texte placeholder:text-attenue/70 transition-colors focus:outline-none focus:ring-4',
        invalide ? 'border-danger focus:ring-danger/15' : 'border-bordure focus:border-accent focus:ring-accent/15',
        suffixe && 'pr-10',
        className,
      )}
      {...p}
    />
    {suffixe && <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs text-attenue">{suffixe}</span>}
  </div>
));

export function Badge({ children, ton = 'neutre', className }: { children: ReactNode; ton?: 'neutre' | 'succes' | 'alerte' | 'danger' | 'info' | 'accent'; className?: string }) {
  const tons = {
    neutre: 'bg-surface-2 text-attenue',
    succes: 'bg-succes/12 text-succes',
    alerte: 'bg-alerte/12 text-alerte',
    danger: 'bg-danger/12 text-danger',
    info: 'bg-info/12 text-info',
    accent: 'bg-accent-doux text-accent-texte',
  };
  return <span className={cn('inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold', tons[ton], className)}>{children}</span>;
}

export function Interrupteur({ actif, onChange, libelle }: { actif: boolean; onChange: (v: boolean) => void; libelle?: string }) {
  return (
    <button type="button" role="switch" aria-checked={actif} aria-label={libelle} onClick={() => onChange(!actif)} className={cn('relative h-6 w-11 shrink-0 rounded-full transition-colors', actif ? 'bg-accent' : 'bg-bordure')}>
      <span className={cn('absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform', actif && 'translate-x-5')} />
    </button>
  );
}

export function Squelette({ className }: { className?: string }) {
  return <div className={cn('animate-pulsation rounded-xl bg-surface-2', className)} />;
}

export function Onglets<T extends string>({ valeur, onChange, onglets }: { valeur: T; onChange: (v: T) => void; onglets: { id: T; libelle: ReactNode; compte?: number }[] }) {
  return (
    <div role="tablist" className="flex flex-wrap gap-1 rounded-xl bg-surface-2 p-1">
      {onglets.map((o) => (
        <button
          key={o.id}
          role="tab"
          aria-selected={valeur === o.id}
          onClick={() => onChange(o.id)}
          className={cn('flex shrink-0 items-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-all', valeur === o.id ? 'bg-surface text-texte shadow-carte' : 'text-attenue hover:text-texte')}
        >
          {o.libelle}
          {o.compte !== undefined && o.compte > 0 && <span className="rounded-full bg-accent-doux px-1.5 text-[10px] font-bold text-accent-texte">{o.compte}</span>}
        </button>
      ))}
    </div>
  );
}

export function Dialogue({ ouvert, onFermer, titre, children, large, libelleFermer = 'Fermer' }: { ouvert: boolean; onFermer: () => void; titre: ReactNode; children: ReactNode; large?: boolean; libelleFermer?: string }) {
  useEffect(() => {
    if (!ouvert) return;
    const f = (e: KeyboardEvent) => e.key === 'Escape' && onFermer();
    window.addEventListener('keydown', f);
    return () => window.removeEventListener('keydown', f);
  }, [ouvert, onFermer]);
  if (!ouvert) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[hsl(232_40%_5%/.45)] p-4 pt-[10vh] backdrop-blur-sm animate-in fade-in" onMouseDown={onFermer}>
      <div role="dialog" aria-modal className={cn('carte w-full animate-apparition shadow-flottant', large ? 'max-w-3xl' : 'max-w-lg')} onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-bordure px-5 py-4">
          <h2 className="font-semibold">{titre}</h2>
          <button onClick={onFermer} className="rounded-lg p-1 text-attenue hover:bg-surface-2" aria-label={libelleFermer}>
            <X className="size-4" />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>,
    document.body,
  );
}

export function Vide({ icone, titre, texte, action }: { icone: ReactNode; titre: string; texte?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <div className="grid size-12 place-items-center rounded-2xl bg-accent-doux text-accent-texte">{icone}</div>
      <div>
        <p className="font-semibold">{titre}</p>
        {texte && <p className="mt-1 max-w-sm text-sm text-attenue">{texte}</p>}
      </div>
      {action}
    </div>
  );
}
