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
  const qc = useQueryClient();
  const m = useMutation({
    mutationFn: () => api(`/baremes/${bareme.code}/versions`, { method: 'POST', json: { du, source, statut, valeurs: JSON.parse(json) } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['baremes'] });
      qc.removeQueries({ queryKey: ['calcul'] });
      toast.success('Nouvelle version enregistrée', { description: `Appliquée aux opérations à partir du ${valeur(du, 'date')}.` });
      onFermer();
    },
    onError: (e) => toast.error(e instanceof SyntaxError ? 'JSON invalide' : e instanceof ErreurApi ? (e.details?.[0]?.message ?? e.message) : 'Erreur'),
  });
  return (
    <div className="space-y-4">
      <p className="text-[13px] text-attenue">
        La version s’applique automatiquement aux calculs dont la date d’opération est postérieure à sa date d’effet. La structure doit être identique à la version du {valeur(derniere.du, 'date')}.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-[13px] font-medium">
          En vigueur à partir du
          <Champ type="date" value={du} onChange={(e) => setDu(e.target.value)} className="mt-1.5" />
        </label>
        <label className="block text-[13px] font-medium">
          Statut
          <select value={statut} onChange={(e) => setStatut(e.target.value as 'officiel')} className="mt-1.5 h-10 w-full rounded-xl border border-bordure bg-surface px-3 text-sm">
            <option value="officiel">Officiel (texte publié)</option>
            <option value="a_verifier">À vérifier</option>
          </select>
        </label>
      </div>
      <label className="block text-[13px] font-medium">
        Texte de référence
        <Champ value={source} onChange={(e) => setSource(e.target.value)} placeholder="Ex. : loi de finances pour 2027, art. 12 ; arrêté du…" className="mt-1.5" />
      </label>
      <label className="block text-[13px] font-medium">
        Valeurs
        <textarea value={json} onChange={(e) => setJson(e.target.value)} rows={12} spellCheck={false} className="mt-1.5 w-full rounded-xl border border-bordure bg-surface-2 p-3 font-mono text-[12px] focus:border-accent focus:outline-none" />
      </label>
      <div className="flex justify-end gap-2">
        <Bouton onClick={onFermer}>Annuler</Bouton>
        <Bouton variante="primaire" onClick={() => m.mutate()} chargement={m.isPending} disabled={source.length < 3}>
          Enregistrer la version
        </Bouton>
      </div>
    </div>
  );
}

export function PageBaremes() {
  const { moteurs } = useCatalogue();
  const { data: session } = useSession();
  const q = useQuery({ queryKey: ['baremes'], queryFn: () => api<{ baremes: Bareme[] }>('/baremes') });
  const [edition, setEdition] = useState<Bareme | null>(null);
  const [ouvert, setOuvert] = useState<string | null>(null);
  const parMoteur = useMemo(() => moteurs.map((m) => ({ m, baremes: (q.data?.baremes ?? []).filter((b) => b.moteur === m.code) })).filter((x) => x.baremes.length), [moteurs, q.data]);
  const admin = session?.utilisateur.role === 'ADMIN';

  return (
    <div className="space-y-6 animate-apparition">
      <div>
        <h1 className="text-[28px] font-bold tracking-tight">Barèmes et taux</h1>
        <p className="max-w-3xl text-[14px] text-attenue">Base versionnée et historisée : chaque calcul applique la version en vigueur à la date de l’opération. Les versions « à vérifier » et les barèmes non mis à jour pour l’année en cours déclenchent une alerte dans les résultats.</p>
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
              {m.nom}
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
                        {b.obsolete && <Badge ton="alerte"><CalendarClock className="size-3" /> À mettre à jour</Badge>}
                        {aVerifier && <Badge ton="alerte"><AlertTriangle className="size-3" /> À vérifier</Badge>}
                        {!b.obsolete && !aVerifier && <Badge ton="succes"><CheckCircle2 className="size-3" /> À jour</Badge>}
                      </div>
                    </div>
                    <ol className="mt-4 space-y-2 border-l-2 border-bordure pl-4">
                      {[...b.versions].reverse().slice(0, deplie ? undefined : 3).map((v) => (
                        <li key={v.du} className="relative">
                          <span className={cn('absolute -left-[23px] top-1.5 size-3 rounded-full border-2 border-surface', v.du === b.enVigueur ? 'bg-accent' : 'bg-bordure')} />
                          <div className="flex flex-wrap items-center gap-2 text-[13px]">
                            <span className="font-semibold chiffre">Depuis le {valeur(v.du, 'date')}</span>
                            {v.au && <span className="text-attenue">jusqu’au {valeur(v.au, 'date')}</span>}
                            {v.du === b.enVigueur && <Badge ton="accent">En vigueur</Badge>}
                            {v.statut === 'a_verifier' && <Badge ton="alerte">À vérifier</Badge>}
                            {v.origine === 'SAISIE' && <Badge ton="info">Saisie {v.auteur ? `· ${v.auteur}` : ''}</Badge>}
                          </div>
                          <p className="mt-0.5 text-[12px] text-attenue">{v.source}{v.note ? ` — ${v.note}` : ''}</p>
                          {deplie && <pre className="mt-2 max-h-56 overflow-auto rounded-lg bg-surface-2 p-2.5 font-mono text-[11px] barre-defilement">{JSON.stringify(v.valeurs, null, 2)}</pre>}
                        </li>
                      ))}
                    </ol>
                    <div className="mt-3 flex items-center justify-between">
                      <button onClick={() => setOuvert(deplie ? null : b.code)} className="text-[12.5px] font-medium text-accent-texte hover:underline">
                        {deplie ? 'Réduire' : b.versions.length > 1 ? `Voir les ${b.versions.length} versions et leurs valeurs` : 'Voir la version et ses valeurs'}
                      </button>
                      {admin && (
                        <Bouton taille="sm" onClick={() => setEdition(b)}>
                          <Plus className="size-3.5" /> Nouvelle version
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
      <Dialogue ouvert={!!edition} onFermer={() => setEdition(null)} titre={<span className="flex items-center gap-2"><BookMarked className="size-4" /> {edition?.libelle}</span>} large>
        {edition && <NouvelleVersion bareme={edition} onFermer={() => setEdition(null)} />}
      </Dialogue>
    </div>
  );
}
