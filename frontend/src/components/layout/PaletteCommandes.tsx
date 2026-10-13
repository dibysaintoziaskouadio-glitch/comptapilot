import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { CornerDownLeft, Search } from 'lucide-react';
import { useCatalogue } from '@/hooks/useDonnees';
import { apparence, pastille } from '@/lib/moteurs';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';

const normaliser = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

export function PaletteCommandes({ ouvert, onFermer }: { ouvert: boolean; onFermer: () => void }) {
  const { moteurs } = useCatalogue();
  const { t, nomMoteur } = useT();
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const nav = useNavigate();
  const champ = useRef<HTMLInputElement>(null);
  const liste = useRef<HTMLDivElement>(null);

  const index = useMemo(
    () =>
      moteurs.flatMap((m) =>
        m.formules.map((f) => ({ f, m, texte: normaliser([f.nom, f.description, f.categorie, m.nom, nomMoteur(m), f.id, ...f.motsCles, ...f.references.map((r) => r.texte)].join(' ')) })),
      ),
    [moteurs, nomMoteur],
  );
  const resultats = useMemo(() => {
    const mots = normaliser(q).split(/\s+/).filter(Boolean);
    if (!mots.length) return index.slice(0, 12);
    return index
      .map((x) => ({ ...x, score: mots.reduce((s, w) => (x.texte.includes(w) ? s + (normaliser(x.f.nom).includes(w) ? 3 : 1) : -100), 0) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 30);
  }, [q, index]);

  useEffect(() => {
    if (ouvert) {
      setQ('');
      setSel(0);
      setTimeout(() => champ.current?.focus(), 10);
    }
  }, [ouvert]);
  useEffect(() => setSel(0), [q]);
  useEffect(() => {
    liste.current?.querySelector(`[data-index="${sel}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [sel]);

  if (!ouvert) return null;
  const aller = (i: number) => {
    const r = resultats[i];
    if (!r) return;
    nav(`/calcul/${r.m.code}/${r.f.id}`);
    onFermer();
  };
  return createPortal(
    <div className="fixed inset-0 z-50 bg-[hsl(232_40%_5%/.45)] p-4 pt-[12vh] backdrop-blur-sm animate-in fade-in" onMouseDown={onFermer}>
      <div className="carte carte-pleine mx-auto max-w-2xl overflow-hidden shadow-flottant animate-entree" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 border-b border-bordure px-4">
          <Search className="size-5 text-attenue" />
          <input
            ref={champ}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') (e.preventDefault(), setSel((s) => Math.min(s + 1, resultats.length - 1)));
              if (e.key === 'ArrowUp') (e.preventDefault(), setSel((s) => Math.max(s - 1, 0)));
              if (e.key === 'Enter') aller(sel);
              if (e.key === 'Escape') onFermer();
            }}
            placeholder={t('palette.placeholder')}
            className="h-14 flex-1 bg-transparent text-[15px] outline-none placeholder:text-attenue"
          />
          <kbd className="rounded-md border border-bordure px-1.5 py-0.5 text-[11px] text-attenue">{t('palette.echap')}</kbd>
        </div>
        <div ref={liste} className="max-h-[55vh] overflow-y-auto p-2 barre-defilement">
          {resultats.length === 0 && <p className="px-3 py-10 text-center text-sm text-attenue">{t('palette.aucune', { q })}</p>}
          {resultats.map(({ f, m }, i) => {
            const a = apparence(m.code);
            return (
              <button
                key={`${m.code}/${f.id}`}
                data-index={i}
                onMouseEnter={() => setSel(i)}
                onClick={() => aller(i)}
                className={cn('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left', sel === i ? 'bg-surface-2' : '')}
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg" style={pastille(a.teinte)}>
                  <a.icone className="size-4" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{f.nom}</span>
                  <span className="block truncate text-xs text-attenue">
                    {nomMoteur(m)} · {f.categorie}
                  </span>
                </span>
                {sel === i && <CornerDownLeft className="size-4 text-attenue" />}
              </button>
            );
          })}
        </div>
        <div className="flex items-center justify-between border-t border-bordure px-4 py-2 text-[11px] text-attenue">
          <span>{t('palette.indexees', { n: index.length })}</span>
          <span>{t('palette.aide')}</span>
        </div>
      </div>
    </div>,
    document.body,
  );
}
