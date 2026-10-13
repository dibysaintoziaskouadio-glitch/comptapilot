/**
 * Formulaire généré automatiquement depuis la déclaration des champs d'une formule.
 * Aucun champ n'est codé en dur : ajouter une formule au moteur suffit à l'afficher.
 */
import { useMemo } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { Champ } from '@/lib/types';
import { Champ as Saisie, Interrupteur } from '@/components/ui';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';
import { texteMoteur } from '@/lib/format';

export type Valeurs = Record<string, unknown>;
export type ErreursChamps = Record<string, string>;

const aujourdhui = () => new Date().toISOString().slice(0, 10);

export function valeurInitiale(c: Champ): unknown {
  if (c.defaut !== undefined) return c.type === 'liste' && Array.isArray(c.defaut) ? (c.defaut as string[]).join(' ; ') : c.defaut;
  switch (c.type) {
    case 'date':
      return c.optionnel ? '' : aujourdhui();
    case 'booleen':
      return false;
    case 'table':
      return [ligneVide(c)];
    default:
      return '';
  }
}

const ligneVide = (c: Champ) => Object.fromEntries((c.colonnes ?? []).map((col) => [col.nom, col.defaut ?? (col.type === 'booleen' ? false : '')]));

export function valeursInitiales(champs: Champ[]): Valeurs {
  return Object.fromEntries(champs.map((c) => [c.nom, valeurInitiale(c)]));
}

export function estVisible(c: Champ, v: Valeurs): boolean {
  if (!c.visibleSi) return true;
  return c.visibleSi.valeurs.some((x) => String(x) === String(v[c.visibleSi!.champ]));
}

function Libelle({ champ, erreur }: { champ: Champ; erreur?: string }) {
  const { t } = useT();
  return (
    <div className="mb-1.5 flex items-baseline justify-between gap-2">
      <label htmlFor={`champ-${champ.nom}`} className="text-[13px] font-medium text-texte">
        {texteMoteur(champ.libelle)}
        {champ.optionnel && <span className="ml-1 font-normal text-attenue">{t('form.facultatif')}</span>}
      </label>
      {erreur && <span className="text-[11.5px] font-medium text-danger">{erreur}</span>}
    </div>
  );
}

// Suffixe des montants : symbole de la monnaie choisie (le moteur déclare « € »).
const suffixe = (c: Champ) => (c.type === 'taux' ? '%' : c.type === 'montant' ? texteMoteur(c.unite ?? '€') || undefined : c.unite ? texteMoteur(c.unite) : undefined);

function Simple({ champ, valeur, onChange, erreur, compact, large }: { champ: Champ; valeur: unknown; onChange: (v: unknown) => void; erreur?: string; compact?: boolean; large?: boolean }) {
  const { t } = useT();
  const id = compact ? undefined : `champ-${champ.nom}`;
  switch (champ.type) {
    case 'booleen':
      return <Interrupteur actif={!!valeur} onChange={onChange} libelle={champ.libelle} />;
    case 'choix': {
      const opts = champ.options ?? [];
      // Boutons segmentés seulement si les libellés tiennent sur une ligne, sinon liste déroulante.
      const segmente = !compact && opts.length <= 3 && opts.reduce((n, o) => n + o.libelle.length, 0) <= (large ? 48 : 24);
      if (segmente)
        return (
          <div className="grid gap-1 rounded-xl bg-surface-2 p-1" style={{ gridTemplateColumns: `repeat(${opts.length}, minmax(0, 1fr))` }}>
            {opts.map((o) => (
              <button
                key={o.valeur}
                type="button"
                onClick={() => onChange(o.valeur)}
                className={cn('rounded-lg px-2 py-1.5 text-[12.5px] font-medium transition-all', valeur === o.valeur ? 'bg-surface text-texte shadow-carte' : 'text-attenue hover:text-texte')}
              >
                {texteMoteur(o.libelle)}
              </button>
            ))}
          </div>
        );
      return (
        <select
          id={id}
          value={String(valeur ?? '')}
          onChange={(e) => onChange(e.target.value)}
          className={cn('h-10 w-full rounded-xl border border-bordure bg-surface px-3 text-sm focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15', compact && 'h-9 text-[13px]')}
        >
          {opts.map((o) => (
            <option key={o.valeur} value={o.valeur}>
              {texteMoteur(o.libelle)}
            </option>
          ))}
        </select>
      );
    }
    case 'texte':
      if (!compact && (champ.nom === 'fichier' || String(champ.defaut ?? '').length > 80))
        return (
          <textarea
            id={id}
            value={String(valeur ?? '')}
            onChange={(e) => onChange(e.target.value)}
            rows={8}
            spellCheck={false}
            className="w-full rounded-xl border border-bordure bg-surface p-3 font-mono text-[11.5px] leading-relaxed focus:border-accent focus:outline-none focus:ring-4 focus:ring-accent/15"
          />
        );
      return <Saisie id={id} value={String(valeur ?? '')} onChange={(e) => onChange(e.target.value)} invalide={!!erreur} className={compact ? 'h-9 text-[13px]' : ''} />;
    case 'date':
      return <Saisie id={id} type="date" value={String(valeur ?? '')} onChange={(e) => onChange(e.target.value)} invalide={!!erreur} className={compact ? 'h-9 text-[13px]' : ''} />;
    case 'liste':
      return (
        <Saisie
          id={id}
          value={Array.isArray(valeur) ? valeur.join(' ; ') : String(valeur ?? '')}
          onChange={(e) => onChange(e.target.value)}
          placeholder={t('form.liste')}
          invalide={!!erreur}
          className={cn('font-mono chiffre', compact ? 'h-9 text-[12.5px]' : 'text-[13px]')}
        />
      );
    default:
      return (
        <Saisie
          id={id}
          inputMode="decimal"
          value={String(valeur ?? '')}
          onChange={(e) => onChange(e.target.value)}
          suffixe={compact ? undefined : suffixe(champ)}
          invalide={!!erreur}
          className={cn('chiffre', compact ? 'h-9 text-right text-[13px]' : '')}
        />
      );
  }
}

function Table({ champ, valeur, onChange, erreurs }: { champ: Champ; valeur: unknown; onChange: (v: unknown) => void; erreurs: ErreursChamps }) {
  const { t } = useT();
  const lignes = (Array.isArray(valeur) ? valeur : []) as Record<string, unknown>[];
  const cols = champ.colonnes ?? [];
  const maj = (i: number, nom: string, v: unknown) => onChange(lignes.map((l, k) => (k === i ? { ...l, [nom]: v } : l)));
  return (
    <div className="overflow-hidden rounded-xl border border-bordure">
      <div className="overflow-x-auto barre-defilement">
        <table className="w-full min-w-[520px] text-[13px]">
          <thead className="bg-surface-2 text-left text-[11.5px] text-attenue">
            <tr>
              {cols.map((c) => (
                <th key={c.nom} className="px-2 py-2 font-medium">
                  {texteMoteur(c.libelle)}
                </th>
              ))}
              <th className="w-9" />
            </tr>
          </thead>
          <tbody>
            {lignes.map((l, i) => (
              <tr key={i} className="border-t border-bordure">
                {cols.map((c) => {
                  const err = erreurs[`${champ.nom}[${i + 1}].${c.nom}`];
                  return (
                    <td key={c.nom} className="px-1.5 py-1.5 align-middle" title={err}>
                      {c.type === 'booleen' ? (
                        <div className="flex justify-center">
                          <Interrupteur actif={!!l[c.nom]} onChange={(v) => maj(i, c.nom, v)} libelle={c.libelle} />
                        </div>
                      ) : (
                        <Simple champ={c} valeur={l[c.nom]} onChange={(v) => maj(i, c.nom, v)} erreur={err} compact />
                      )}
                    </td>
                  );
                })}
                <td className="pr-1.5">
                  <button type="button" onClick={() => onChange(lignes.filter((_, k) => k !== i))} className="rounded-lg p-1.5 text-attenue hover:bg-danger/10 hover:text-danger" aria-label={t('form.supprimerLigne')}>
                    <Trash2 className="size-3.5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <button type="button" onClick={() => onChange([...lignes, ligneVide(champ)])} className="flex w-full items-center justify-center gap-1.5 border-t border-dashed border-bordure py-2 text-[12.5px] font-medium text-accent-texte hover:bg-accent-doux/50">
        <Plus className="size-3.5" /> {t('form.ajouterLigne')}
      </button>
    </div>
  );
}

export function Formulaire({ champs, valeurs, onChange, erreurs }: { champs: Champ[]; valeurs: Valeurs; onChange: (v: Valeurs) => void; erreurs: ErreursChamps }) {
  const { langue } = useT();
  const groupes = useMemo(() => {
    const g: { nom: string; champs: Champ[] }[] = [];
    for (const c of champs) {
      const nom = c.groupe ?? '';
      let x = g.find((y) => y.nom === nom);
      if (!x) g.push((x = { nom, champs: [] }));
      x.champs.push(c);
    }
    return g;
  }, [champs]);
  const maj = (nom: string, v: unknown) => onChange({ ...valeurs, [nom]: v });

  return (
    <div className="space-y-6">
      {groupes.map((g) => (
        <fieldset key={g.nom} className="space-y-4">
          {g.nom && <legend className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-attenue">{g.nom}</legend>}
          <div className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
            {g.champs
              .filter((c) => estVisible(c, valeurs))
              .map((c) => {
                const large = c.type === 'table' || c.type === 'texte' || c.type === 'liste' || (c.type === 'choix' && (c.options?.length ?? 0) > 3) || c.libelle.length > 48;
                const err = erreurs[c.nom];
                if (c.type === 'booleen')
                  return (
                    <div key={c.nom} className="flex items-center justify-between gap-3 rounded-xl border border-bordure bg-surface-2 px-3 py-2.5 sm:col-span-2">
                      <span className="text-[13px] font-medium">{texteMoteur(c.libelle)}</span>
                      <Interrupteur actif={!!valeurs[c.nom]} onChange={(v) => maj(c.nom, v)} libelle={c.libelle} />
                    </div>
                  );
                return (
                  <div key={c.nom} className={cn(large && 'sm:col-span-2')}>
                    <Libelle champ={c} erreur={err} />
                    {c.type === 'table' ? (
                      <Table champ={c} valeur={valeurs[c.nom]} onChange={(v) => maj(c.nom, v)} erreurs={erreurs} />
                    ) : (
                      <Simple champ={c} valeur={valeurs[c.nom]} onChange={(v) => maj(c.nom, v)} erreur={err} large={large} />
                    )}
                    {c.suggestions && (
                      <div className="mt-1.5 flex flex-wrap gap-1">
                        {c.suggestions.map((s) => (
                          <button
                            key={s}
                            type="button"
                            onClick={() => maj(c.nom, s)}
                            className={cn('rounded-full border px-2 py-0.5 text-[11.5px] chiffre transition-colors', String(valeurs[c.nom]) === s ? 'border-accent bg-accent-doux text-accent-texte' : 'border-bordure text-attenue hover:border-accent/50')}
                          >
                            {langue === 'fr' ? s.replace('.', ',') : s}
                            {c.type === 'taux' ? ' %' : ''}
                          </button>
                        ))}
                      </div>
                    )}
                    {c.aide && <p className="mt-1.5 text-[11.5px] leading-snug text-attenue">{texteMoteur(c.aide)}</p>}
                  </div>
                );
              })}
          </div>
        </fieldset>
      ))}
    </div>
  );
}
