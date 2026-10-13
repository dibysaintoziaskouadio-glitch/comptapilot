/**
 * Tableau de bord, style « verre » : tuiles de chiffres animés, activité en barres (jour courant en évidence),
 * anneaux de répartition par moteur et de contrôles, derniers calculs et barèmes à surveiller.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, BadgeCheck, BarChart3, BookMarked, CalendarClock, ChevronRight, PieChart as IconeAnneau, ShieldCheck, Sparkles, TrendingDown, TrendingUp, Zap } from 'lucide-react';
import { Bar, BarChart, Cell, LabelList, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { CalculResume } from '@/lib/types';
import { useCatalogue, useSession, useStatistiques } from '@/hooks/useDonnees';
import { Badge, Carte, Onglets, Squelette } from '@/components/ui';
import { apparence, pastille } from '@/lib/moteurs';
import { dateCourte, dateHeure, nombre, valeur } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const RACCOURCIS: [string, string][] = [
  ['tva', 'ht-ttc'],
  ['paie', 'bulletin'],
  ['financier', 'etats-depuis-balance'],
  ['tresorerie', 'emprunt'],
];

const INFOBULLE = { background: 'hsl(var(--surface-pleine) / .95)', border: '1px solid hsl(var(--bordure))', borderRadius: 14, fontSize: 12, boxShadow: '0 16px 40px -16px rgb(0 0 0 / .5)' };
const COULEURS_ANNEAU = ['hsl(var(--accent))', 'hsl(var(--cyan))', 'hsl(var(--magenta))', 'hsl(270 15% 70% / .45)'];

/** Chiffre qui monte de 0 à sa valeur (≈ 0,9 s, adouci) ; immédiat si l'utilisateur limite les animations. */
function useCompteur(cible: number | undefined) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (cible === undefined) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setV(cible);
      return;
    }
    let image = 0;
    const t0 = performance.now();
    const pas = (t: number) => {
      const p = Math.min(1, (t - t0) / 900);
      setV(Math.round(cible * (1 - Math.pow(1 - p, 3))));
      if (p < 1) image = requestAnimationFrame(pas);
    };
    image = requestAnimationFrame(pas);
    return () => cancelAnimationFrame(image);
  }, [cible]);
  return v;
}

function Tuile({ libelle, valeur: cible, badge, ton = 'neutre', icone }: { libelle: string; valeur?: number; badge?: React.ReactNode; ton?: 'neutre' | 'hausse' | 'baisse'; icone: React.ReactNode }) {
  const v = useCompteur(cible);
  return (
    <div className="relative flex flex-1 flex-col justify-between overflow-hidden rounded-3xl border border-bordure bg-surface-2 p-5 shadow-[inset_0_1px_0_hsl(0_0%_100%/.08)] transition-colors duration-300 hover:border-accent/30">
      <div className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full bg-[hsl(var(--accent)/.18)] blur-2xl" />
      <div className="relative flex items-start justify-between gap-2">
        <p className="text-[14px] font-medium text-attenue">{libelle}</p>
        <span className="text-attenue/80">{icone}</span>
      </div>
      <div className="relative mt-6 flex items-end gap-2.5">
        <p className="text-[36px] font-semibold leading-none montant">{cible === undefined ? '—' : nombre(String(v))}</p>
        {badge && (
          <span className={cn('mb-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-semibold', ton === 'hausse' ? 'bg-succes/15 text-succes' : ton === 'baisse' ? 'bg-danger/15 text-danger' : 'bg-[hsl(var(--ombre)/.3)] text-texte')}>
            {badge}
          </span>
        )}
      </div>
    </div>
  );
}

function Anneau({ titre, icone, donnees, vide }: { titre: string; icone: React.ReactNode; donnees: { nom: string; valeur: number }[]; vide: string }) {
  const total = donnees.reduce((s, x) => s + x.valeur, 0);
  return (
    <Carte className="flex flex-col p-5">
      <h2 className="flex items-center gap-2.5 text-[17px] font-semibold">
        <span className="text-attenue">{icone}</span> {titre}
      </h2>
      {total === 0 ? (
        <p className="my-auto py-8 text-center text-[13px] text-attenue">{vide}</p>
      ) : (
        <div className="mt-3 flex items-center gap-4">
          <ul className="min-w-0 flex-1 divide-y divide-bordure">
            {donnees.map((d, i) => (
              <li key={d.nom} className="flex items-center gap-2.5 py-2 text-[13px]">
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: COULEURS_ANNEAU[i % COULEURS_ANNEAU.length] }} />
                <span className="min-w-0 flex-1 truncate">{d.nom}</span>
                <span className="font-semibold chiffre">{Math.round((d.valeur / total) * 100)} %</span>
              </li>
            ))}
          </ul>
          <div className="size-[132px] shrink-0">
            <ResponsiveContainer>
              <PieChart>
                <Pie data={donnees} dataKey="valeur" nameKey="nom" innerRadius={42} outerRadius={62} paddingAngle={3} cornerRadius={6} stroke="none" animationDuration={900} animationEasing="ease-out">
                  {donnees.map((d, i) => (
                    <Cell key={d.nom} fill={COULEURS_ANNEAU[i % COULEURS_ANNEAU.length]} />
                  ))}
                </Pie>
                <Tooltip contentStyle={INFOBULLE} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </Carte>
  );
}

export function PageTableauDeBord() {
  const { moteurs, formules, isLoading } = useCatalogue();
  const { data: session } = useSession();
  const stats = useStatistiques();
  const { t, langue, nomMoteur, descriptionMoteur } = useT();
  const recents = useQuery({ queryKey: ['historique', 'recents'], queryFn: () => api<{ calculs: CalculResume[] }>('/historique?parPage=5') });
  const baremes = useQuery({ queryKey: ['baremes'], queryFn: () => api<{ baremes: { code: string; moteur: string; libelle: string; obsolete: boolean; versions: { statut: string }[] }[] }>('/baremes') });
  const aSurveiller = useMemo(() => (baremes.data?.baremes ?? []).filter((b) => b.obsolete || b.versions.some((v) => v.statut === 'a_verifier')), [baremes.data]);
  const [vue, setVue] = useState<'jours' | 'moteurs'>('jours');
  const heure = new Date().getHours();
  const s = stats.data;

  // Tendance : 7 derniers jours comparés aux 7 précédents.
  const tendance = useMemo(() => {
    if (!s) return null;
    const recent = s.parJour.slice(7).reduce((a, x) => a + x.n, 0);
    const avant = s.parJour.slice(0, 7).reduce((a, x) => a + x.n, 0);
    if (!avant) return recent ? { n: 100, hausse: true } : null;
    const p = Math.round(((recent - avant) / avant) * 100);
    return { n: Math.abs(p), hausse: p >= 0 };
  }, [s]);

  // Référence stable : un nouveau tableau à chaque rendu relancerait l'animation des barres.
  const barres = useMemo(() => {
    if (!s) return [];
    if (vue === 'jours') return s.parJour.map((x, i) => ({ etiquette: dateCourte(x.jour), n: x.n, vedette: i === s.parJour.length - 1 }));
    const max = Math.max(0, ...Object.values(s.parMoteur));
    return moteurs.map((m) => ({ etiquette: nomMoteur(m).split(/[ &]/)[0], n: s.parMoteur[m.code] ?? 0, vedette: max > 0 && (s.parMoteur[m.code] ?? 0) === max }));
  }, [s, vue, moteurs, nomMoteur, langue]); // eslint-disable-line react-hooks/exhaustive-deps

  const repartition = useMemo(() => {
    if (!s) return [];
    const tri = moteurs.map((m) => ({ nom: nomMoteur(m), valeur: s.parMoteur[m.code] ?? 0 })).filter((x) => x.valeur > 0).sort((a, b) => b.valeur - a.valeur);
    const autres = tri.slice(3).reduce((a, x) => a + x.valeur, 0);
    return [...tri.slice(0, 3), ...(autres ? [{ nom: t('accueil.autres'), valeur: autres }] : [])];
  }, [s, moteurs, nomMoteur, t]);

  const controles = s ? [
    { nom: t('accueil.conformes'), valeur: s.total - s.alertes },
    { nom: t('accueil.avecAlertes'), valeur: s.alertes },
  ] : [];

  return (
    <div className="space-y-6">
      {/* En-tête de page */}
      <div className="flex flex-wrap items-end justify-between gap-4 pt-2">
        <div>
          <p className="flex items-center gap-2 text-[13px] font-medium text-attenue">
            <Sparkles className="size-4 text-accent-texte" /> {t(heure < 18 ? 'accueil.bonjour' : 'accueil.bonsoir')} {session?.utilisateur.nom.split(' ')[0]}
          </p>
          <h1 className="mt-1 text-[30px] font-semibold sm:text-[34px]">{t('accueil.titrePage')}</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {RACCOURCIS.map(([m, f], i) => {
            const x = formules.find((y) => y.moteur === m && y.id === f);
            const a = apparence(m);
            return x ? (
              <Link key={f} to={`/calcul/${m}/${f}`} className="carte souleve flex h-11 items-center gap-2 rounded-2xl px-3.5 text-[13px] font-medium animate-montee" style={{ animationDelay: `${i * 60}ms` }}>
                <span className="grid size-6 place-items-center rounded-lg" style={pastille(a.teinte)}>
                  <a.icone className="size-3.5" />
                </span>
                {x.nom}
              </Link>
            ) : null;
          })}
        </div>
      </div>

      {/* Activité + anneaux */}
      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.75fr)_minmax(0,1fr)]">
        <Carte className="p-5 animate-montee">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2.5 text-[17px] font-semibold">
              <BarChart3 className="size-5 text-attenue" /> {t('accueil.activiteTitre')}
            </h2>
            <Onglets
              valeur={vue}
              onChange={setVue}
              onglets={[
                { id: 'jours', libelle: t('accueil.onglet14j') },
                { id: 'moteurs', libelle: t('accueil.ongletMoteurs') },
              ]}
            />
          </div>
          <div className="mt-5 grid gap-4 md:grid-cols-[220px_minmax(0,1fr)]">
            <div className="flex flex-col gap-3 sm:flex-row md:flex-col">
              <Tuile
                libelle={t('accueil.kpiEnregistres')}
                valeur={s?.total}
                icone={<Zap className="size-4" />}
                ton={tendance ? (tendance.hausse ? 'hausse' : 'baisse') : 'neutre'}
                badge={tendance && <>{tendance.hausse ? <TrendingUp className="size-3" /> : <TrendingDown className="size-3" />}{tendance.n} %</>}
              />
              <Tuile libelle={t('accueil.kpiValides')} valeur={s?.valides} icone={<BadgeCheck className="size-4" />} badge={s && s.total > 0 ? t('accueil.tauxValidation', { n: Math.round((s.valides / s.total) * 100) }) : undefined} />
            </div>
            <div className="relative h-64 min-w-0">
              {!s ? (
                <Squelette className="h-full" />
              ) : (
                <>
                  <ResponsiveContainer>
                    <BarChart data={barres} margin={{ top: 24, right: 4, left: -18, bottom: 0 }}>
                      <XAxis dataKey="etiquette" stroke="hsl(var(--attenue))" fontSize={11} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={10} />
                      <YAxis stroke="hsl(var(--attenue))" fontSize={11} tickLine={false} axisLine={false} allowDecimals={false} />
                      <Tooltip cursor={{ fill: 'hsl(var(--accent) / .08)', radius: 10 }} contentStyle={INFOBULLE} formatter={(v: number) => [v, t('accueil.infobulle')]} />
                      <Bar dataKey="n" radius={[8, 8, 8, 8]} maxBarSize={18} animationDuration={900} animationEasing="ease-out">
                        {barres.map((b, i) => (
                          <Cell key={i} fill={b.vedette ? 'hsl(var(--accent))' : 'hsl(270 30% 88% / .78)'} />
                        ))}
                        <LabelList dataKey="n" position="top" content={({ x, y, width, value, index }) => (index !== undefined && barres[index]?.vedette && Number(value) > 0 ? (
                          <g>
                            <rect x={Number(x) + Number(width) / 2 - 16} y={Number(y) - 26} width={32} height={20} rx={7} fill="hsl(var(--surface-pleine))" stroke="hsl(var(--bordure))" />
                            <text x={Number(x) + Number(width) / 2} y={Number(y) - 12} textAnchor="middle" fontSize={11} fontWeight={700} fill="hsl(var(--texte))">{value}</text>
                          </g>
                        ) : null)} />
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                  {s.total === 0 && <p className="pointer-events-none absolute inset-0 grid place-items-center px-6 text-center text-[13px] text-attenue">{t('accueil.aucuneDonnee')}</p>}
                </>
              )}
            </div>
          </div>
        </Carte>

        <div className="grid gap-5 animate-montee [animation-delay:80ms]">
          <Anneau titre={t('accueil.repartition')} icone={<IconeAnneau className="size-5" />} donnees={repartition} vide={t('accueil.aucuneDonnee')} />
          <Anneau titre={t('accueil.controles')} icone={<ShieldCheck className="size-5" />} donnees={controles} vide={t('accueil.aucuneDonnee')} />
        </div>
      </section>

      {/* Derniers calculs + barèmes à surveiller */}
      <section className="grid gap-5 lg:grid-cols-2">
        <Carte className="p-5 animate-montee [animation-delay:120ms]">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2.5 text-[17px] font-semibold">
              <Zap className="size-5 text-attenue" /> {t('accueil.derniers')}
            </h2>
            <Link to="/historique" className="flex items-center gap-1 text-[12.5px] font-medium text-accent-texte hover:underline">
              {t('accueil.toutVoir')} <ChevronRight className="size-3.5" />
            </Link>
          </div>
          <ul className="mt-4 space-y-2">
            {recents.isLoading && <Squelette className="h-40" />}
            {recents.data?.calculs.length === 0 && <li className="py-10 text-center text-sm text-attenue">{t('accueil.aucun')}</li>}
            {recents.data?.calculs.map((c, i) => {
              const a = apparence(c.moteur);
              return (
                <li key={c.id} className="animate-montee" style={{ animationDelay: `${160 + i * 50}ms` }}>
                  <Link to={`/calcul/${c.moteur}/${c.formuleId}?calcul=${c.id}`} className="flex items-center gap-3 rounded-2xl border border-bordure bg-surface-2 p-2.5 pr-3.5 transition-all duration-300 hover:-translate-y-0.5 hover:border-accent/40">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl" style={pastille(a.teinte)}>
                      <a.icone className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium">{c.libelle || c.formuleNom}</span>
                      <span className="block truncate text-[11.5px] text-attenue">{dateHeure(c.creeLe)}</span>
                    </span>
                    {c.principalValeur !== null && <span className="hidden text-[13px] font-semibold chiffre sm:block">{valeur(c.principalValeur, c.principalUnite ?? undefined, c.devise)}</span>}
                    {c.statut === 'VALIDE' ? <BadgeCheck className="size-4 shrink-0 text-succes" /> : <span className="size-2 shrink-0 rounded-full bg-attenue/50" />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </Carte>

        <Carte className="p-5 animate-montee [animation-delay:160ms]">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2.5 text-[17px] font-semibold">
              <BookMarked className="size-5 text-attenue" /> {t('accueil.baremesSurveiller')}
            </h2>
            <Link to="/baremes" className="flex items-center gap-1 text-[12.5px] font-medium text-accent-texte hover:underline">
              {t('accueil.voirBaremes')} <ChevronRight className="size-3.5" />
            </Link>
          </div>
          <ul className="mt-4 space-y-2">
            {baremes.isLoading && <Squelette className="h-40" />}
            {baremes.data && aSurveiller.length === 0 && <li className="py-10 text-center text-sm text-attenue">{t('accueil.tousAJour')}</li>}
            {aSurveiller.slice(0, 5).map((b, i) => {
              const a = apparence(b.moteur);
              const nb = b.versions.filter((v) => v.statut === 'a_verifier').length;
              return (
                <li key={b.code} className="animate-montee" style={{ animationDelay: `${200 + i * 50}ms` }}>
                  <Link to="/baremes" className="flex items-center gap-3 rounded-2xl border border-bordure bg-surface-2 p-2.5 pr-3.5 transition-all duration-300 hover:-translate-y-0.5 hover:border-accent/40">
                    <span className="grid size-10 shrink-0 place-items-center rounded-xl" style={pastille(a.teinte)}>
                      <a.icone className="size-4" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium">{b.libelle}</span>
                      <span className="block truncate font-mono text-[11px] text-attenue">{b.code}</span>
                    </span>
                    {b.obsolete ? (
                      <Badge ton="alerte">
                        <CalendarClock className="size-3" /> {t('baremes.aMettreAJour')}
                      </Badge>
                    ) : (
                      <Badge ton="alerte">{t('baremes.aVerifier')} · {t('accueil.versions', { n: nb })}</Badge>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </Carte>
      </section>

      {/* Moteurs */}
      <section>
        <div className="mb-4">
          <h2 className="text-[20px] font-semibold">{t('accueil.moteurs')}</h2>
          <p className="text-[13px] text-attenue">{t('accueil.moteursSous')}</p>
        </div>
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <Squelette key={i} className="h-40" />)}</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {moteurs.map((m, i) => {
              const a = apparence(m.code);
              const utilise = s?.parMoteur[m.code] ?? 0;
              return (
                <Link key={m.code} to={`/moteur/${m.code}`} className="group carte souleve relative overflow-hidden p-5 animate-montee" style={{ animationDelay: `${200 + i * 35}ms` }}>
                  <div className="pointer-events-none absolute -right-10 -top-10 size-32 rounded-full opacity-60 blur-2xl transition-opacity duration-500 group-hover:opacity-100" style={{ background: `hsl(${a.teinte} 85% 60% / .22)` }} />
                  <div className="relative flex items-start justify-between">
                    <span className="grid size-11 place-items-center rounded-2xl transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-3" style={pastille(a.teinte)}>
                      <a.icone className="size-5" />
                    </span>
                    <ArrowUpRight className="size-4 text-attenue transition-all duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-texte" />
                  </div>
                  <h3 className="relative mt-4 font-semibold">{nomMoteur(m)}</h3>
                  <p className="relative mt-1 line-clamp-2 text-[13px] text-attenue">{descriptionMoteur(m)}</p>
                  <div className="relative mt-4 flex items-center gap-2 text-[12px]">
                    <Badge>
                      <Zap className="size-3" /> {t('accueil.formules', { n: m.formules.length })}
                    </Badge>
                    {utilise > 0 && <Badge ton="accent">{t('accueil.calculs', { n: utilise })}</Badge>}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
