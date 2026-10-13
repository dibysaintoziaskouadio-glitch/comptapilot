import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, BadgeCheck, BookMarked, Calculator, ShieldAlert, Sparkles, Zap } from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { CalculResume } from '@/lib/types';
import { useCatalogue, useSession, useStatistiques } from '@/hooks/useDonnees';
import { Badge, Carte, Squelette } from '@/components/ui';
import { apparence, pastille } from '@/lib/moteurs';
import { dateCourte, dateHeure } from '@/lib/format';
import { OndeFluide } from '@/components/OndeFluide';

const RACCOURCIS: [string, string][] = [
  ['tva', 'ht-ttc'],
  ['paie', 'bulletin'],
  ['financier', 'etats-depuis-balance'],
  ['tresorerie', 'emprunt'],
  ['amortissements', 'lineaire'],
  ['investissement', 'van-tri'],
  ['fiscal', 'impot-societes'],
  ['tva', 'ca3'],
];

function Kpi({ icone, libelle, valeur, detail }: { icone: React.ReactNode; libelle: string; valeur: React.ReactNode; detail?: string }) {
  return (
    <Carte className="p-5">
      <div className="flex items-center justify-between">
        <p className="text-[13px] font-medium text-attenue">{libelle}</p>
        <div className="grid size-9 place-items-center rounded-xl bg-accent-doux text-accent-texte">{icone}</div>
      </div>
      <p className="mt-3 text-3xl font-semibold montant">{valeur}</p>
      {detail && <p className="mt-1 text-[12px] text-attenue">{detail}</p>}
    </Carte>
  );
}

export function PageTableauDeBord() {
  const { moteurs, formules, isLoading } = useCatalogue();
  const { data: session } = useSession();
  const stats = useStatistiques();
  const recents = useQuery({ queryKey: ['historique', 'recents'], queryFn: () => api<{ calculs: CalculResume[] }>('/historique?parPage=6') });
  const baremes = useQuery({ queryKey: ['baremes'], queryFn: () => api<{ baremes: { obsolete: boolean; versions: { statut: string }[] }[] }>('/baremes') });
  const aVerifier = baremes.data?.baremes.filter((b) => b.obsolete || b.versions.some((v) => v.statut === 'a_verifier')).length ?? 0;
  const heure = new Date().getHours();
  // Référence stable : un nouveau tableau à chaque rendu relancerait l'animation du graphique.
  const activite = useMemo(() => stats.data?.parJour.map((x) => ({ ...x, jour: dateCourte(x.jour) })), [stats.data]);

  return (
    <div className="space-y-8 animate-apparition">
      <section className="relative overflow-hidden rounded-[22px] degrade-accent p-6 text-white shadow-[0_24px_60px_-24px_hsl(var(--accent)/.8)] sm:p-8">
        <OndeFluide className="pointer-events-none absolute inset-0 opacity-70 mix-blend-screen [mask-image:linear-gradient(to_right,transparent_35%,black_80%)]" />
        <div className="pointer-events-none absolute -right-16 -top-24 size-80 rounded-full bg-white/15 blur-3xl animate-derive" />
        <div className="pointer-events-none absolute bottom-0 right-1/3 size-56 rounded-full bg-[#22d3ee]/20 blur-3xl animate-derive [animation-delay:-8s]" />
        <div className="relative flex flex-wrap items-end justify-between gap-6">
          <div className="max-w-2xl">
            <p className="flex items-center gap-2 text-[13px] font-medium text-white/80">
              <Sparkles className="size-4" /> {heure < 18 ? 'Bonjour' : 'Bonsoir'} {session?.utilisateur.nom.split(' ')[0]}
            </p>
            <h1 className="mt-2 text-[28px] font-bold leading-tight tracking-tight sm:text-[34px]">Que voulez-vous faire calculer aujourd’hui ?</h1>
            <p className="mt-2 text-white/80">{formules.length} formules prêtes, réparties en {moteurs.length} moteurs. Saisissez, le moteur calcule, contrôle et documente.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {RACCOURCIS.slice(0, 4).map(([m, f]) => {
              const x = formules.find((y) => y.moteur === m && y.id === f);
              return x ? (
                <Link key={f} to={`/calcul/${m}/${f}`} className="rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-[13px] font-medium backdrop-blur transition-colors hover:bg-white/20">
                  {x.nom}
                </Link>
              ) : null;
            })}
          </div>
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi icone={<Calculator className="size-4" />} libelle="Calculs enregistrés" valeur={stats.data?.total ?? '—'} detail="dans votre journal" />
        <Kpi icone={<BadgeCheck className="size-4" />} libelle="Calculs validés" valeur={stats.data?.valides ?? '—'} detail="archivés, non modifiables" />
        <Kpi icone={<ShieldAlert className="size-4" />} libelle="Avec alertes" valeur={stats.data?.alertes ?? '—'} detail="erreurs ou avertissements" />
        <Kpi icone={<BookMarked className="size-4" />} libelle="Barèmes à surveiller" valeur={baremes.data ? aVerifier : '—'} detail="à confirmer ou à mettre à jour" />
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
        <Carte className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Activité des 14 derniers jours</h2>
            <Badge ton="accent">{stats.data?.parJour.reduce((s, x) => s + x.n, 0) ?? 0} calculs</Badge>
          </div>
          <div className="mt-4 h-48">
            {stats.data ? (
              <ResponsiveContainer>
                <AreaChart data={activite}>
                  <defs>
                    <linearGradient id="degrade" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="jour" stroke="hsl(var(--attenue))" fontSize={11} tickLine={false} axisLine={false} interval="preserveStartEnd" minTickGap={8} />
                  <Tooltip contentStyle={{ background: 'hsl(var(--surface))', border: '1px solid hsl(var(--bordure))', borderRadius: 12, fontSize: 12 }} formatter={(v: number) => [v, 'Calculs']} />
                  <Area type="monotone" dataKey="n" stroke="hsl(var(--accent))" strokeWidth={2.4} fill="url(#degrade)" />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <Squelette className="h-full" />
            )}
          </div>
        </Carte>
        <Carte className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold">Derniers calculs</h2>
            <Link to="/historique" className="text-[12.5px] font-medium text-accent-texte hover:underline">
              Tout voir
            </Link>
          </div>
          <ul className="mt-3 space-y-1">
            {recents.data?.calculs.length === 0 && <li className="py-8 text-center text-sm text-attenue">Aucun calcul enregistré pour l’instant.</li>}
            {recents.data?.calculs.map((c) => {
              const a = apparence(c.moteur);
              return (
                <li key={c.id}>
                  <Link to={`/calcul/${c.moteur}/${c.formuleId}?calcul=${c.id}`} className="flex items-center gap-3 rounded-xl p-2 hover:bg-surface-2">
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg" style={pastille(a.teinte)}>
                      <a.icone className="size-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium">{c.libelle || c.formuleNom}</span>
                      <span className="block truncate text-[11.5px] text-attenue">{dateHeure(c.creeLe)}</span>
                    </span>
                    {c.statut === 'VALIDE' && <BadgeCheck className="size-4 text-succes" />}
                  </Link>
                </li>
              );
            })}
          </ul>
        </Carte>
      </section>

      <section>
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="text-lg font-semibold">Les moteurs de calcul</h2>
            <p className="text-[13px] text-attenue">Autonomes, testés, documentés avec leurs références légales.</p>
          </div>
        </div>
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 6 }, (_, i) => <Squelette key={i} className="h-40" />)}</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {moteurs.map((m, i) => {
              const a = apparence(m.code);
              const utilise = stats.data?.parMoteur[m.code] ?? 0;
              return (
                <Link key={m.code} to={`/moteur/${m.code}`} className="group carte relative overflow-hidden p-5 transition-all hover:-translate-y-0.5 hover:shadow-flottant animate-apparition" style={{ animationDelay: `${i * 30}ms` }}>
                  <div className="pointer-events-none absolute -right-8 -top-8 size-28 rounded-full opacity-60 blur-2xl transition-opacity group-hover:opacity-100" style={{ background: `hsl(${a.teinte} 85% 60% / .18)` }} />
                  <div className="relative flex items-start justify-between">
                    <span className="grid size-11 place-items-center rounded-xl" style={pastille(a.teinte)}>
                      <a.icone className="size-5" />
                    </span>
                    <ArrowUpRight className="size-4 text-attenue transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-texte" />
                  </div>
                  <h3 className="relative mt-4 font-semibold">{m.nom}</h3>
                  <p className="relative mt-1 line-clamp-2 text-[13px] text-attenue">{m.description}</p>
                  <div className="relative mt-4 flex items-center gap-2 text-[12px]">
                    <Badge>
                      <Zap className="size-3" /> {m.formules.length} formules
                    </Badge>
                    {utilise > 0 && <Badge ton="accent">{utilise} calcul{utilise > 1 ? 's' : ''}</Badge>}
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
