/**
 * Barèmes de paie versionnés. Les versions marquées « a_verifier » doivent être
 * confirmées par l'administrateur (arrêtés PASS/SMIC, circulaires URSSAF,
 * accords AGIRC-ARRCO) : le moteur émet un avertissement tant que ce n'est pas fait.
 */
import { bareme } from '../noyau';

export interface ConstantesPaie {
  pmss: string;
  smicHoraire: string;
  dureeLegaleMensuelle: string;
}

bareme<ConstantesPaie>({
  code: 'paie.constantes',
  moteur: 'paie',
  libelle: 'PMSS et SMIC',
  versions: [
    { du: '2023-05-01', valeurs: { pmss: '3666', smicHoraire: '11.52', dureeLegaleMensuelle: '151.67' }, source: 'Arrêté du 30/11/2022 (PASS 2023) ; arrêté du 26/04/2023 (SMIC)', statut: 'officiel' },
    { du: '2024-01-01', valeurs: { pmss: '3864', smicHoraire: '11.65', dureeLegaleMensuelle: '151.67' }, source: 'Arrêté du 19/12/2023 (PASS 2024) ; décret n° 2023-1216 (SMIC)', statut: 'officiel' },
    { du: '2024-11-01', valeurs: { pmss: '3864', smicHoraire: '11.88', dureeLegaleMensuelle: '151.67' }, source: 'Décret n° 2024-951 (SMIC au 01/11/2024)', statut: 'officiel' },
    { du: '2025-01-01', valeurs: { pmss: '3925', smicHoraire: '11.88', dureeLegaleMensuelle: '151.67' }, source: 'Arrêté du 19/12/2024 (PASS 2025 = 47 100 €)', statut: 'officiel' },
    { du: '2026-01-01', valeurs: { pmss: '4005', smicHoraire: '12.02', dureeLegaleMensuelle: '151.67' }, source: 'PASS 2026 = 48 060 € ; revalorisation du SMIC au 01/01/2026', statut: 'a_verifier', note: 'valeurs 2026 à confirmer (arrêté PASS, décret SMIC)' },
  ],
});

export interface TauxCotisations {
  maladie: { patronal: string; complement: string; seuilSmic: string };
  allocationsFamiliales: { reduit: string; plein: string; seuilSmic: string };
  vieillessePlafonnee: { salarial: string; patronal: string };
  vieillesseDeplafonnee: { salarial: string; patronal: string };
  fnal: { moins50: string; plus50: string };
  csa: string;
  chomage: string;
  ags: string;
  agircT1: { salarial: string; patronal: string };
  agircT2: { salarial: string; patronal: string };
  cegT1: { salarial: string; patronal: string };
  cegT2: { salarial: string; patronal: string };
  cet: { salarial: string; patronal: string };
  apec: { salarial: string; patronal: string };
  prevoyanceCadreMin: string;
  formation: { moins11: string; plus11: string };
  apprentissage: string;
  dialogueSocial: string;
  forfaitSocialPrevoyance: string;
  csgDeductible: string;
  csgNonDeductible: string;
  crds: string;
  abattementCsg: string;
  alsaceMoselle: string;
  reductionHsSalariale: string;
  deductionHs: { moins20: string; de20a249: string };
  plafondExonerationHsAnnuel: string;
  reductionGenerale:
    | { formule: 'fillon'; tFnal010: string; tFnal050: string; plafondSmic: string }
    | { formule: 'rgdu'; tMin: string; tDeltaFnal010: string; tDeltaFnal050: string; puissance: string; plafondSmic: string };
}

const BASE_2024: TauxCotisations = {
  maladie: { patronal: '7.00', complement: '6.00', seuilSmic: '2.5' },
  allocationsFamiliales: { reduit: '3.45', plein: '5.25', seuilSmic: '3.5' },
  vieillessePlafonnee: { salarial: '6.90', patronal: '8.55' },
  vieillesseDeplafonnee: { salarial: '0.40', patronal: '2.02' },
  fnal: { moins50: '0.10', plus50: '0.50' },
  csa: '0.30',
  chomage: '4.05',
  ags: '0.15',
  agircT1: { salarial: '3.15', patronal: '4.72' },
  agircT2: { salarial: '8.64', patronal: '12.95' },
  cegT1: { salarial: '0.86', patronal: '1.29' },
  cegT2: { salarial: '1.08', patronal: '1.62' },
  cet: { salarial: '0.14', patronal: '0.21' },
  apec: { salarial: '0.024', patronal: '0.036' },
  prevoyanceCadreMin: '1.50',
  formation: { moins11: '0.55', plus11: '1.00' },
  apprentissage: '0.68',
  dialogueSocial: '0.016',
  forfaitSocialPrevoyance: '8',
  csgDeductible: '6.80',
  csgNonDeductible: '2.40',
  crds: '0.50',
  abattementCsg: '1.75',
  alsaceMoselle: '1.30',
  reductionHsSalariale: '11.31',
  deductionHs: { moins20: '1.50', de20a249: '0.50' },
  plafondExonerationHsAnnuel: '7500',
  reductionGenerale: { formule: 'fillon', tFnal010: '0.3191', tFnal050: '0.3231', plafondSmic: '1.6' },
};

bareme<TauxCotisations>({
  code: 'paie.cotisations',
  moteur: 'paie',
  libelle: 'Taux de cotisations sociales (régime général)',
  versions: [
    {
      du: '2024-01-01',
      valeurs: BASE_2024,
      source: 'CSS art. D.242-3 et s. ; ANI AGIRC-ARRCO du 17/11/2017 ; Unédic ; CSS art. D.241-7 (réduction générale)',
      statut: 'officiel',
    },
    {
      du: '2025-01-01',
      valeurs: {
        ...BASE_2024,
        maladie: { ...BASE_2024.maladie, seuilSmic: '2.25' },
        allocationsFamiliales: { ...BASE_2024.allocationsFamiliales, seuilSmic: '3.3' },
        ags: '0.25',
        reductionGenerale: { formule: 'fillon', tFnal010: '0.3194', tFnal050: '0.3234', plafondSmic: '1.6' },
      },
      source: 'LFSS 2025 (bandeaux maladie 2,25 SMIC et famille 3,3 SMIC) ; AGS ; décret réduction générale 2025',
      statut: 'a_verifier',
      note: 'taux AGS et paramètre T 2025 à confirmer',
    },
    {
      du: '2025-05-01',
      valeurs: {
        ...BASE_2024,
        maladie: { ...BASE_2024.maladie, seuilSmic: '2.25' },
        allocationsFamiliales: { ...BASE_2024.allocationsFamiliales, seuilSmic: '3.3' },
        ags: '0.25',
        chomage: '4.00',
        reductionGenerale: { formule: 'fillon', tFnal010: '0.3194', tFnal050: '0.3234', plafondSmic: '1.6' },
      },
      source: 'Convention d’assurance chômage 2024 — contribution patronale ramenée à 4,00 %',
      statut: 'a_verifier',
      note: 'taux chômage au 01/05/2025 à confirmer',
    },
    {
      du: '2026-01-01',
      valeurs: {
        ...BASE_2024,
        maladie: { ...BASE_2024.maladie, seuilSmic: '2.25' },
        allocationsFamiliales: { ...BASE_2024.allocationsFamiliales, seuilSmic: '3.3' },
        ags: '0.25',
        chomage: '4.00',
        reductionGenerale: { formule: 'rgdu', tMin: '0.02', tDeltaFnal010: '0.3773', tDeltaFnal050: '0.3813', puissance: '1.75', plafondSmic: '3' },
      },
      source: 'LFSS 2025 art. 18 — réduction générale dégressive unique (RGDU) à compter du 01/01/2026',
      statut: 'a_verifier',
      note: 'paramètres de la RGDU à confirmer par décret',
    },
  ],
});

export interface GrillePas {
  tranches: { jusqua: string | null; taux: string }[];
}

const g = (bornes: string[], taux: string[]): GrillePas => ({
  tranches: taux.map((t, i) => ({ jusqua: bornes[i] ?? null, taux: t })),
});

const TAUX_GRILLE = ['0', '0.5', '1.3', '2.1', '2.9', '3.5', '4.1', '5.3', '7.5', '9.9', '11.9', '13.8', '15.8', '17.9', '20', '24', '28', '33', '38', '43'];

bareme<GrillePas>({
  code: 'paie.pas-metropole',
  moteur: 'paie',
  libelle: 'Grille du taux neutre de prélèvement à la source (métropole)',
  versions: [
    {
      du: '2024-01-01',
      valeurs: g(['1591', '1653', '1759', '1877', '2006', '2113', '2253', '2666', '3052', '3476', '3913', '4566', '5475', '6851', '8557', '11877', '16086', '25251', '54088'], TAUX_GRILLE),
      source: 'CGI art. 204 H ; BOI-BAREME-000037',
      statut: 'a_verifier',
      note: 'bornes mensuelles à confirmer avec la grille publiée',
    },
    {
      du: '2025-01-01',
      valeurs: g(['1620', '1683', '1791', '1911', '2042', '2151', '2294', '2714', '3107', '3539', '3983', '4648', '5574', '6974', '8711', '12091', '16376', '25706', '55062'], TAUX_GRILLE),
      source: 'CGI art. 204 H (loi de finances 2025) ; BOI-BAREME-000037',
      statut: 'a_verifier',
      note: 'bornes mensuelles à confirmer avec la grille publiée',
    },
  ],
});

export interface AvantagesNature {
  repas: string;
  vehicule: {
    achatMoins5: string;
    achatPlus5: string;
    achatCarburantMoins5: string;
    achatCarburantPlus5: string;
    location: string;
    locationCarburant: string;
    abattementElectrique: string;
    plafondAbattementElectrique: string;
  };
}

bareme<AvantagesNature>({
  code: 'paie.avantages-nature',
  moteur: 'paie',
  libelle: 'Évaluation forfaitaire des avantages en nature',
  versions: [
    {
      du: '2024-01-01',
      valeurs: {
        repas: '5.35',
        vehicule: {
          achatMoins5: '9',
          achatPlus5: '6',
          achatCarburantMoins5: '12',
          achatCarburantPlus5: '9',
          location: '30',
          locationCarburant: '40',
          abattementElectrique: '50',
          plafondAbattementElectrique: '1800',
        },
      },
      source: 'Arrêté du 10/12/2002 modifié (art. 3) ; abattement VE : arrêté du 21/03/2020',
      statut: 'officiel',
    },
    {
      du: '2025-01-01',
      valeurs: {
        repas: '5.45',
        vehicule: {
          achatMoins5: '9',
          achatPlus5: '6',
          achatCarburantMoins5: '12',
          achatCarburantPlus5: '9',
          location: '30',
          locationCarburant: '40',
          abattementElectrique: '50',
          plafondAbattementElectrique: '1800',
        },
      },
      source: 'Barème URSSAF 2025 (repas)',
      statut: 'officiel',
    },
    {
      du: '2025-02-01',
      valeurs: {
        repas: '5.45',
        vehicule: {
          achatMoins5: '15',
          achatPlus5: '10',
          achatCarburantMoins5: '20',
          achatCarburantPlus5: '15',
          location: '50',
          locationCarburant: '67',
          abattementElectrique: '70',
          plafondAbattementElectrique: '4582',
        },
      },
      source: 'Arrêté du 30/01/2025 — nouvelle évaluation des véhicules mis à disposition',
      statut: 'a_verifier',
      note: 'taux véhicule 2025 et plafond d’abattement électrique à confirmer',
    },
  ],
});

export interface IndemnitesJournalieres {
  plafondSmic: string;
  carence: string;
  diviseur: string;
}

bareme<IndemnitesJournalieres>({
  code: 'paie.ijss',
  moteur: 'paie',
  libelle: 'Indemnités journalières maladie',
  versions: [
    { du: '2024-01-01', valeurs: { plafondSmic: '1.8', carence: '3', diviseur: '91.25' }, source: 'CSS art. R.323-4 et R.323-9', statut: 'officiel' },
    {
      du: '2025-04-01',
      valeurs: { plafondSmic: '1.4', carence: '3', diviseur: '91.25' },
      source: 'Décret n° 2025-160 — plafond du revenu d’activité ramené à 1,4 SMIC',
      statut: 'a_verifier',
      note: 'plafond 1,4 SMIC à confirmer',
    },
  ],
});
