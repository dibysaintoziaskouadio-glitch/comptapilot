import { useState } from 'react';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, ChevronRight, ScrollText, Users } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import type { CompteAdmin, EvenementCompte } from '@/lib/types';
import { useSession } from '@/hooks/useDonnees';
import { Badge, Bouton, Carte, Dialogue, Interrupteur, Onglets, Squelette, Vide } from '@/components/ui';
import { dateHeure, locale } from '@/lib/format';
import { cn } from '@/lib/utils';
import { useT } from '@/lib/i18n';
import type { Cle } from '@/lib/i18n/dictionnaires';

/** « il y a 3 min », « il y a 2 j » dans la langue de l'interface. */
function depuis(iso: string): string {
  const s = Math.round((Date.parse(iso) - Date.now()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(locale(), { numeric: 'auto' });
  if (Math.abs(s) < 60) return rtf.format(s, 'second');
  if (Math.abs(s) < 3600) return rtf.format(Math.round(s / 60), 'minute');
  if (Math.abs(s) < 86400) return rtf.format(Math.round(s / 3600), 'hour');
  return rtf.format(Math.round(s / 86400), 'day');
}

const ROLES = ['ADMIN', 'COMPTABLE', 'LECTEUR'] as const;

function Comptes() {
  const { t, erreur } = useT();
  const { data: session } = useSession();
  const qc = useQueryClient();
  const [aDesactiver, setADesactiver] = useState<CompteAdmin | null>(null);
  // Rafraîchie toutes les 30 s : la colonne « Activité » reste à jour sans recharger la page.
  const liste = useQuery({ queryKey: ['admin', 'utilisateurs'], queryFn: () => api<{ utilisateurs: CompteAdmin[] }>('/admin/utilisateurs'), refetchInterval: 30_000 });
  const maj = useMutation({
    mutationFn: ({ id, ...d }: { id: string; role?: CompteAdmin['role']; actif?: boolean }) => api(`/admin/utilisateurs/${id}`, { method: 'PATCH', json: d }),
    onSuccess: (_x, v) => {
      qc.invalidateQueries({ queryKey: ['admin'] });
      toast.success(t(v.role ? 'admin.toastRole' : v.actif ? 'admin.toastActive' : 'admin.toastDesactive'));
    },
    onError: (e) => toast.error(erreur(e)),
  });
  const comptes = liste.data?.utilisateurs ?? [];
  const enLigne = comptes.filter((u) => u.enLigne).length;

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Badge ton="accent">{t('admin.total', { n: comptes.length })}</Badge>
        <Badge ton="succes">
          <span className="size-1.5 rounded-full bg-succes" /> {t('admin.enLigne', { n: enLigne })}
        </Badge>
      </div>
      <Carte className="overflow-hidden">
        {liste.isLoading ? (
          <Squelette className="m-4 h-64" />
        ) : (
          <div className="overflow-x-auto barre-defilement">
            <table className="w-full min-w-[920px] text-[13px]">
              <thead className="bg-surface-2 text-left text-[11.5px] text-attenue">
                <tr>
                  <th className="px-4 py-2.5 font-medium">{t('admin.colCompte')}</th>
                  <th className="px-4 py-2.5 font-medium">{t('admin.colRole')}</th>
                  <th className="px-4 py-2.5 font-medium">{t('admin.colActivite')}</th>
                  <th className="px-4 py-2.5 font-medium">{t('admin.colConnexion')}</th>
                  <th className="px-4 py-2.5 font-medium">{t('admin.colInscription')}</th>
                  <th className="px-4 py-2.5 text-right font-medium">{t('admin.colCalculs')}</th>
                  <th className="px-4 py-2.5 font-medium">{t('admin.colActif')}</th>
                </tr>
              </thead>
              <tbody>
                {comptes.map((u) => {
                  const moi = u.id === session?.utilisateur.id;
                  return (
                    <tr key={u.id} className={cn('border-t border-bordure hover:bg-surface-2', !u.actif && 'opacity-60')}>
                      <td className="px-4 py-3">
                        <p className="font-medium">
                          {u.nom} {moi && <span className="text-[11.5px] font-normal text-attenue">({t('admin.vous')})</span>}
                        </p>
                        <p className="text-[11.5px] text-attenue">
                          {u.email}
                          {u.telephone && ` · ${u.telephone}`}
                        </p>
                        {!u.confirme && <Badge ton="alerte" className="mt-1">{t('admin.nonConfirme')}</Badge>}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          value={u.role}
                          disabled={moi || maj.isPending}
                          onChange={(e) => maj.mutate({ id: u.id, role: e.target.value as CompteAdmin['role'] })}
                          className="h-9 rounded-xl border border-bordure bg-surface px-2 text-[13px] disabled:opacity-60"
                          aria-label={t('admin.colRole')}
                        >
                          {ROLES.map((r) => (
                            <option key={r} value={r}>
                              {t(`role.${r}`)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {!u.actif ? (
                          <Badge ton="danger">{t('admin.statutDesactive')}</Badge>
                        ) : u.enLigne ? (
                          <Badge ton="succes">
                            <span className="size-1.5 animate-pulse rounded-full bg-succes" /> {t('admin.statutEnLigne')}
                          </Badge>
                        ) : (
                          <span className="text-attenue">{u.derniereActivite ? depuis(u.derniereActivite) : t('admin.jamais')}</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-attenue">{u.derniereConnexion ? dateHeure(u.derniereConnexion) : t('admin.jamais')}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-attenue">{dateHeure(u.creeLe)}</td>
                      <td className="px-4 py-3 text-right chiffre">{u.nbCalculs}</td>
                      <td className="px-4 py-3">
                        {!moi && <Interrupteur actif={u.actif} libelle={t('admin.colActif')} onChange={(v) => (v ? maj.mutate({ id: u.id, actif: true }) : setADesactiver(u))} />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Carte>
      <Dialogue ouvert={!!aDesactiver} onFermer={() => setADesactiver(null)} titre={t('admin.evt.COMPTE_DESACTIVE')}>
        <p className="text-[14px] text-attenue">{t('admin.confirmerDesactivation', { nom: aDesactiver?.nom ?? '' })}</p>
        <div className="mt-5 flex justify-end gap-2">
          <Bouton onClick={() => setADesactiver(null)}>{t('admin.annuler')}</Bouton>
          <Bouton
            variante="danger"
            chargement={maj.isPending}
            onClick={() => {
              if (aDesactiver) maj.mutate({ id: aDesactiver.id, actif: false }, { onSettled: () => setADesactiver(null) });
            }}
          >
            {t('admin.evt.COMPTE_DESACTIVE')}
          </Bouton>
        </div>
      </Dialogue>
    </>
  );
}

function Journal() {
  const { t } = useT();
  const [page, setPage] = useState(1);
  const liste = useQuery({
    queryKey: ['admin', 'connexions', page],
    queryFn: () => api<{ evenements: EvenementCompte[]; total: number }>(`/admin/connexions?page=${page}&parPage=50`),
    placeholderData: keepPreviousData,
    refetchInterval: 30_000,
  });
  const pages = Math.max(1, Math.ceil((liste.data?.total ?? 0) / 50));
  return (
    <Carte className="overflow-hidden">
      {liste.isLoading ? (
        <Squelette className="m-4 h-64" />
      ) : !liste.data?.evenements.length ? (
        <Vide icone={<ScrollText className="size-5" />} titre={t('admin.aucunEvenement')} />
      ) : (
        <div className="overflow-x-auto barre-defilement">
          <table className="w-full min-w-[760px] text-[13px]">
            <thead className="bg-surface-2 text-left text-[11.5px] text-attenue">
              <tr>
                <th className="px-4 py-2.5 font-medium">{t('admin.colDate')}</th>
                <th className="px-4 py-2.5 font-medium">{t('admin.colEvenement')}</th>
                <th className="px-4 py-2.5 font-medium">{t('admin.colDetail')}</th>
                <th className="px-4 py-2.5 font-medium">{t('admin.colPar')}</th>
                <th className="px-4 py-2.5 font-medium">{t('admin.colIp')}</th>
              </tr>
            </thead>
            <tbody>
              {liste.data.evenements.map((e) => {
                const ton = e.action === 'CONNEXION_ECHOUEE' || e.action === 'COMPTE_DESACTIVE' ? 'danger' : e.action === 'CONNEXION' ? 'succes' : 'neutre';
                return (
                  <tr key={e.id} className="border-t border-bordure hover:bg-surface-2">
                    <td className="whitespace-nowrap px-4 py-2.5 text-attenue">{dateHeure(e.creeLe)}</td>
                    <td className="px-4 py-2.5">
                      <Badge ton={ton}>{t(`admin.evt.${e.action}` as Cle)}</Badge>
                      {e.action === 'CHANGEMENT_ROLE' && e.details?.vers && <span className="ml-2 text-[11.5px] text-attenue">→ {t(`role.${e.details.vers}` as Cle)}</span>}
                    </td>
                    <td className="px-4 py-2.5">{e.cible ?? '—'}</td>
                    <td className="px-4 py-2.5 text-attenue">{e.utilisateur?.nom ?? '—'}</td>
                    <td className="px-4 py-2.5 font-mono text-[12px] text-attenue">{e.details?.ip ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {pages > 1 && (
        <div className="flex items-center justify-end gap-2 border-t border-bordure px-4 py-3">
          <Bouton taille="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
            <ChevronLeft className="size-4" />
          </Bouton>
          <Bouton taille="sm" disabled={page >= pages} onClick={() => setPage(page + 1)}>
            <ChevronRight className="size-4" />
          </Bouton>
        </div>
      )}
    </Carte>
  );
}

export function PageUtilisateurs() {
  const { t } = useT();
  const [onglet, setOnglet] = useState<'comptes' | 'journal'>('comptes');
  return (
    <div className="space-y-6 animate-apparition">
      <div>
        <h1 className="flex items-center gap-2.5 text-[28px] font-bold tracking-tight">
          <Users className="size-7 text-accent" /> {t('admin.titre')}
        </h1>
        <p className="text-[14px] text-attenue">{t('admin.sousTitre')}</p>
      </div>
      <Onglets
        valeur={onglet}
        onChange={setOnglet}
        onglets={[
          { id: 'comptes', libelle: t('admin.comptes') },
          { id: 'journal', libelle: t('admin.journal') },
        ]}
      />
      {onglet === 'comptes' ? <Comptes /> : <Journal />}
    </div>
  );
}
