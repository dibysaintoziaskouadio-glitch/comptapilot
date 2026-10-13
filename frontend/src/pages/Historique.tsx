import { useState } from 'react';
import { Link } from 'react-router-dom';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, BadgeCheck, ChevronLeft, ChevronRight, ExternalLink, History, Search, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import type { CalculResume } from '@/lib/types';
import { useCatalogue } from '@/hooks/useDonnees';
import { useDebounce } from '@/hooks/useDebounce';
import { Badge, Bouton, Carte, Champ, Squelette, Vide } from '@/components/ui';
import { apparence, pastille } from '@/lib/moteurs';
import { dateHeure, valeur } from '@/lib/format';
import { useT } from '@/lib/i18n';

export function PageHistorique() {
  const { moteurs } = useCatalogue();
  const { t, nomMoteur, erreur } = useT();
  const [moteur, setMoteur] = useState('');
  const [statut, setStatut] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const qd = useDebounce(q, 300);
  const qc = useQueryClient();
  const params = new URLSearchParams({ page: String(page), parPage: '20', ...(moteur && { moteur }), ...(statut && { statut }), ...(qd && { q: qd }) });
  const liste = useQuery({ queryKey: ['historique', 'liste', params.toString()], queryFn: () => api<{ calculs: CalculResume[]; total: number }>(`/historique?${params}`), placeholderData: keepPreviousData });
  const action = useMutation({
    mutationFn: ({ id, type }: { id: string; type: 'valider' | 'supprimer' }) => (type === 'valider' ? api(`/historique/${id}`, { method: 'PATCH', json: { valider: true } }) : api(`/historique/${id}`, { method: 'DELETE' })),
    onSuccess: (_x, v) => {
      qc.invalidateQueries({ queryKey: ['historique'] });
      toast.success(t(v.type === 'valider' ? 'historique.toastValide' : 'historique.toastSupprime'));
    },
    onError: (e) => toast.error(erreur(e)),
  });
  const pages = Math.max(1, Math.ceil((liste.data?.total ?? 0) / 20));
  const select = 'h-10 rounded-xl border border-bordure bg-surface px-3 text-sm';

  return (
    <div className="space-y-6 animate-apparition">
      <div>
        <h1 className="text-[28px] font-bold tracking-tight">{t('historique.titre')}</h1>
        <p className="text-[14px] text-attenue">{t('historique.sousTitre')}</p>
      </div>
      <Carte className="flex flex-wrap gap-3 p-3">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 z-10 size-4 -translate-y-1/2 text-attenue" />
          <Champ value={q} onChange={(e) => (setQ(e.target.value), setPage(1))} placeholder={t('historique.recherche')} className="pl-9" />
        </div>
        <select value={moteur} onChange={(e) => (setMoteur(e.target.value), setPage(1))} className={select} aria-label={t('historique.moteur')}>
          <option value="">{t('historique.tousMoteurs')}</option>
          {moteurs.map((m) => (
            <option key={m.code} value={m.code}>
              {nomMoteur(m)}
            </option>
          ))}
        </select>
        <select value={statut} onChange={(e) => (setStatut(e.target.value), setPage(1))} className={select} aria-label={t('historique.statut')}>
          <option value="">{t('historique.tousStatuts')}</option>
          <option value="BROUILLON">{t('historique.brouillons')}</option>
          <option value="VALIDE">{t('historique.valides')}</option>
        </select>
      </Carte>
      <Carte className="overflow-hidden">
        {liste.isLoading ? (
          <Squelette className="m-4 h-64" />
        ) : liste.data?.calculs.length === 0 ? (
          <Vide icone={<History className="size-5" />} titre={t('historique.aucun')} texte={t('historique.aucunTexte')} />
        ) : (
          <div className="overflow-x-auto barre-defilement">
            <table className="w-full min-w-[820px] text-[13px]">
              <thead className="bg-surface-2 text-left text-[11.5px] text-attenue">
                <tr>
                  <th className="px-4 py-2.5 font-medium">{t('historique.colCalcul')}</th>
                  <th className="px-4 py-2.5 font-medium">{t('historique.colResultat')}</th>
                  <th className="px-4 py-2.5 font-medium">{t('historique.colControles')}</th>
                  <th className="px-4 py-2.5 font-medium">{t('historique.colStatut')}</th>
                  <th className="px-4 py-2.5 font-medium">{t('historique.colDate')}</th>
                  <th className="px-4 py-2.5" />
                </tr>
              </thead>
              <tbody>
                {liste.data?.calculs.map((c) => {
                  const a = apparence(c.moteur);
                  return (
                    <tr key={c.id} className="border-t border-bordure hover:bg-surface-2">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="grid size-8 shrink-0 place-items-center rounded-lg" style={pastille(a.teinte)}>
                            <a.icone className="size-3.5" />
                          </span>
                          <div className="min-w-0">
                            <p className="truncate font-medium">{c.libelle || c.formuleNom}</p>
                            <p className="truncate text-[11.5px] text-attenue">
                              {c.formuleNom} · v{c.formuleVersion} · <span className="font-mono">{c.empreinte.slice(0, 10)}</span>
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        {c.principalValeur !== null ? (
                          <>
                            <p className="font-semibold chiffre">{valeur(c.principalValeur, c.principalUnite ?? undefined, c.devise)}</p>
                            <p className="text-[11.5px] text-attenue">{c.principal}</p>
                          </>
                        ) : (
                          <span className="chiffre">{c.principal}</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {c.nbErreurs > 0 ? <Badge ton="danger">{t('historique.erreurs', { n: c.nbErreurs })}</Badge> : c.nbAvertissements > 0 ? <Badge ton="alerte"><AlertTriangle className="size-3" /> {c.nbAvertissements}</Badge> : <Badge ton="succes">{t('historique.conforme')}</Badge>}
                      </td>
                      <td className="px-4 py-3">{c.statut === 'VALIDE' ? <Badge ton="succes"><BadgeCheck className="size-3" /> {t('statut.VALIDE')}</Badge> : <Badge>{t('statut.BROUILLON')}</Badge>}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-attenue">{dateHeure(c.creeLe)}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <Link to={`/calcul/${c.moteur}/${c.formuleId}?calcul=${c.id}`} className="rounded-lg p-2 text-attenue hover:bg-surface-2 hover:text-texte" title={t('historique.rouvrir')}>
                            <ExternalLink className="size-4" />
                          </Link>
                          {c.statut === 'BROUILLON' && (
                            <>
                              <button onClick={() => action.mutate({ id: c.id, type: 'valider' })} disabled={c.nbErreurs > 0} className="rounded-lg p-2 text-attenue hover:bg-succes/10 hover:text-succes disabled:opacity-40" title={t('historique.valider')}>
                                <BadgeCheck className="size-4" />
                              </button>
                              <button onClick={() => action.mutate({ id: c.id, type: 'supprimer' })} className="rounded-lg p-2 text-attenue hover:bg-danger/10 hover:text-danger" title={t('historique.supprimer')}>
                                <Trash2 className="size-4" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {pages > 1 && (
          <div className="flex items-center justify-between border-t border-bordure px-4 py-3 text-[13px] text-attenue">
            <span>
              {t('historique.pagination', { total: liste.data?.total ?? 0, page, pages })}
            </span>
            <div className="flex gap-2">
              <Bouton taille="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                <ChevronLeft className="size-4" />
              </Bouton>
              <Bouton taille="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>
                <ChevronRight className="size-4" />
              </Bouton>
            </div>
          </div>
        )}
      </Carte>
    </div>
  );
}
