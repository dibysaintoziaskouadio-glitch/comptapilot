import { useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowRight, Search, XCircle } from 'lucide-react';
import { useCatalogue } from '@/hooks/useDonnees';
import { Badge, Carte, Champ, Squelette, Vide } from '@/components/ui';
import { apparence, pastille } from '@/lib/moteurs';

export function PageMoteur() {
  const { moteur = '' } = useParams();
  const { moteurs, isLoading } = useCatalogue();
  const [q, setQ] = useState('');
  const m = moteurs.find((x) => x.code === moteur);
  const groupes = useMemo(() => {
    if (!m) return [];
    const n = q.toLowerCase();
    const fs = m.formules.filter((f) => !n || `${f.nom} ${f.description} ${f.categorie}`.toLowerCase().includes(n));
    return [...new Set(fs.map((f) => f.categorie))].map((c) => ({ categorie: c, formules: fs.filter((f) => f.categorie === c) }));
  }, [m, q]);
  if (isLoading) return <Squelette className="h-96" />;
  if (!m) return <Vide icone={<XCircle />} titre="Moteur introuvable" />;
  const a = apparence(m.code);
  return (
    <div className="space-y-8 animate-apparition">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex items-center gap-4">
          <span className="grid size-14 place-items-center rounded-2xl" style={pastille(a.teinte)}>
            <a.icone className="size-7" />
          </span>
          <div>
            <p className="font-mono text-[12px] text-attenue">moteurs/src/{m.dossier}</p>
            <h1 className="text-[28px] font-bold tracking-tight">{m.nom}</h1>
            <p className="text-[14px] text-attenue">{m.description}</p>
          </div>
        </div>
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-attenue" />
          <Champ value={q} onChange={(e) => setQ(e.target.value)} placeholder={`Filtrer les ${m.formules.length} formules`} className="pl-9" />
        </div>
      </div>
      {groupes.map((g) => (
        <section key={g.categorie}>
          <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-attenue">{g.categorie}</h2>
          <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {g.formules.map((f) => (
              <Link key={f.id} to={`/calcul/${m.code}/${f.id}`} className="group">
                <Carte className="flex h-full flex-col p-4 transition-all group-hover:-translate-y-0.5 group-hover:border-accent/40 group-hover:shadow-flottant">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-semibold leading-snug">{f.nom}</h3>
                    <ArrowRight className="mt-0.5 size-4 shrink-0 text-attenue transition-transform group-hover:translate-x-0.5 group-hover:text-accent-texte" />
                  </div>
                  <p className="mt-1.5 line-clamp-2 text-[13px] text-attenue">{f.description}</p>
                  <p className="mt-3 line-clamp-2 rounded-lg bg-surface-2 px-2.5 py-1.5 font-mono text-[11px] text-attenue">{f.expression}</p>
                  <div className="mt-auto flex flex-wrap gap-1.5 pt-3">
                    <Badge>{f.champs.length} entrées</Badge>
                    <Badge>{f.references.length} réf.</Badge>
                    {f.baremes.length > 0 && <Badge ton="accent">barèmes</Badge>}
                  </div>
                </Carte>
              </Link>
            ))}
          </div>
        </section>
      ))}
      {groupes.length === 0 && <Vide icone={<Search />} titre="Aucune formule" texte={`Aucun résultat pour « ${q} ».`} />}
    </div>
  );
}
