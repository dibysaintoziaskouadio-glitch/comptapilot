/** Registre des moteurs et des formules : point d'entrée unique de l'exécution. */
import { decrireFormule, executerFormule, Formule } from './formule';
import { CodeMoteur, DescriptionMoteur, ResultatCalcul } from './types';

export const MOTEURS: Omit<DescriptionMoteur, 'formules'>[] = [
  { code: 'base', dossier: 'calculs-base', nom: 'Calculs de base', icone: 'calculator', description: 'Arithmétique comptable, arrondis, pourcentages, devises, dates et échéances.' },
  { code: 'tva', dossier: 'calculs-tva', nom: 'TVA & taxes sur le CA', icone: 'receipt', description: 'Conversions HT/TTC, CA3, CA12, autoliquidation, TVA sur marge, coefficients de déduction, régularisations.' },
  { code: 'amortissements', dossier: 'calculs-amortissement', nom: 'Amortissements', icone: 'trending-down', description: 'Linéaire, dégressif, unités d’œuvre, composants, dérogatoires, cessions, crédit-bail.' },
  { code: 'provisions', dossier: 'calculs-provisions', nom: 'Provisions & dépréciations', icone: 'shield', description: 'Créances douteuses, stocks, titres, risques et charges, retraites, tests de dépréciation.' },
  { code: 'paie', dossier: 'calculs-paie', nom: 'Paie & cotisations', icone: 'users', description: 'Bulletin complet, cotisations, CSG/CRDS, PAS, réduction générale, indemnités de rupture.' },
  { code: 'fiscal', dossier: 'calculs-fiscal', nom: 'Fiscalité entreprise', icone: 'landmark', description: 'IS, acomptes, déficits, CFE, CVAE, taxe sur les salaires, taxes diverses, contrôle FEC.' },
  { code: 'financier', dossier: 'calculs-financier', nom: 'Analyse financière', icone: 'bar-chart-3', description: 'SIG, CAF, bilan fonctionnel, ratios de rentabilité, structure, liquidité, activité, leviers.' },
  { code: 'tresorerie', dossier: 'calculs-tresorerie', nom: 'Trésorerie & financement', icone: 'droplets', description: 'Emprunts, TAEG, agios, escompte, affacturage, budgets et plans de trésorerie, placements.' },
  { code: 'analytique', dossier: 'calculs-analytique', nom: 'Comptabilité analytique', icone: 'target', description: 'Coûts complets, centres d’analyse, ABC, seuil de rentabilité, analyse des écarts.' },
  { code: 'investissement', dossier: 'calculs-investissement', nom: 'Investissement & décision', icone: 'line-chart', description: 'VAN, TRI, IP, DRCI, CMPC, MEDAF, Monte-Carlo, choix de financement.' },
  { code: 'stocks', dossier: 'calculs-stocks', nom: 'Stocks & approvisionnements', icone: 'package', description: 'CMP, FIFO, LIFO, Wilson, stock de sécurité, rotation, écarts d’inventaire.' },
  { code: 'consolidation', dossier: 'calculs-consolidation', nom: 'Consolidation & international', icone: 'globe', description: 'Périmètre, pourcentages d’intérêt, goodwill, éliminations, conversion, couverture de change.' },
  { code: 'sectoriels', dossier: 'calculs-sectoriels', nom: 'Secteurs particuliers', icone: 'factory', description: 'BTP, immobilier, agriculture, associations, professions libérales, banque et assurance.' },
];

const formules = new Map<string, Formule<any>>();

export function enregistrer(...liste: Formule<any>[]): void {
  for (const f of liste) {
    const cle = `${f.moteur}/${f.id}`;
    if (formules.has(cle)) throw new Error(`Formule déjà enregistrée : ${cle}`);
    formules.set(cle, f);
  }
}

export function obtenirFormule(moteur: string, id: string): Formule<any> | undefined {
  return formules.get(`${moteur}/${id}`);
}

export function toutesLesFormules(): Formule<any>[] {
  return [...formules.values()];
}

export function executer(moteur: string, id: string, entrees: Record<string, unknown>): ResultatCalcul {
  const f = obtenirFormule(moteur, id);
  if (!f) throw new Error(`Formule inconnue : ${moteur}/${id}`);
  return executerFormule(f, entrees);
}

export function catalogue(): DescriptionMoteur[] {
  return MOTEURS.map((m) => ({
    ...m,
    formules: toutesLesFormules()
      .filter((f) => f.moteur === m.code)
      .map(decrireFormule),
  }));
}

export function estMoteur(code: string): code is CodeMoteur {
  return MOTEURS.some((m) => m.code === code);
}
