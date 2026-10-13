import { useMemo, useState } from 'react';
import { AlertTriangle, BookOpen, CheckCircle2, Copy, FileSpreadsheet, Info, Landmark, ListOrdered, ScrollText, ShieldCheck, Table2, XCircle } from 'lucide-react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { toast } from 'sonner';
import type { Controle, ResultatCalcul, Tableau, ValeurResultat } from '@/lib/types';
import { Badge, Carte, Onglets } from '@/components/ui';
import { duree, valeur as fv, nombre, texteMoteur } from '@/lib/format';
import { useT } from '@/lib/i18n';
import { cn } from '@/lib/utils';

// Séries des graphiques : violet, magenta, cyan, puis couleurs contrastées.
const PALETTE = ['hsl(var(--accent))', 'hsl(var(--magenta))', 'hsl(var(--cyan))', 'hsl(170 65% 42%)', 'hsl(32 92% 52%)', 'hsl(252 80% 62%)', 'hsl(352 75% 58%)'];

function CarteResultat({ cle, v, vedette }: { cle: string; v: ValeurResultat; vedette?: boolean }) {
  const { t } = useT();
  const negatif = v.valeur.startsWith('-');
  return (
    <div
      className={cn(
        'group relative overflow-hidden rounded-2xl border p-4 transition-shadow',
        vedette ? 'border-transparent degrade-accent text-white shadow-[0_14px_40px_-14px_hsl(var(--accent)/.75)]' : 'border-bordure bg-surface shadow-carte',
      )}
    >
      {vedette && <div className="pointer-events-none absolute -right-10 -top-10 size-36 rounded-full bg-white/15 blur-2xl" />}
      <p className={cn('text-[12.5px] font-medium', vedette ? 'text-white/80' : 'text-attenue')}>{texteMoteur(v.libelle)}</p>
      <p className={cn('mt-1.5 break-words font-semibold montant', vedette ? 'text-[28px] leading-tight' : 'text-[22px]', !vedette && negatif && 'text-danger')}>{fv(v.valeur, v.unite)}</p>
      <button
        onClick={() => {
          navigator.clipboard?.writeText(v.valeur);
          toast.success(t('res.copiee'), { description: `${cle} = ${v.valeur}` });
        }}
        className={cn('absolute right-3 top-3 rounded-lg p-1.5 opacity-0 transition-opacity group-hover:opacity-100', vedette ? 'hover:bg-white/15' : 'text-attenue hover:bg-surface-2')}
        aria-label={t('res.copier')}
      >
        <Copy className="size-3.5" />
      </button>
    </div>
  );
}

export function SyntheseResultats({ r }: { r: ResultatCalcul }) {
  useT(); // re-rendu au changement de langue ou de monnaie
  const entrees = Object.entries(r.resultats);
  const principaux = entrees.filter(([, v]) => v.principal);
  const affiches = (principaux.length ? principaux : entrees.slice(0, 3)).slice(0, 4);
  return (
    <div className={cn('grid gap-3', affiches.length >= 3 ? 'sm:grid-cols-2 2xl:grid-cols-3' : 'sm:grid-cols-2')}>
      {affiches.map(([k, v], i) => (
        <CarteResultat key={k} cle={k} v={v} vedette={i === 0} />
      ))}
    </div>
  );
}

function ListeValeurs({ r }: { r: ResultatCalcul }) {
  const { t } = useT();
  const groupes = useMemo(() => {
    const g = new Map<string, [string, ValeurResultat][]>();
    for (const e of Object.entries(r.resultats)) {
      const k = e[1].groupe ?? t('res.groupe');
      g.set(k, [...(g.get(k) ?? []), e]);
    }
    return [...g];
  }, [r, t]);
  return (
    <div className="space-y-5">
      {groupes.map(([g, vs]) => (
        <div key={g}>
          {groupes.length > 1 && <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-attenue">{g}</p>}
          <dl className="divide-y divide-bordure overflow-hidden rounded-xl border border-bordure">
            {vs.map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-4 px-4 py-2.5 hover:bg-surface-2/50">
                <dt className="text-[13px] text-attenue">{texteMoteur(v.libelle)}</dt>
                <dd className={cn('text-right text-[13.5px] font-semibold chiffre', v.unite === 'texte' && 'max-w-[60%] font-medium', v.valeur.startsWith('-') && v.unite === 'EUR' && 'text-danger')}>{fv(v.valeur, v.unite)}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );
}

function Etapes({ r }: { r: ResultatCalcul }) {
  useT();
  return (
    <ol className="relative space-y-3 pl-8 before:absolute before:bottom-3 before:left-[13px] before:top-3 before:w-px before:bg-bordure">
      {r.etapes.map((e, i) => (
        <li key={i} className="relative animate-apparition" style={{ animationDelay: `${Math.min(i, 12) * 25}ms` }}>
          <span className="absolute -left-8 top-2.5 grid size-[27px] place-items-center rounded-full border border-bordure bg-surface text-[11px] font-semibold text-attenue chiffre">{i + 1}</span>
          <div className="rounded-xl border border-bordure bg-surface p-3">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <p className="text-[13px] font-medium">{texteMoteur(e.libelle)}</p>
              <p className="text-[14px] font-semibold text-accent-texte chiffre">{texteMoteur(e.valeur)}</p>
            </div>
            <p className="mt-1.5 rounded-lg bg-surface-2 px-2.5 py-1.5 font-mono text-[11.5px] leading-relaxed text-attenue">{texteMoteur(e.formule)}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

function Graphique({ t }: { t: Tableau }) {
  useT();
  const g = t.graphique!;
  const donnees = t.lignes.map((l) => ({ ...Object.fromEntries(g.series.map((s) => [s, Number(l[s] ?? 0)])), [g.x]: l[g.x] }));
  const nom = (s: string) => texteMoteur(t.colonnes.find((c) => c.cle === s)?.libelle ?? s);
  const axe = { stroke: 'hsl(var(--attenue))', fontSize: 11, tickLine: false, axisLine: false } as const;
  const commun = (
    <>
      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--bordure))" vertical={false} />
      <XAxis dataKey={g.x} {...axe} />
      <YAxis {...axe} width={70} tickFormatter={(v: number) => nombre(String(Math.round(v)))} />
      <Tooltip
        contentStyle={{ background: 'hsl(var(--surface))', border: '1px solid hsl(var(--bordure))', borderRadius: 12, fontSize: 12 }}
        formatter={(v: number, n: string) => [nombre(String(v), 0, 2), nom(n)]}
      />
      {g.series.length > 1 && <Legend formatter={nom} wrapperStyle={{ fontSize: 12 }} />}
    </>
  );
  return (
    <div className="h-64">
      <ResponsiveContainer>
        {g.type === 'lignes' ? (
          <LineChart data={donnees}>
            {commun}
            {g.series.map((s, i) => (
              <Line key={s} type="monotone" dataKey={s} stroke={PALETTE[i % PALETTE.length]} strokeWidth={2.2} dot={false} />
            ))}
          </LineChart>
        ) : g.type === 'aires' ? (
          <AreaChart data={donnees}>
            {commun}
            {g.series.map((s, i) => (
              <Area key={s} type="monotone" dataKey={s} stackId="a" stroke={PALETTE[i % PALETTE.length]} fill={PALETTE[i % PALETTE.length]} fillOpacity={0.25} />
            ))}
          </AreaChart>
        ) : (
          <BarChart data={donnees}>
            {commun}
            {g.series.map((s, i) => (
              <Bar key={s} dataKey={s} stackId={g.type === 'barres-empilees' ? 'a' : undefined} fill={PALETTE[i % PALETTE.length]} radius={g.type === 'barres-empilees' ? 0 : [6, 6, 0, 0]} maxBarSize={44} />
            ))}
          </BarChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}

/** Export CSV : séparateur « ; » et virgule décimale en français, « , » et point en anglais (ouverture directe dans un tableur). */
function exporterCsv(t: Tableau, langue: 'fr' | 'en') {
  const sep = langue === 'fr' ? ';' : ',';
  const ligne = (vals: string[]) => vals.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(sep);
  const nb = (v: string) => (langue === 'fr' ? v.replace('.', ',') : v);
  const csv = [ligne(t.colonnes.map((c) => texteMoteur(c.libelle))), ...t.lignes.map((l) => ligne(t.colonnes.map((c) => (c.unite === 'texte' || c.unite === 'date' ? l[c.cle] : nb(l[c.cle] ?? '')))))].join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }));
  a.download = `${t.titre.replace(/[^\p{L}\d]+/gu, '-').toLowerCase()}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function Tableaux({ r }: { r: ResultatCalcul }) {
  const { langue } = useT();
  return (
    <div className="space-y-6">
      {r.tableaux.map((t, i) => (
        <div key={i} className="space-y-3">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-[14px] font-semibold">{texteMoteur(t.titre)}</h4>
            <button onClick={() => exporterCsv(t, langue)} className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-[12px] text-attenue hover:bg-surface-2 hover:text-texte">
              <FileSpreadsheet className="size-3.5" /> CSV
            </button>
          </div>
          {t.graphique && t.lignes.length > 1 && <Graphique t={t} />}
          <div className="max-h-[460px] overflow-auto rounded-xl border border-bordure barre-defilement">
            <table className="w-full text-[12px]">
              <thead className="sticky top-0 bg-surface-2 text-[11.5px] text-attenue">
                <tr>
                  {t.colonnes.map((c) => (
                    <th key={c.cle} className={cn('whitespace-nowrap px-2 py-2 font-medium', c.unite === 'texte' || c.unite === 'date' ? 'text-left' : 'text-right')}>
                      {texteMoteur(c.libelle)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {t.lignes.map((l, k) => (
                  <tr key={k} className="border-t border-bordure hover:bg-surface-2/40">
                    {t.colonnes.map((c) => (
                      <td key={c.cle} className={cn('px-2 py-1.5 chiffre', c.unite === 'texte' || c.unite === 'date' ? 'text-left' : 'whitespace-nowrap text-right')}>
                        {l[c.cle] === undefined || l[c.cle] === '' ? '' : fv(l[c.cle], c.unite)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
              {t.totaux && (
                <tfoot className="border-t-2 border-bordure bg-surface-2/60 font-semibold">
                  <tr>
                    {t.colonnes.map((c) => (
                      <td key={c.cle} className={cn('px-2 py-2 chiffre', c.unite === 'texte' || c.unite === 'date' ? 'text-left' : 'whitespace-nowrap text-right')}>
                        {t.totaux![c.cle] === undefined ? '' : /^-?\d/.test(t.totaux![c.cle]) ? fv(t.totaux![c.cle], c.unite) : texteMoteur(t.totaux![c.cle])}
                      </td>
                    ))}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}

function Ecritures({ r }: { r: ResultatCalcul }) {
  const { t } = useT();
  return (
    <div className="space-y-4">
      {r.ecritures.map((e, i) => {
        const td = e.lignes.reduce((s, l) => s + Number(l.debit ?? 0), 0);
        return (
          <div key={i} className="overflow-hidden rounded-xl border border-bordure">
            <div className="flex items-center justify-between bg-surface-2 px-4 py-2">
              <p className="text-[13px] font-semibold">{e.libelle}</p>
              <Badge>{t('res.journal', { j: e.journal ?? 'OD' })}</Badge>
            </div>
            <table className="w-full text-[12.5px]">
              <thead className="text-[11px] text-attenue">
                <tr>
                  <th className="w-24 px-4 py-1.5 text-left font-medium">{t('res.compte')}</th>
                  <th className="px-2 py-1.5 text-left font-medium">{t('res.intitule')}</th>
                  <th className="w-32 px-4 py-1.5 text-right font-medium">{t('res.debit')}</th>
                  <th className="w-32 px-4 py-1.5 text-right font-medium">{t('res.credit')}</th>
                </tr>
              </thead>
              <tbody>
                {e.lignes.map((l, k) => (
                  <tr key={k} className="border-t border-bordure">
                    <td className={cn('px-4 py-1.5 font-mono', l.credit && 'pl-8')}>{l.compte}</td>
                    <td className={cn('px-2 py-1.5', l.credit && 'pl-6 text-attenue')}>{l.intitule}</td>
                    <td className="px-4 py-1.5 text-right chiffre">{l.debit ? fv(l.debit, 'EUR') : ''}</td>
                    <td className="px-4 py-1.5 text-right chiffre">{l.credit ? fv(l.credit, 'EUR') : ''}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="border-t border-bordure bg-surface-2/50 font-semibold">
                <tr>
                  <td colSpan={2} className="px-4 py-1.5 text-[11.5px] text-succes">
                    <span className="inline-flex items-center gap-1">
                      <CheckCircle2 className="size-3.5" /> {t('res.equilibree')}
                    </span>
                  </td>
                  <td className="px-4 py-1.5 text-right chiffre">{fv(td.toFixed(2), 'EUR')}</td>
                  <td className="px-4 py-1.5 text-right chiffre">{fv(td.toFixed(2), 'EUR')}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        );
      })}
    </div>
  );
}

const ICONES_CONTROLE = {
  ok: { icone: CheckCircle2, cls: 'text-succes bg-succes/10 border-succes/25' },
  info: { icone: Info, cls: 'text-info bg-info/10 border-info/25' },
  avertissement: { icone: AlertTriangle, cls: 'text-alerte bg-alerte/10 border-alerte/25' },
  erreur: { icone: XCircle, cls: 'text-danger bg-danger/10 border-danger/25' },
};

export function ListeControles({ controles }: { controles: Controle[] }) {
  useT();
  const ordre = { erreur: 0, avertissement: 1, info: 2, ok: 3 };
  return (
    <ul className="space-y-2">
      {[...controles]
        .sort((a, b) => ordre[a.niveau] - ordre[b.niveau])
        .map((c, i) => {
          const s = ICONES_CONTROLE[c.niveau];
          return (
            <li key={i} className={cn('flex gap-2.5 rounded-xl border px-3 py-2.5 text-[13px]', s.cls)}>
              <s.icone className="mt-0.5 size-4 shrink-0" />
              <span className="text-texte">{texteMoteur(c.message)}</span>
            </li>
          );
        })}
    </ul>
  );
}

function References({ r }: { r: ResultatCalcul }) {
  const { t } = useT();
  return (
    <div className="space-y-5">
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-attenue">{t('res.formule')}</p>
        <p className="rounded-xl bg-surface-2 p-3 font-mono text-[12px] leading-relaxed">{r.formule.expression}</p>
        <p className="mt-2 text-[12px] text-attenue">
          {t('res.formuleDetail', { id: `${r.formule.moteur}/${r.formule.id}`, v: r.formule.version, ms: duree(r.dureeMs) })}
        </p>
      </div>
      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-attenue">{t('res.refsLegales')}</p>
        <ul className="space-y-1.5">
          {r.references.map((x, i) => (
            <li key={i} className="flex gap-2 text-[13px]">
              <Landmark className="mt-0.5 size-3.5 shrink-0 text-accent-texte" />
              {x.url ? (
                <a href={x.url} target="_blank" rel="noreferrer" className="underline decoration-dotted underline-offset-2 hover:text-accent-texte">
                  {x.texte}
                </a>
              ) : (
                x.texte
              )}
            </li>
          ))}
        </ul>
      </div>
      {r.baremes.length > 0 && (
        <div>
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-attenue">{t('res.baremesAppliques')}</p>
          <ul className="space-y-2">
            {r.baremes.map((b) => (
              <li key={b.code + b.du} className="rounded-xl border border-bordure p-3 text-[12.5px]">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{b.libelle}</span>
                  <Badge ton={b.statut === 'officiel' ? 'succes' : 'alerte'}>{t(b.statut === 'officiel' ? 'res.officiel' : 'res.aVerifier')}</Badge>
                </div>
                <p className="mt-1 text-attenue">
                  {t('res.versionDu', { du: fv(b.du, 'date') })}
                  {b.au ? t('res.versionAu', { au: fv(b.au, 'date') }) : ''} — {b.source}
                </p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

type Vue = 'valeurs' | 'etapes' | 'tableaux' | 'ecritures' | 'controles' | 'references';

export function DetailResultats({ r }: { r: ResultatCalcul }) {
  const [vue, setVue] = useState<Vue>('valeurs');
  const { t } = useT();
  const alertes = r.controles.filter((c) => c.niveau === 'erreur' || c.niveau === 'avertissement').length;
  const onglets: { id: Vue; libelle: React.ReactNode; compte?: number }[] = [
    { id: 'valeurs', libelle: <><ListOrdered className="size-3.5" /> {t('res.ongletValeurs')}</>, compte: Object.keys(r.resultats).length },
    { id: 'etapes', libelle: <><ScrollText className="size-3.5" /> {t('res.ongletEtapes')}</>, compte: r.etapes.length },
    ...(r.tableaux.length ? [{ id: 'tableaux' as Vue, libelle: <><Table2 className="size-3.5" /> {t('res.ongletTableaux')}</>, compte: r.tableaux.length }] : []),
    ...(r.ecritures.length ? [{ id: 'ecritures' as Vue, libelle: <><BookOpen className="size-3.5" /> {t('res.ongletEcritures')}</>, compte: r.ecritures.length }] : []),
    { id: 'controles', libelle: <><ShieldCheck className="size-3.5" /> {t('res.ongletControles')}</>, compte: alertes },
    { id: 'references', libelle: <><Landmark className="size-3.5" /> {t('res.ongletReferences')}</> },
  ];
  const vueActive = onglets.some((o) => o.id === vue) ? vue : 'valeurs';
  return (
    <Carte className="p-4 sm:p-5">
      <Onglets valeur={vueActive} onChange={setVue} onglets={onglets} />
      <div className="mt-5">
        {vueActive === 'valeurs' && <ListeValeurs r={r} />}
        {vueActive === 'etapes' && <Etapes r={r} />}
        {vueActive === 'tableaux' && <Tableaux r={r} />}
        {vueActive === 'ecritures' && <Ecritures r={r} />}
        {vueActive === 'controles' && <ListeControles controles={r.controles} />}
        {vueActive === 'references' && <References r={r} />}
      </div>
    </Carte>
  );
}
