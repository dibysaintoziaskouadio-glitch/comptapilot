/**
 * Préférences de langue et de monnaie.
 * Avant connexion : lues dans le navigateur (localStorage, puis langue du navigateur).
 * Après connexion : celles du compte (GET /auth/moi), modifiables par PATCH /auth/preferences.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ErreurApi } from '@/lib/api';
import { configurerFormat } from '@/lib/format';
import { CODES_DEVISES } from '@/lib/devises';
import type { DescriptionMoteur, Utilisateur } from '@/lib/types';
import { requeteSession } from '@/hooks/useDonnees';
import { en, fr, MOTEURS_EN, type Cle, type Langue, type Texte } from './dictionnaires';

export type { Cle, Langue } from './dictionnaires';
export { LANGUES } from './dictionnaires';

const DICTIONNAIRES: Record<Langue, Record<Cle, Texte>> = { fr, en };

type Variables = Record<string, string | number>;

/** Pluriel : en français 0 et 1 sont au singulier, en anglais seulement 1. */
const singulier = (langue: Langue, n: number) => (langue === 'fr' ? Math.abs(n) < 2 : Math.abs(n) === 1);

export function traduire(langue: Langue, cle: Cle, vars?: Variables): string {
  const t = DICTIONNAIRES[langue][cle] ?? fr[cle];
  const brut = typeof t === 'string' ? t : singulier(langue, Number(vars?.n ?? 0)) ? t.un : t.autre;
  return vars ? brut.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : brut;
}

function lire(cle: string): string | null {
  try {
    return localStorage.getItem(cle);
  } catch {
    return null;
  }
}
function ecrire(cle: string, v: string) {
  try {
    localStorage.setItem(cle, v);
  } catch {
    /* stockage indisponible : la préférence vaut pour la session */
  }
}

const langueValide = (l: string | null | undefined): l is Langue => l === 'fr' || l === 'en';
const deviseValide = (d: string | null | undefined): d is string => !!d && CODES_DEVISES.includes(d);

function initiales(): { langue: Langue; devise: string } {
  const l = lire('langue');
  const d = lire('devise');
  return {
    langue: langueValide(l) ? l : navigator.language?.toLowerCase().startsWith('fr') ? 'fr' : navigator.language ? 'en' : 'fr',
    devise: deviseValide(d) ? d : 'EUR',
  };
}

interface ContextePreferences {
  langue: Langue;
  devise: string;
  t: (cle: Cle, vars?: Variables) => string;
  changer: (p: { langue?: Langue; devise?: string }) => Promise<void>;
  nomMoteur: (m: Pick<DescriptionMoteur, 'code' | 'nom'>) => string;
  descriptionMoteur: (m: Pick<DescriptionMoteur, 'code' | 'description'>) => string;
  /** Message d'une erreur d'API dans la langue courante (par code, sinon message du serveur). */
  erreur: (e: unknown) => string;
}

const Contexte = createContext<ContextePreferences | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  // Lecture seule de la session chargée par les pages protégées : aucune requête ici,
  // sinon l'écran de connexion déclencherait un 401 inutile.
  const session = useQuery({ ...requeteSession, enabled: false });
  const qc = useQueryClient();
  const [prefs, setPrefs] = useState(initiales);
  const u = session.data?.utilisateur;

  // Les préférences du compte priment dès que la session est connue.
  useEffect(() => {
    if (u && langueValide(u.langue) && deviseValide(u.devise)) setPrefs({ langue: u.langue, devise: u.devise });
  }, [u?.id, u?.langue, u?.devise]); // eslint-disable-line react-hooks/exhaustive-deps

  // Avant le rendu des enfants : les fonctions de format lisent cette configuration.
  configurerFormat(prefs.langue, prefs.devise);

  useEffect(() => {
    document.documentElement.lang = prefs.langue;
    ecrire('langue', prefs.langue);
    ecrire('devise', prefs.devise);
  }, [prefs]);

  const changer = useCallback(
    async (p: { langue?: Langue; devise?: string }) => {
      setPrefs((x) => ({ ...x, ...p }));
      if (!u) return;
      const r = await api<{ utilisateur: Utilisateur }>('/auth/preferences', { method: 'PATCH', json: p });
      qc.setQueryData(['session'], (s: { utilisateur: Utilisateur } | undefined) => (s ? { ...s, utilisateur: r.utilisateur } : s));
      // Les libellés « principal » et les montants mis en cache sont reformatés au prochain rendu ; rien à recharger.
    },
    [u, qc],
  );

  const valeur = useMemo<ContextePreferences>(() => {
    const t = (cle: Cle, vars?: Variables) => traduire(prefs.langue, cle, vars);
    return {
      ...prefs,
      t,
      changer,
      nomMoteur: (m) => (prefs.langue === 'fr' ? m.nom : (MOTEURS_EN[m.code]?.nom ?? m.nom)),
      descriptionMoteur: (m) => (prefs.langue === 'fr' ? m.description : (MOTEURS_EN[m.code]?.description ?? m.description)),
      erreur: (e) => {
        if (e instanceof ErreurApi) {
          const cle = `api.${e.code}` as Cle;
          if (cle in fr) return t(cle);
          return e.details?.[0]?.message ?? e.message;
        }
        return t('api.serveur');
      },
    };
  }, [prefs, changer]);

  return <Contexte.Provider value={valeur}>{children}</Contexte.Provider>;
}

export function useT(): ContextePreferences {
  const c = useContext(Contexte);
  if (!c) throw new Error('useT doit être utilisé sous PreferencesProvider');
  return c;
}
