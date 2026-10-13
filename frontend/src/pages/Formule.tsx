import { useEffect, useMemo, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, BadgeCheck, ChevronRight, FlaskConical, Hash, Loader2, RotateCcw, Save, Sparkles, XCircle, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { api, ErreurApi } from '@/lib/api';
import type { ResultatCalcul } from '@/lib/types';
import { useCatalogue, useSession } from '@/hooks/useDonnees';
import { useDebounce } from '@/hooks/useDebounce';
import { Badge, Bouton, Carte, Champ as Saisie, Squelette, Vide } from '@/components/ui';
import { Formulaire, valeursInitiales, type ErreursChamps, type Valeurs } from '@/components/calc/Formulaire';
import { DetailResultats, SyntheseResultats } from '@/components/calc/Resultats';
import { apparence, pastille } from '@/lib/moteurs';
import { cn } from '@/lib/utils';

interface Reponse {
  resultat: ResultatCalcul;
  empreinte: string;
  calculId?: string;
}

/** Remet les entrées normalisées d'un calcul enregistré au format du formulaire. */
function depuisEntrees(entrees: Record<string, unknown>, base: Valeurs): Valeurs {
  const v = { ...base };
  for (const [k, x] of Object.entries(entrees)) v[k] = Array.isArray(x) && x.every((y) => typeof y === 'string') ? (x as string[]).join(' ; ') : x;
  return v;
}

export function PageFormule() {
  const { moteur = '', formule = '' } = useParams();
  const [params] = useSearchParams();
  const calculId = params.get('calcul');
  const { moteurs, isLoading } = useCatalogue();
  const { data: session } = useSession();
  const qc = useQueryClient();
  const m = moteurs.find((x) => x.code === moteur);
  const f = m?.formules.find((x) => x.id === formule);

  const [valeurs, setValeurs] = useState<Valeurs>({});
  const [libelle, setLibelle] = useState('');
  const [pret, setPret] = useState(false);

  const enregistre = useQuery({ queryKey: ['historique', calculId], queryFn: () => api<{ calcul: { entrees: Record<string, unknown>; libelle: string | null } }>(`/historique/${calculId}`), enabled: !!calculId });

  useEffect(() => {
    if (!f) return;
    const base = valeursInitiales(f.champs);
    if (calculId && enregistre.data) {
      setValeurs(depuisEntrees(enregistre.data.calcul.entrees, base));
      setLibelle(enregistre.data.calcul.libelle ?? '');
      setPret(true);
    } else if (!calculId) {
      setValeurs(base);
      setLibelle('');
      setPret(true);
    }
  }, [f, calculId, enregistre.data]);

  const debounce = useDebounce(valeurs, 220);
  const calcul = useQuery({
    queryKey: ['calcul', moteur, formule, debounce],
    queryFn: () => api<Reponse>(`/calc/${moteur}/${formule}`, { method: 'POST', json: { entrees: debounce } }),
    enabled: pret && !!f,
    placeholderData: keepPreviousData,
    retry: false,
    staleTime: Infinity,
  });
  const enCours = calcul.isFetching || debounce !== valeurs;
  const erreur = calcul.error instanceof ErreurApi ? calcul.error : null;
  const erreursChamps: ErreursChamps = useMemo(() => Object.fromEntries((erreur?.details ?? []).map((x) => [x.champ, x.message])), [erreur]);
  const r = !erreur ? calcul.data?.resultat : undefined;

  const sauver = useMutation({
    mutationFn: (validerCalcul: boolean) => api<Reponse>(`/calc/${moteur}/${formule}`, { method: 'POST', json: { entrees: valeurs, enregistrer: true, valider: validerCalcul, libelle: libelle || undefined } }),
    onSuccess: (x, validerCalcul) => {
      qc.invalidateQueries({ queryKey: ['historique'] });
      toast.success(validerCalcul ? 'Calcul validé et archivé' : 'Brouillon enregistré', { description: `Empreinte ${x.empreinte.slice(0, 16)}…` });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : 'Échec de l’enregistrement'),
  });

  if (isLoading) return <Squelette className="h-96" />;
  if (!m || !f) return <Vide icone={<XCircle />} titre="Formule introuvable" action={<Link to="/" className="text-sm text-accent-texte underline">Retour au tableau de bord</Link>} />;

  const a = apparence(m.code);
  // Une balance ou un tableau à plusieurs colonnes a besoin de place : la colonne de saisie s'élargit.
  const saisieLarge = f.champs.some((c) => c.type === 'table' && (c.colonnes?.length ?? 0) >= 4);
  const nbErreurs = r?.controles.filter((c) => c.niveau === 'erreur').length ?? 0;
  const nbAlertes = r?.controles.filter((c) => c.niveau === 'avertissement').length ?? 0;

  return (
    <div className="space-y-6 animate-apparition">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 space-y-2">
          <nav className="flex items-center gap-1 text-[12.5px] text-attenue">
            <Link to={`/moteur/${m.code}`} className="flex items-center gap-1.5 hover:text-texte">
              <span className="grid size-5 place-items-center rounded-md" style={pastille(a.teinte)}>
                <a.icone className="size-3" />
              </span>
              {m.nom}
            </Link>
            <ChevronRight className="size-3.5" />
            <span>{f.categorie}</span>
          </nav>
          <h1 className="text-2xl font-bold tracking-tight sm:text-[28px]">{f.nom}</h1>
          <p className="max-w-3xl text-[14px] leading-relaxed text-attenue">{f.description}</p>
          <div className="flex flex-wrap gap-1.5">
            <Badge ton="accent">
              <Hash className="size-3" />
              {m.code}/{f.id}
            </Badge>
            <Badge>v{f.version}</Badge>
            <Badge>{f.references.length} référence{f.references.length > 1 ? 's' : ''} légale{f.references.length > 1 ? 's' : ''}</Badge>
            {f.baremes.length > 0 && <Badge>{f.baremes.length} barème{f.baremes.length > 1 ? 's' : ''} versionné{f.baremes.length > 1 ? 's' : ''}</Badge>}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {f.exemples.length > 0 && (
            <select
              onChange={(e) => {
                const ex = f.exemples[Number(e.target.value)];
                if (ex) setValeurs(depuisEntrees(ex.entrees, valeursInitiales(f.champs)));
                e.target.value = '';
              }}
              defaultValue=""
              className="h-10 rounded-xl border border-bordure bg-surface px-3 text-sm"
              aria-label="Charger un exemple"
            >
              <option value="" disabled>
                Exemples vérifiés…
              </option>
              {f.exemples.map((ex, i) => (
                <option key={i} value={i}>
                  {ex.titre}
                </option>
              ))}
            </select>
          )}
          <Bouton onClick={() => setValeurs(valeursInitiales(f.champs))}>
            <RotateCcw className="size-4" /> Réinitialiser
          </Bouton>
        </div>
      </div>

      <Carte className="flex items-start gap-3 bg-gradient-to-r from-accent-doux/70 to-transparent p-4">
        <Sparkles className="mt-0.5 size-4 shrink-0 text-accent-texte" />
        <p className="min-w-0 break-words font-mono text-[12.5px] leading-relaxed text-texte">{f.expression}</p>
      </Carte>

      <div className={cn('grid items-start gap-6', saisieLarge ? 'xl:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)]' : 'xl:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]')}>
        <Carte className="p-5 sm:p-6">
          <div className="mb-5 flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-semibold">
              <FlaskConical className="size-4 text-accent-texte" /> Données d’entrée
            </h2>
            <span className="text-[12px] text-attenue">Chaque modification recalcule tout</span>
          </div>
          {pret ? <Formulaire champs={f.champs} valeurs={valeurs} onChange={setValeurs} erreurs={erreursChamps} /> : <Squelette className="h-64" />}
        </Carte>

        <div className="space-y-4 xl:sticky xl:top-24">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="flex items-center gap-2 font-semibold">
              <Zap className="size-4 text-accent-texte" /> Résultats
            </h2>
            <div className="flex items-center gap-2 text-[12px] text-attenue">
              {enCours ? (
                <span className="flex items-center gap-1.5">
                  <Loader2 className="size-3.5 animate-spin" /> Calcul…
                </span>
              ) : r ? (
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-succes shadow-[0_0_0_3px_hsl(var(--succes)/.2)]" /> Calculé en {r.dureeMs.toLocaleString('fr-FR')} ms
                </span>
              ) : null}
            </div>
          </div>

          {erreur && (
            <Carte className="border-danger/30 bg-danger/5 p-4">
              <p className="flex items-center gap-2 text-sm font-semibold text-danger">
                <XCircle className="size-4" /> {erreur.message}
              </p>
              {erreur.details && (
                <ul className="mt-2 space-y-0.5 text-[13px]">
                  {erreur.details.map((d, i) => (
                    <li key={i}>
                      <span className="font-mono text-[12px]">{d.champ}</span> : {d.message}
                    </li>
                  ))}
                </ul>
              )}
            </Carte>
          )}

          {!r && !erreur && <Squelette className="h-40" />}
          {r && (
            <div className={cn('space-y-4 transition-opacity', enCours && 'opacity-70')}>
              <SyntheseResultats r={r} />
              {(nbErreurs > 0 || nbAlertes > 0) && (
                <div className={cn('flex items-center gap-2 rounded-xl border px-3 py-2 text-[13px]', nbErreurs ? 'border-danger/30 bg-danger/5 text-danger' : 'border-alerte/30 bg-alerte/5 text-alerte')}>
                  <AlertTriangle className="size-4" />
                  {nbErreurs > 0 && `${nbErreurs} erreur${nbErreurs > 1 ? 's' : ''}`}
                  {nbErreurs > 0 && nbAlertes > 0 && ' · '}
                  {nbAlertes > 0 && `${nbAlertes} avertissement${nbAlertes > 1 ? 's' : ''}`}
                  <span className="text-attenue">— voir l’onglet Contrôles</span>
                </div>
              )}
              <DetailResultats r={r} />
              {session?.utilisateur.role !== 'LECTEUR' && (
                <Carte className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  <Saisie value={libelle} onChange={(e) => setLibelle(e.target.value)} placeholder="Libellé (dossier, client, période…)" className="sm:flex-1" />
                  <div className="flex gap-2">
                    <Bouton onClick={() => sauver.mutate(false)} chargement={sauver.isPending && sauver.variables === false} disabled={!!erreur}>
                      <Save className="size-4" /> Brouillon
                    </Bouton>
                    <Bouton variante="primaire" onClick={() => sauver.mutate(true)} chargement={sauver.isPending && sauver.variables === true} disabled={!!erreur || nbErreurs > 0} title={nbErreurs ? 'Corriger les erreurs avant validation' : undefined}>
                      <BadgeCheck className="size-4" /> Vérifier et valider
                    </Bouton>
                  </div>
                </Carte>
              )}
              {calcul.data && <p className="break-all text-right font-mono text-[11px] text-attenue">SHA-256 {calcul.data.empreinte}</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
