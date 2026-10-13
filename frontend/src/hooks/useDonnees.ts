import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { DescriptionFormule, DescriptionMoteur, Utilisateur } from '@/lib/types';

/** Requête de session, partagée par les pages protégées et le fournisseur de préférences. */
export const requeteSession = {
  queryKey: ['session'],
  queryFn: () => api<{ utilisateur: Utilisateur }>('/auth/moi'),
  retry: false,
  staleTime: 5 * 60_000,
} as const;

export function useSession() {
  return useQuery(requeteSession);
}

export function useCatalogue() {
  const q = useQuery({
    queryKey: ['catalogue'],
    queryFn: () => api<{ moteurs: DescriptionMoteur[] }>('/calc/catalogue'),
    staleTime: Infinity,
  });
  const moteurs = q.data?.moteurs ?? [];
  const formules: DescriptionFormule[] = moteurs.flatMap((m) => m.formules);
  return { ...q, moteurs, formules };
}

export interface Statistiques {
  total: number;
  valides: number;
  alertes: number;
  parMoteur: Record<string, number>;
  parJour: { jour: string; n: number }[];
}

export const useStatistiques = () => useQuery({ queryKey: ['historique', 'stats'], queryFn: () => api<Statistiques>('/historique/statistiques') });
