/**
 * @compta/moteurs — bibliothèque de calcul comptable.
 * L'import de ce module enregistre toutes les formules et tous les barèmes.
 */
import { enregistrer } from './noyau/registre';
import { formulesBase } from './calculs-base';
import { formulesTva } from './calculs-tva';
import { formulesAmortissements } from './calculs-amortissement';
import { formulesProvisions } from './calculs-provisions';
import { formulesPaie } from './calculs-paie';
import { formulesFiscal } from './calculs-fiscal';
import { formulesFinancier } from './calculs-financier';
import { formulesTresorerie } from './calculs-tresorerie';
import { formulesAnalytique } from './calculs-analytique';
import { formulesInvestissement } from './calculs-investissement';
import { formulesStocks } from './calculs-stocks';
import { formulesConsolidation } from './calculs-consolidation';
import { formulesSectoriels } from './calculs-sectoriels';

enregistrer(...formulesBase, ...formulesTva, ...formulesAmortissements, ...formulesProvisions, ...formulesPaie, ...formulesFiscal, ...formulesFinancier, ...formulesTresorerie, ...formulesAnalytique, ...formulesInvestissement, ...formulesStocks, ...formulesConsolidation, ...formulesSectoriels);

export * from './noyau';
