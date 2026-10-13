import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, BookMarked, CalendarClock, CheckCircle2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { api, ErreurApi } from '@/lib/api';
import { useCatalogue, useSession } from '@/hooks/useDonnees';
import { Badge, Bouton, Carte, Champ, Dialogue, Squelette } from '@/components/ui';
import { apparence, pastille } from '@/lib/moteurs';
import { valeur } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';

interface Version {
  du: string;
  au?: string;
  valeurs: unknown;
  source: string;
  statut: 'officiel' | 'a_verifier';
  note?: string;
  origine: 'BIBLIOTHEQUE' | 'SAISIE';
  auteur: string | null;
}
interface Bareme {
  code: string;
  moteur: string;
  libelle: string;
  obsolete: boolean;
  enVigueur: string | null;
  versions: Version[];
}

function NouvelleVersion({ bareme, onFermer }: { bareme: Bareme; onFermer: () => void }) {
  const derniere = bareme.versions[bareme.versions.length - 1];
  const [du, setDu] = useState(`${new Date().getFullYear() + 1}-01-01`);
  const [source, setSource] = useState('');
  const [json, setJson] = useState(JSON.stringify(derniere.valeurs, null, 2));
  const [statut, setStatut] = useState<'officiel' | 'a_verifier'>('officiel');
  const { t, erreur } = useT();
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: () => api(`/baremes/${bareme.code}/versions`, { method: 'POST', json: { du, source, statut, valeurs: JSON.parse(json) } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['baremes'] });
      qc.removeQueries({ queryKey: ['calcul'] });
      toast.success(t('baremes.toast'), { description: t('baremes.toastDetail', { date: valeur(du, 'date') }) });
      onFermer();
    },
    onError: (e) => toast.error(e instanceof SyntaxError ? t('baremes.jsonInvalide') : e instanceof ErreurApi ? erreur(e) : t('commun.erreur')),
  });
  return (
    <div className="space-y-4">
      <p className="text-[13px] text-attenue">
        {t('baremes.dlgIntro', { date: valeur(derniere.du, 'date') })}
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-[13px] font-medium">
          {t('baremes.dlgDu')}
          <Champ type="date" value={du} onChange={(e) => setDu(e.target.value)} className="mt-1.5" />
        </label>
        <label className="block text-[13px] font-medium">
          {t('baremes.dlgStatut')}
          <select value={statut} onChange={(e) => setStatut(e.target.value as 'officiel')} className="mt-1.5 h-10 w-full rounded-xl border border-bordure bg-surface px-3 text-sm">
            <option value="officiel">{t('baremes.dlgOfficiel')}</option>
            <option value="a_verifier">{t('baremes.dlgAVerifier')}</option>
          </select>
        </label>
      </div>
      <label className="block text-[13px] font-medium">
        {t('baremes.dlgSource')}
        <Champ value={source} onChange={(e) => setSource(e.target.value)} placeholder={t('baremes.dlgSourceEx')} className="mt-1.5" />
      </label>
      <label className="block text-[13px] font-medium">
        {t('baremes.dlgValeurs')}
        <textarea value={json} onChange={(e) => setJson(e.target.value)} rows={12} spellCheck={false} className="mt-1.5 w-full rounded-xl border border-bordure bg-surface-2 p-3 font-mono text-[12px] focus:border-accent focus:outline-none" />
      </label>
      <div className="flex justify-end gap-2">
        <Bouton onClick={onFermer}>{t('commun.annuler')}</Bouton>
        <Bouton variante="primaire" onClick={() => m.mutate()} chargement={m.isPending} disabled={source.length < 3}>
          {t('baremes.dlgEnregistrer')}
        </Bouton>
      </div>
    </div>
  );
}

export function PageBaremes() {
  const { moteurs } = useCatalogue();
  const { data: session } = useSession();
  const { t, nomMoteur } = useT();
  const q = useQuery({ queryKey: ['baremes'], queryFn: () => api<{ baremes: Bareme[] }>('/baremes') });
  const [edition, setEdition] = useState<Bareme | null>(null);
  const [ouvert, setOuvert] = useState<string | null>(null);
  const parMoteur = useMemo(() => moteurs.map((m) => ({ m, baremes: (q.data?.baremes ?? []).filter((b) => b.moteur === m.code) })).filter((x) => x.baremes.length), [moteurs, q.data]);
  const admin = session?.utilisateur.role === 'ADMIN';

  return (
    <div className="space-y-6 animate-apparition">
      <div>
        <h1 className="text-[28px] font-bold tracking-tight">{t('baremes.titre')}</h1>
        <p className="max-w-3xl text-[14px] text-attenue">{t('baremes.sousTitre')}</p>
      </div>
      {q.isLoading && <Squelette className="h-80" />}
      {parMoteur.map(({ m, baremes }) => {
        const a = apparence(m.code);
        return (
          <section key={m.code} className="space-y-3">
            <h2 className="flex items-center gap-2 font-semibold">
              <span className="grid size-7 place-items-center rounded-lg" style={pastille(a.teinte)}>
                <a.icone className="size-3.5" />
              </span>
              {nomMoteur(m)}
            </h2>
            <div className="grid gap-3 lg:grid-cols-2">
              {baremes.map((b) => {
                const aVerifier = b.versions.some((v) => v.statut === 'a_verifier');
                const deplie = ouvert === b.code;
                return (
                  <Carte key={b.code} className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <button className="min-w-0 text-left" onClick={() => setOuvert(deplie ? null : b.code)}>
                        <p className="font-semibold">{b.libelle}</p>
                        <p className="font-mono text-[11.5px] text-attenue">{b.code}</p>
                      </button>
                      <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                        {b.obsolete && <Badge ton="alerte"><CalendarClock className="size-3" /> {t('baremes.aMettreAJour')}</Badge>}
                        {aVerifier && <Badge ton="alerte"><AlertTriangle className="size-3" /> {t('baremes.aVerifier')}</Badge>}
                        {!b.obsolete && !aVerifier && <Badge ton="succes"><CheckCircle2 className="size-3" /> {t('baremes.aJour')}</Badge>}
                      </div>
                    </div>
                    <ol className="mt-4 space-y-2 border-l-2 border-bordure pl-4">
                      {[...b.versions].reverse().slice(0, deplie ? undefined : 3).map((v) => (
                        <li key={v.du} className="relative">
                          <span className={cn('absolute -left-[23px] top-1.5 size-3 rounded-full border-2 border-surface', v.du === b.enVigueur ? 'bg-accent' : 'bg-bordure')} />
                          <div className="flex flex-wrap items-center gap-2 text-[13px]">
                            <span className="font-semibold chiffre">{t('baremes.depuis', { date: valeur(v.du, 'date') })}</span>
                            {v.au && <span className="text-attenue">{t('baremes.jusquau', { date: valeur(v.au, 'date') })}</span>}
                            {v.du === b.enVigueur && <Badge ton="accent">{t('baremes.enVigueur')}</Badge>}
                            {v.statut === 'a_verifier' && <Badge ton="alerte">{t('baremes.aVerifier')}</Badge>}
                            {v.origine === 'SAISIE' && <Badge ton="info">{t('baremes.saisie')} {v.auteur ? `· ${v.auteur}` : ''}</Badge>}
                          </div>
                          <p className="mt-0.5 text-[12px] text-attenue">{v.source}{v.note ? ` — ${v.note}` : ''}</p>
                          {deplie && <pre className="mt-2 max-h-56 overflow-auto rounded-lg bg-surface-2 p-2.5 font-mono text-[11px] barre-defilement">{JSON.stringify(v.valeurs, null, 2)}</pre>}
                        </li>
                      ))}
                    </ol>
                    <div className="mt-3 flex items-center justify-between">
                      <button onClick={() => setOuvert(deplie ? null : b.code)} className="text-[12.5px] font-medium text-accent-texte hover:underline">
                        {deplie ? t('baremes.reduire') : b.versions.length > 1 ? t('baremes.voirVersions', { n: b.versions.length }) : t('baremes.voirVersion')}
                      </button>
                      {admin && (
                        <Bouton taille="sm" onClick={() => setEdition(b)}>
                          <Plus className="size-3.5" /> {t('baremes.nouvelle')}
                        </Bouton>
                      )}
                    </div>
                  </Carte>
                );
              })}
            </div>
          </section>
        );
      })}
      <Dialogue ouvert={!!edition} onFermer={() => setEdition(null)} titre={<span className="flex items-center gap-2"><BookMarked className="size-4" /> {edition?.libelle}</span>} large libelleFermer={t('commun.fermer')}>
        {edition && <NouvelleVersion bareme={edition} onFermer={() => setEdition(null)} />}
      </Dialogue>
    </div>
  );
}
