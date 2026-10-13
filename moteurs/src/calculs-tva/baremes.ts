import { bareme } from '../noyau';

export interface TauxTva {
  normal: string;
  intermediaire: string;
  reduit: string;
  particulier: string;
  dom: { normal: string; reduit: string; particulier: string };
  corse: string[];
}

export const BAREME_TAUX_TVA = bareme<TauxTva>({
  code: 'tva.taux',
  revision: 'sur-texte',
  moteur: 'tva',
  libelle: 'Taux de TVA (France)',
  description: 'Taux légaux en vigueur en métropole, dans les DOM (Guadeloupe, Martinique, Réunion) et en Corse.',
  versions: [
    {
      du: '2014-01-01',
      valeurs: {
        normal: '20',
        intermediaire: '10',
        reduit: '5.5',
        particulier: '2.1',
        dom: { normal: '8.5', reduit: '2.1', particulier: '1.05' },
        corse: ['13', '10', '2.1', '0.9'],
      },
      source: 'CGI art. 278, 278 bis, 278-0 bis, 279, 281 quater, 294, 296, 297',
      statut: 'officiel',
    },
  ],
});

export interface SeuilsTva {
  remboursementAnnuel: string;
  remboursementInfraAnnuel: string;
  acompteJuillet: string;
  acompteDecembre: string;
  dispenseAcomptes: string;
  seuilEmebi: string;
}

export const BAREME_SEUILS_TVA = bareme<SeuilsTva>({
  code: 'tva.seuils',
  moteur: 'tva',
  libelle: 'Seuils et acomptes TVA',
  versions: [
    {
      du: '2015-01-01',
      valeurs: {
        remboursementAnnuel: '150',
        remboursementInfraAnnuel: '760',
        acompteJuillet: '55',
        acompteDecembre: '40',
        dispenseAcomptes: '1000',
        seuilEmebi: '460000',
      },
      source: 'CGI ann. II art. 242-0 A et 242-0 C ; CGI art. 287-3 ; arrêté du 22/12/2021 (EMEBI)',
      statut: 'officiel',
    },
  ],
});
