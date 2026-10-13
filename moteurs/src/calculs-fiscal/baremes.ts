import { bareme } from '../noyau';

export interface BaremeIs {
  tauxNormal: string;
  tauxReduit: string;
  plafondReduit: string;
  seuilCaPme: string;
  tauxCsb: string;
  abattementCsb: string;
  seuilCaCsb: string;
  seuilAcomptes: string;
  plafondDeficit: string;
  fractionDeficit: string;
  plafondCarryBack: string;
  qpfcDividendes: string;
  qpfcDividendesGroupe: string;
  qpfcPvTitres: string;
  tauxBrevets: string;
}

bareme<BaremeIs>({
  code: 'fiscal.is',
  revision: 'sur-texte',
  moteur: 'fiscal',
  libelle: 'Impôt sur les sociétés',
  versions: [
    {
      du: '2022-01-01',
      valeurs: {
        tauxNormal: '25',
        tauxReduit: '15',
        plafondReduit: '42500',
        seuilCaPme: '10000000',
        tauxCsb: '3.3',
        abattementCsb: '763000',
        seuilCaCsb: '7630000',
        seuilAcomptes: '3000',
        plafondDeficit: '1000000',
        fractionDeficit: '50',
        plafondCarryBack: '1000000',
        qpfcDividendes: '5',
        qpfcDividendesGroupe: '1',
        qpfcPvTitres: '12',
        tauxBrevets: '10',
      },
      source: 'CGI art. 219 I (LF 2018, LF 2023 pour le plafond de 42 500 €), 235 ter ZC, 209 I, 220 quinquies, 216, 238',
      statut: 'officiel',
    },
  ],
});

export interface BaremeCvae {
  tauxMax: string; // taux maximal de l'année (%)
  plafondCet: string; // plafonnement de la CET en % de la VA
}

bareme<BaremeCvae>({
  code: 'fiscal.cvae',
  moteur: 'fiscal',
  libelle: 'CVAE et plafonnement de la CET',
  versions: [
    { du: '2023-01-01', valeurs: { tauxMax: '0.375', plafondCet: '1.625' }, source: 'CGI art. 1586 quater et 1647 B sexies (LF 2023)', statut: 'officiel' },
    { du: '2024-01-01', valeurs: { tauxMax: '0.28', plafondCet: '1.531' }, source: 'CGI art. 1586 quater et 1647 B sexies (LF 2024)', statut: 'officiel' },
    { du: '2025-01-01', valeurs: { tauxMax: '0.28', plafondCet: '1.531' }, source: 'LF 2025 — report de la suppression de la CVAE', statut: 'a_verifier', note: 'taux 2025 maintenu à 0,28 % — à confirmer' },
    { du: '2026-01-01', valeurs: { tauxMax: '0.28', plafondCet: '1.531' }, source: 'LF 2025 — trajectoire 2025-2027', statut: 'a_verifier', note: 'taux 2026 à confirmer (loi de finances)' },
  ],
});

export interface BaremeTaxeSalaires {
  seuil1: string;
  seuil2: string;
  taux1: string;
  taux2: string;
  taux3: string;
  franchise: string;
  limiteDecote: string;
  abattementAssociations: string;
}

bareme<BaremeTaxeSalaires>({
  code: 'fiscal.taxe-salaires',
  moteur: 'fiscal',
  libelle: 'Taxe sur les salaires',
  versions: [
    {
      du: '2024-01-01',
      valeurs: { seuil1: '8985', seuil2: '17936', taux1: '4.25', taux2: '8.50', taux3: '13.60', franchise: '1200', limiteDecote: '2040', abattementAssociations: '23616' },
      source: 'CGI art. 231 et 1679 A (seuils revalorisés pour 2024)',
      statut: 'a_verifier',
      note: 'seuils et abattement 2024 à confirmer',
    },
    {
      du: '2025-01-01',
      valeurs: { seuil1: '9147', seuil2: '18258', taux1: '4.25', taux2: '8.50', taux3: '13.60', franchise: '1200', limiteDecote: '2040', abattementAssociations: '24040' },
      source: 'CGI art. 231 et 1679 A (seuils revalorisés pour 2025)',
      statut: 'a_verifier',
      note: 'seuils et abattement 2025 à confirmer',
    },
  ],
});

export interface BaremeTvs {
  co2: { de: number; a: number | null; tarif: string }[];
  polluants: { electrique: string; critair1: string; autres: string };
}

bareme<BaremeTvs>({
  code: 'fiscal.tvs',
  moteur: 'fiscal',
  libelle: 'Taxes annuelles sur les véhicules de tourisme',
  versions: [
    {
      du: '2024-01-01',
      valeurs: {
        co2: [
          { de: 0, a: 14, tarif: '0' },
          { de: 15, a: 55, tarif: '1' },
          { de: 56, a: 63, tarif: '2' },
          { de: 64, a: 95, tarif: '3' },
          { de: 96, a: 115, tarif: '4' },
          { de: 116, a: 135, tarif: '10' },
          { de: 136, a: 155, tarif: '50' },
          { de: 156, a: 175, tarif: '60' },
          { de: 176, a: null, tarif: '65' },
        ],
        polluants: { electrique: '0', critair1: '100', autres: '500' },
      },
      source: 'CIBS art. L.421-119 à L.421-167 (barème WLTP 2024)',
      statut: 'officiel',
    },
  ],
});

export interface BaremeTascom {
  seuilBas: string;
  seuilHaut: string;
  tarifBas: string;
  tarifHaut: string;
  pente: string;
  surfaceMin: string;
  surfaceMajoration: string;
  majoration: string;
}

bareme<BaremeTascom>({
  code: 'fiscal.tascom',
  revision: 'sur-texte',
  moteur: 'fiscal',
  libelle: 'Taxe sur les surfaces commerciales',
  versions: [
    {
      du: '2015-01-01',
      valeurs: { seuilBas: '3000', seuilHaut: '12000', tarifBas: '5.74', tarifHaut: '34.12', pente: '0.00315', surfaceMin: '400', surfaceMajoration: '2500', majoration: '50' },
      source: 'Loi n° 72-657 du 13/07/1972, art. 3 ; décret n° 95-85',
      statut: 'officiel',
    },
  ],
});

export interface BaremeDivers {
  c3sTaux: string;
  c3sAbattement: string;
  taPrincipale: string;
  taSolde: string;
  taAlsace: string;
  cfpMoins11: string;
  cfpPlus11: string;
  cpfCdd: string;
  pfuIr: string;
  prelevementsSociaux: string;
  seuilDas2: string;
  spectacles: string;
}

bareme<BaremeDivers>({
  code: 'fiscal.divers',
  revision: 'sur-texte',
  moteur: 'fiscal',
  libelle: 'Taxes et contributions diverses',
  versions: [
    {
      du: '2022-01-01',
      valeurs: {
        c3sTaux: '0.16',
        c3sAbattement: '19000000',
        taPrincipale: '0.59',
        taSolde: '0.09',
        taAlsace: '0.44',
        cfpMoins11: '0.55',
        cfpPlus11: '1',
        cpfCdd: '1',
        pfuIr: '12.8',
        prelevementsSociaux: '17.2',
        seuilDas2: '1200',
        spectacles: '3.5',
      },
      source: 'CSS art. L.137-30 et s. ; C. trav. L.6131-2, L.6241-2, L.6331-1 ; CGI art. 200 A et 240 ; CIBS (spectacles)',
      statut: 'officiel',
    },
  ],
});
