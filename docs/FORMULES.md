# Catalogue des formules

> Document généré automatiquement par `npm run docs` à partir du registre du moteur — 163 formules, 13 moteurs.

| Moteur | Dossier | Formules |
|---|---|---|
| [Calculs de base](#base) | `moteurs/src/calculs-base` | 18 |
| [TVA & taxes sur le CA](#tva) | `moteurs/src/calculs-tva` | 14 |
| [Amortissements](#amortissements) | `moteurs/src/calculs-amortissement` | 10 |
| [Provisions & dépréciations](#provisions) | `moteurs/src/calculs-provisions` | 12 |
| [Paie & cotisations](#paie) | `moteurs/src/calculs-paie` | 17 |
| [Fiscalité entreprise](#fiscal) | `moteurs/src/calculs-fiscal` | 23 |
| [Analyse financière](#financier) | `moteurs/src/calculs-financier` | 10 |
| [Trésorerie & financement](#tresorerie) | `moteurs/src/calculs-tresorerie` | 11 |
| [Comptabilité analytique](#analytique) | `moteurs/src/calculs-analytique` | 10 |
| [Investissement & décision](#investissement) | `moteurs/src/calculs-investissement` | 9 |
| [Stocks & approvisionnements](#stocks) | `moteurs/src/calculs-stocks` | 7 |
| [Consolidation & international](#consolidation) | `moteurs/src/calculs-consolidation` | 9 |
| [Secteurs particuliers](#sectoriels) | `moteurs/src/calculs-sectoriels` | 13 |

## <a id="base"></a>Calculs de base

Arithmétique comptable, arrondis, pourcentages, devises, dates et échéances.

### Arithmétique

#### Arrondi comptable et fiscal

`POST /api/calc/base/arrondi` — version 1.0.0

Arrondit une valeur selon les règles comptables (au centime), fiscales (à l'euro) ou bancaires, et mesure l'écart d'arrondi.

```text
arrondi(x, n) ; fiscal : fraction < 0,50 € négligée, ≥ 0,50 € comptée pour 1 €
```

**Entrées**

- `valeur` (nombre) — Valeur à arrondir — défaut : `1234.5678`
- `mode` (choix) — Règle d'arrondi — défaut : `comptable`
- `decimales` (entier) — Décimales — défaut : `2`

**Références**

- CGI art. 1657, 1-a — arrondi des bases et cotisations à l’euro le plus proche
- Règlement ANC 2014-03, art. 911-1 (tenue en euros et centimes)

**Exemples vérifiés par les tests**

- *Centime* → `resultat` = 1234.57
- *Fiscal* → `resultat` = 1235
- *Bancaire* → `resultat` = 2.34

#### Répartition proportionnelle au centime près

`POST /api/calc/base/repartition-proportionnelle` — version 1.0.0

Répartit un montant selon des clés, arrondit chaque part au centime et affecte le reliquat d'arrondi par la méthode du plus fort reste : la somme des parts est toujours exactement égale au total.

```text
Part_i = Total × clé_i / Σ clés ; reliquat affecté aux plus forts restes
```

**Entrées**

- `total` (montant) — Montant à répartir — défaut : `1000`
- `cles` (table) — Clés de répartition

**Références**

- Méthode du plus fort reste (Hamilton)

**Exemples vérifiés par les tests**

- *1 000 € en trois tiers* → `part_1` = 333.34, `part_2` = 333.33, `part_3` = 333.33, `controle` = 0.00

### Contrôles

#### Équilibre débit / crédit

`POST /api/calc/base/equilibre-debit-credit` — version 1.0.0

Totalise une écriture ou un journal, vérifie l'équilibre à 0,01 € près et propose l'écart d'arrondi à passer.

```text
Σ Débits − Σ Crédits = 0 (tolérance 0,01 €)
```

**Entrées**

- `lignes` (table) — Lignes
- `tolerance` (montant) — Tolérance — défaut : `0.01`

**Références**

- Code de commerce art. L.123-12 et R.123-173 (partie double)
- PCG art. 420-1 et suivants

**Exemples vérifiés par les tests**

- *Facture équilibrée* → `totalDebit` = 1200.00, `totalCredit` = 1200.00, `ecart` = 0.00, `equilibre` = oui
- *Écart de 1 centime* → `ecart` = 0.01, `equilibre` = oui

#### Détection des doublons

`POST /api/calc/base/detection-doublons` — version 1.0.0

Repère les pièces potentiellement saisies deux fois : même tiers et même montant à quelques jours d’intervalle, ou même numéro de pièce.

```text
Doublon si (tiers, montant) identiques et |Δ dates| ≤ fenêtre, ou référence de pièce identique
```

**Entrées**

- `pieces` (table) — Pièces
- `fenetre` (entier) — Fenêtre (jours) — défaut : `7`

**Références**

- Code de commerce art. R.123-174 — pièces justificatives ; contrôle interne

**Exemples vérifiés par les tests**

- *Deux doublons* → `doublons` = 2

### Pourcentages

#### Variation, écart et coefficient multiplicateur

`POST /api/calc/base/variation` — version 1.0.0

Calcule l'écart absolu, la variation en pourcentage, le coefficient multiplicateur et la variation réciproque entre deux valeurs.

```text
Variation = (Vf − Vi) / |Vi| ; CM = Vf / Vi ; réciproque = Vi / Vf − 1
```

**Entrées**

- `initiale` (nombre) — Valeur initiale — défaut : `80000`
- `finale` (nombre) — Valeur finale — défaut : `92000`

**Références**

- Mathématiques financières — taux de variation

**Exemples vérifiés par les tests**

- *Hausse de CA* → `ecart` = 12000, `variation` = 15.00, `coefficient` = 1.150000, `reciproque` = -13.04

#### Augmentation / diminution en pourcentage

`POST /api/calc/base/appliquer-pourcentage` — version 1.0.0

Applique une hausse ou une baisse en pourcentage, ou retrouve la valeur d'origine à partir de la valeur finale.

```text
Vf = Vi × (1 ± t) ; Vi = Vf / (1 ± t)
```

**Entrées**

- `valeur` (montant) — Valeur — défaut : `1500`
- `taux` (taux) — Pourcentage — défaut : `12`
- `sens` (choix) — Opération — défaut : `augmentation`

**Références**

- Mathématiques financières — coefficient multiplicateur

**Exemples vérifiés par les tests**

- *Hausse de 12 %* → `resultat` = 1680.00, `difference` = 180.00
- *Remise de 20 %* → `resultat` = 200.00
- *Prix avant hausse* → `resultat` = 1500.00

#### Part dans un total (ratio simple)

`POST /api/calc/base/part-total` — version 1.0.0

Calcule la part relative d'éléments dans un total et contrôle que la somme des parts n'excède pas le total.

```text
Part = élément / total
```

**Entrées**

- `total` (montant) — Total — défaut : `250000`
- `elements` (table) — Éléments

**Références**

- Analyse financière — ratios de structure

**Exemples vérifiés par les tests**

- *Mix produits* → `part_1` = 48.00, `part_2` = 32.00, `part_3` = 20.00, `reste` = 0.00

#### Règle de trois (proportionnalité)

`POST /api/calc/base/regle-de-trois` — version 1.0.0

Résout x dans la proportion a / b = c / x (directe) ou a × b = c × x (inverse).

```text
Directe : x = b × c / a ; inverse : x = a × b / c
```

**Entrées**

- `a` (nombre) — a (référence) — défaut : `3`
- `b` (nombre) — b (valeur pour a) — défaut : `45`
- `c` (nombre) — c (nouvelle référence) — défaut : `7`
- `sens` (choix) — Proportionnalité — défaut : `directe`

**Références**

- Proportionnalité — produit en croix

**Exemples vérifiés par les tests**

- *3 kg → 45 € ; 7 kg ?* → `x` = 105
- *4 ouvriers 15 j ; 6 ouvriers ?* → `x` = 10

### Moyennes

#### Moyenne simple et dispersion

`POST /api/calc/base/moyenne-simple` — version 1.0.0

Moyenne arithmétique, médiane, minimum, maximum, étendue et écart-type d'une série.

```text
x̄ = Σ xi / n ; σ = √(Σ (xi − x̄)² / n)
```

**Entrées**

- `valeurs` (liste) — Valeurs

**Références**

- Statistique descriptive

**Exemples vérifiés par les tests**

- *CA mensuel* → `moyenne` = 13516.67, `mediane` = 13450.00, `etendue` = 3300.00

#### Moyenne pondérée

`POST /api/calc/base/moyenne-ponderee` — version 1.0.0

Moyenne de valeurs pondérées par des coefficients (quantités, durées, encours…).

```text
x̄p = Σ (xi × pi) / Σ pi
```

**Entrées**

- `valeurs` (table) — Valeurs et poids

**Références**

- Statistique descriptive — moyenne pondérée

**Exemples vérifiés par les tests**

- *Prix moyen pondéré* → `moyenne` = 4.320000, `sommePoids` = 1000

#### Moyenne mobile

`POST /api/calc/base/moyenne-mobile` — version 1.0.0

Lissage d'une série par moyenne mobile simple sur k périodes (tendance des ventes, saisonnalité).

```text
MMk(t) = (x(t) + … + x(t − k + 1)) / k
```

**Entrées**

- `valeurs` (liste) — Série
- `periode` (entier) — Nombre de périodes k — défaut : `3`

**Références**

- Analyse des séries chronologiques

**Exemples vérifiés par les tests**

- *MM3* → `derniere` = 146.67

### Devises

#### Conversion de devises

`POST /api/calc/base/conversion-devise` — version 1.0.0

Convertit un montant entre l'euro et une devise au cours du jour, historique ou moyen de la période ; calcule le cours moyen si une série de cours est fournie.

```text
Montant € = Montant devise × cours (1 devise = x €) ; cours moyen = Σ cours / n
```

**Entrées**

- `montant` (montant) — Montant à convertir — défaut : `15000`
- `sens` (choix) — Sens — défaut : `vers-euro`
- `codeDevise` (texte) — Code devise (ISO 4217) — défaut : `USD`
- `typeCours` (choix) — Cours appliqué — défaut : `jour`
- `cours` (nombre) — 1 devise = … € — défaut : `0.9235`
- `coursPeriode` (liste) — Cours de la période (1 devise = … €)

**Références**

- PCG art. 420-5 — conversion au cours du jour de l’opération
- PCG art. 420-6 — cours moyen admis s’il est représentatif

**Exemples vérifiés par les tests**

- *15 000 USD en euros* → `converti` = 13852.50
- *Cours moyen* → `cours` = 0.924100, `converti` = 13861.50

#### Différence de change réalisée

`POST /api/calc/base/ecart-de-change` — version 1.0.0

Gain ou perte de change constaté au règlement d’une créance ou d’une dette en devise, avec écriture.

```text
Écart = Montant devise × (cours règlement − cours origine) (signe inversé pour une dette)
```

**Entrées**

- `montantDevise` (montant) — Montant en devise — défaut : `10000`
- `coursOrigine` (nombre) — Cours à l'origine (1 devise = … €) — défaut : `0.92`
- `coursReglement` (nombre) — Cours au règlement — défaut : `0.95`
- `nature` (choix) — Nature — défaut : `creance`

**Références**

- PCG art. 420-7 — différences de change réalisées en résultat financier (666 / 766)
- PCG art. 946-66 et 947-76

**Exemples vérifiés par les tests**

- *Créance — gain* → `ecart` = 300.00, `valeurOrigine` = 9200.00, `valeurReglement` = 9500.00
- *Dette — perte* → `ecart` = -300.00

### Dates

#### Date d'échéance et délai légal de paiement

`POST /api/calc/base/echeance-paiement` — version 1.0.0

Calcule la date d'échéance d'une facture selon la condition de paiement et contrôle le respect des délais maximaux (60 jours date de facture ou 45 jours fin de mois).

```text
Net : date + n j ; fin de mois : FDM(date + n j) ; 45 j FDM : FDM(date) + 45 j
```

**Entrées**

- `dateFacture` (date) — Date de facture — défaut : `2025-03-14`
- `condition` (choix) — Condition de paiement — défaut : `net`
- `jours` (entier) — Nombre de jours n — défaut : `45`
- `jourDuMois` (entier) — Jour X du mois suivant — défaut : `10`

**Références**

- Code de commerce art. L.441-10 I — délais maximaux de paiement
- Code de commerce art. L.441-11 — transport, 30 jours

**Exemples vérifiés par les tests**

- *45 jours fin de mois* → `echeance` = 2025-04-30, `delaiJours` = 47
- *Net 30* → `echeance` = 2025-04-13
- *FDM + 45* → `echeance` = 2025-05-15

#### Jours calendaires, ouvrés et ouvrables

`POST /api/calc/base/jours-ouvres` — version 1.0.0

Compte les jours calendaires, ouvrés (lundi-vendredi) et ouvrables (lundi-samedi) entre deux dates, hors jours fériés légaux.

```text
Ouvrés = jours lun→ven − fériés ; ouvrables = jours lun→sam − fériés
```

**Entrées**

- `debut` (date) — Du (inclus) — défaut : `2025-05-01`
- `fin` (date) — Au (inclus) — défaut : `2025-05-31`
- `alsaceMoselle` (booleen) — Régime Alsace-Moselle — défaut : `false`

**Références**

- Code du travail art. L.3133-1 — fêtes légales
- Code du travail art. L.3134-13 — Alsace-Moselle

**Exemples vérifiés par les tests**

- *Mai 2025* → `calendaires` = 31, `ouvres` = 19, `ouvrables` = 24, `feries` = 3

#### Prorata temporis

`POST /api/calc/base/prorata-temporis` — version 1.0.0

Proratise un montant annuel sur une période selon la convention de décompte (jours réels, exact/365, 30/360) ; utilisé pour les charges constatées d'avance, intérêts courus, loyers.

```text
Montant × jours de la période / base annuelle
```

**Entrées**

- `montantAnnuel` (montant) — Montant annuel — défaut : `12000`
- `debut` (date) — Début de période (inclus) — défaut : `2025-04-15`
- `fin` (date) — Fin de période (incluse) — défaut : `2025-12-31`
- `convention` (choix) — Convention — défaut : `exact`

**Références**

- PCG art. 512-4 — rattachement des charges et produits à l’exercice
- Convention 30/360 (ISDA « 30E/360 »)

**Exemples vérifiés par les tests**

- *Loyer 15/04 → 31/12* → `jours` = 261, `prorata` = 8580.82
- *30/360* → `jours` = 256, `prorata` = 8533.33

#### Conversion de taux entre périodes

`POST /api/calc/base/conversion-taux-periode` — version 1.0.0

Convertit un taux annuel en taux mensuel, trimestriel, hebdomadaire ou journalier, en taux proportionnel et en taux équivalent (actuariel).

```text
Proportionnel : t / k ; équivalent : (1 + t)^(1/k) − 1
```

**Entrées**

- `tauxAnnuel` (taux) — Taux annuel — défaut : `6`
- `periode` (choix) — Période cible — défaut : `12`

**Références**

- Code de la consommation art. R.314-2 — taux de période proportionnel
- Mathématiques financières — taux équivalents

**Exemples vérifiés par les tests**

- *6 % annuel → mensuel* → `proportionnel` = 0.5000, `equivalent` = 0.4868

#### Pénalités de retard et indemnité forfaitaire

`POST /api/calc/base/penalites-retard` — version 1.0.0

Calcule les pénalités de retard B2B (taux BCE + 10 points par défaut) et l'indemnité forfaitaire de recouvrement de 40 €.

```text
Pénalités = montant TTC × taux × jours de retard / 365 + 40 €
```

**Entrées**

- `montantTTC` (montant) — Montant TTC dû — défaut : `6000`
- `echeance` (date) — Date d'échéance — défaut : `2025-03-31`
- `paiement` (date) — Date de paiement — défaut : `2025-05-15`
- `taux` (taux) — Taux annuel des pénalités — défaut : `12.15`
- `indemnite` (booleen) — Appliquer l’indemnité forfaitaire de 40 € — défaut : `true`

**Références**

- Code de commerce art. L.441-10 II — taux minimal = 3 × taux d’intérêt légal ; défaut = taux BCE + 10 points
- Code de commerce art. D.441-5 — indemnité forfaitaire de 40 €

**Exemples vérifiés par les tests**

- *45 jours de retard* → `joursRetard` = 45, `penalites` = 89.88, `total` = 129.88

## <a id="tva"></a>TVA & taxes sur le CA

Conversions HT/TTC, CA3, CA12, autoliquidation, TVA sur marge, coefficients de déduction, régularisations.

### TVA France

#### Conversion HT ↔ TVA ↔ TTC

`POST /api/calc/tva/ht-ttc` — version 1.0.0

À partir de n’importe lequel des trois montants (HT, TVA ou TTC) et du taux, calcule les deux autres. La TVA est arrondie au centime et le TTC est toujours égal à HT + TVA.

```text
TVA = HT × t ; TTC = HT + TVA ; HT = TTC / (1 + t) ; HT = TVA / t
```

**Entrées**

- `depuis` (choix) — Montant connu — défaut : `HT`
- `montant` (montant) — Montant — défaut : `1000`
- `taux` (taux) — Taux de TVA — défaut : `20`
- `dateOperation` (date, optionnel) — Date de l’opération (contrôle du taux)

**Références**

- CGI art. 278 à 281 nonies — taux de TVA
- CGI art. 266 — base d’imposition
- CGI ann. II art. 242 nonies A — arrondi de la TVA par taux

**Barèmes** : `tva.taux`

**Exemples vérifiés par les tests**

- *HT → TTC à 20 %* → `ht` = 1000.00, `tva` = 200.00, `ttc` = 1200.00
- *TTC → HT à 5,5 %* → `ht` = 100.00, `tva` = 5.50
- *TTC non rond à 20 %* → `ht` = 83.33, `tva` = 16.66, `ttc` = 99.99
- *TVA → HT à 10 %* → `ht` = 450.00, `ttc` = 495.00

#### Facture multi-taux

`POST /api/calc/tva/facture-multi-taux` — version 1.0.0

Calcule chaque ligne (quantité × PU × remise), ventile les bases par taux, calcule la TVA par taux (arrondie une fois par taux) et les totaux de la facture.

```text
Ligne HT = Q × PU × (1 − remise) ; TVA(t) = arrondi(Σ bases(t) × t) ; TTC = Σ HT + Σ TVA
```

**Entrées**

- `lignes` (table) — Lignes de facture
- `remiseGlobale` (taux) — Remise globale — défaut : `0`

**Références**

- CGI art. 278 à 281 nonies — taux de TVA
- CGI ann. II art. 242 nonies A — mentions obligatoires, TVA par taux
- CGI art. 289 — obligation de facturation

**Exemples vérifiés par les tests**

- *Facture trois taux* → `totalHT` = 2304.22, `totalTVA` = 421.58, `totalTTC` = 2725.80

#### Exigibilité : TVA sur les débits / sur les encaissements

`POST /api/calc/tva/exigibilite` — version 1.0.0

Détermine pour chaque opération la date d'exigibilité (livraison pour les biens, encaissement pour les services sauf option pour les débits) et totalise la TVA exigible sur la période et la TVA en attente.

```text
Biens : exigible à la livraison ; services : à l’encaissement (ou à la facturation si option débits) ; TVA = TTC × t / (1 + t)
```

**Entrées**

- `debut` (date) — Début de période — défaut : `2025-03-01`
- `fin` (date) — Fin de période — défaut : `2025-03-31`
- `optionDebits` (booleen) — Option pour le paiement de la TVA d’après les débits — défaut : `false`
- `operations` (table) — Opérations

**Références**

- CGI art. 269-2 a et c — fait générateur et exigibilité
- BOI-TVA-BASE-20-10

**Exemples vérifiés par les tests**

- *Encaissements* → `tvaExigible` = 1600.00, `tvaEnAttente` = 400.00
- *Option débits* → `tvaExigible` = 1000.00, `tvaEnAttente` = 0.00

#### Autoliquidation de la TVA

`POST /api/calc/tva/autoliquidation` — version 1.0.0

Le preneur assujetti déclare la TVA due et la déduit simultanément. Calcule la TVA due, la TVA déductible, le coût net et les écritures selon le cas d’autoliquidation.

```text
TVA due = HT × t ; TVA déductible = TVA due × coefficient de déduction
```

**Entrées**

- `cas` (choix) — Cas d’autoliquidation — défaut : `btp`
- `ht` (montant) — Montant HT — défaut : `25000`
- `taux` (taux) — Taux de TVA — défaut : `20`
- `coefficient` (taux) — Coefficient de déduction — défaut : `100`

**Références**

- CGI art. 283-2 nonies — Sous-traitance BTP
- CGI art. 283-2 sexies — Déchets neufs d’industrie et matières de récupération
- CGI art. 283-1 al. 2 et 283-2 — Prestataire non établi en France
- CGI art. 1695 II — Importation (autoliquidation obligatoire)
- CGI art. 283-2 quinquies — Gaz, électricité, chaleur, froid
- CGI art. 283-2 septies — Quotas d’émission de gaz à effet de serre

**Exemples vérifiés par les tests**

- *Sous-traitance BTP* → `tvaDue` = 5000.00, `tvaDeductible` = 5000.00, `coutNet` = 0.00, `decaissementFournisseur` = 25000.00
- *Coefficient 50 %* → `coutNet` = 2500.00

### Déclarations

#### TVA à payer ou crédit de TVA

`POST /api/calc/tva/tva-a-payer` — version 1.0.0

Détermine la TVA nette due ou le crédit de TVA, et l’éligibilité au remboursement du crédit selon le régime.

```text
TVA due = collectée − déductible (ABS + immobilisations) − crédit antérieur ; crédit si < 0
```

**Entrées**

- `collectee` (montant) — TVA collectée — défaut : `18450`
- `deductibleAbs` (montant) — TVA déductible sur ABS — défaut : `9320`
- `deductibleImmo` (montant) — TVA déductible sur immobilisations — défaut : `4800`
- `creditAnterieur` (montant) — Crédit de TVA antérieur reporté — défaut : `0`
- `regularisations` (montant) — TVA à reverser / régularisations (+) — défaut : `0`
- `regime` (choix) — Régime — défaut : `mensuel`
- `dateOperation` (date) — Date de la déclaration — défaut : `2025-01-31`

**Références**

- CGI art. 271 — droit à déduction
- CGI ann. II art. 242-0 A à 242-0 C — remboursement des crédits de TVA

**Barèmes** : `tva.seuils`

**Exemples vérifiés par les tests**

- *TVA due* → `tvaNette` = 4330.00, `credit` = 0.00
- *Crédit remboursable* → `tvaNette` = 0.00, `credit` = 8000.00, `remboursable` = oui

#### Déclaration CA3 (3310-CA3)

`POST /api/calc/tva/ca3` — version 1.0.0

Remplit automatiquement les lignes du cadre B de la déclaration CA3 (taxation par taux, TVA brute, déductions, crédit ou TVA nette due) à partir des bases et de la TVA déductible, avec arrondi fiscal à l’euro par ligne.

```text
L16 = Σ TVA(08…11) + L15 + L5B ; L23 = L19 + L20 + L21 + L22 + L2C ; L28 = max(0, L16 − L23) ; L25 = max(0, L23 − L16)
```

**Entrées**

- `base20` (montant) — Ventes et prestations à 20 % (base HT) — défaut : `84250`
- `base10` (montant) — à 10 % (base HT) — défaut : `12400`
- `base55` (montant) — à 5,5 % (base HT) — défaut : `3150`
- `base21` (montant) — à 2,1 % (base HT) — défaut : `0`
- `base85` (montant) — DOM à 8,5 % (base HT) — défaut : `0`
- `acquisitionsIntra` (montant) — Acquisitions intracommunautaires à 20 % (ligne 03) — défaut : `6000`
- `prestationsUe` (montant) — Achats de prestations UE à 20 % (ligne 2A) — défaut : `1500`
- `importations` (montant) — Importations autoliquidées à 20 % (ligne 2B) — défaut : `0`
- `autresAutoliquidations` (montant) — Autres autoliquidations à 20 % — BTP, déchets (ligne 3B/3C) — défaut : `0`
- `coefficientAutoliquidation` (taux) — Coefficient de déduction de la TVA autoliquidée — défaut : `100`
- `ligne15` (montant) — TVA antérieurement déduite à reverser (15) — défaut : `0`
- `ligne5B` (montant) — Sommes à ajouter, y c. acompte congés (5B) — défaut : `0`
- `ligne19` (montant) — TVA déductible sur immobilisations (19) — défaut : `2400`
- `deductibleAbs` (montant) — TVA déductible sur autres biens et services, hors autoliquidation (20) — défaut : `8640`
- `ligne21` (montant) — Autre TVA à déduire (21) — défaut : `0`
- `ligne22` (montant) — Report du crédit de la déclaration précédente (22) — défaut : `0`
- `ligne2C` (montant) — Sommes à imputer, y c. acompte congés (2C) — défaut : `0`
- `remboursementDemande` (montant) — Remboursement de crédit demandé (26) — défaut : `0`
- `taxesAssimilees` (montant) — Taxes assimilées (29) — défaut : `0`

**Références**

- Formulaire 3310-CA3-SD (cerfa n° 10963) et notice
- CGI art. 287 — obligations déclaratives
- CGI art. 1657 — arrondi à l’euro

**Exemples vérifiés par les tests**

- *Mois type* → `l16` = 19763, `l23` = 12540, `l28` = 7223, `l25` = 0, `l32` = 7223

#### Déclaration annuelle CA12 et acomptes

`POST /api/calc/tva/ca12` — version 1.0.0

Régime simplifié : TVA due de l'exercice, imputation des acomptes semestriels versés, solde à payer ou crédit, et calcul des acomptes de l'année suivante (55 % en juillet, 40 % en décembre).

```text
Solde = TVA brute − déductible − crédit antérieur − acomptes ; acomptes N+1 = 55 % / 40 % × (TVA due N avant déduction immobilisations)
```

**Entrées**

- `tvaCollectee` (montant) — TVA collectée de l’exercice — défaut : `24600`
- `deductibleAbs` (montant) — TVA déductible ABS — défaut : `11300`
- `deductibleImmo` (montant) — TVA déductible sur immobilisations — défaut : `2500`
- `creditAnterieur` (montant) — Crédit antérieur — défaut : `0`
- `acompteJuillet` (montant) — Acompte versé en juillet — défaut : `5500`
- `acompteDecembre` (montant) — Acompte versé en décembre — défaut : `4000`
- `dateOperation` (date) — Date de clôture — défaut : `2024-12-31`

**Références**

- CGI art. 287-3 — régime simplifié, acomptes semestriels
- Formulaire 3517-S-SD (CA12)

**Barèmes** : `tva.seuils`

**Exemples vérifiés par les tests**

- *Exercice 2024* → `tvaDue` = 10800.00, `solde` = 1300.00, `acompteJuilletN1` = 7315.00, `acompteDecembreN1` = 5320.00

### International

#### TVA intracommunautaire

`POST /api/calc/tva/intracommunautaire` — version 1.0.0

Traitement des acquisitions et livraisons intracommunautaires de biens et des prestations de services B2B : TVA autoliquidée, exonération, lignes CA3, mentions et obligations déclaratives.

```text
Acquisition : TVA due = HT × t, déductible = TVA × coefficient ; livraison : exonérée
```

**Entrées**

- `operation` (choix) — Opération — défaut : `acquisition`
- `ht` (montant) — Montant HT — défaut : `12000`
- `taux` (taux) — Taux de TVA français applicable — défaut : `20`
- `coefficient` (taux) — Coefficient de déduction — défaut : `100`
- `numeroValide` (booleen) — N° de TVA intracommunautaire du partenaire vérifié (VIES) — défaut : `true`

**Références**

- CGI art. 256 bis et 262 ter I — acquisitions et livraisons intracommunautaires
- CGI art. 259 et 283-2 — prestations B2B, autoliquidation
- CGI art. 289 B — déclaration européenne de services (DES)

**Exemples vérifiés par les tests**

- *Acquisition 12 000 € HT* → `tvaDue` = 2400.00, `tvaDeductible` = 2400.00, `coutNet` = 0.00
- *Livraison* → `tvaDue` = 0.00
- *Acquisition, coefficient 80 %* → `tvaDeductible` = 1920.00, `coutNet` = 480.00

#### Obligations déclaratives UE (EMEBI/DEB, DES)

`POST /api/calc/tva/obligations-echanges-ue` — version 1.0.0

Détermine les obligations de déclaration d'échanges de biens (enquête mensuelle EMEBI, ex-DEB) et de déclaration européenne de services selon les flux annuels.

```text
Introductions > seuil → volet statistique ; expéditions → volet fiscal dès 1 € (+ statistique > seuil) ; prestations B2B UE → DES dès 1 €
```

**Entrées**

- `introductions` (montant) — Introductions de biens (achats UE) — annuel — défaut : `520000`
- `expeditions` (montant) — Expéditions de biens (ventes UE) — annuel — défaut : `180000`
- `prestations` (montant) — Prestations B2B rendues à des clients UE — annuel — défaut : `45000`
- `dateOperation` (date) — Année de référence — défaut : `2025-01-01`

**Références**

- CGI art. 289 B et 289 C — état récapitulatif et DES
- Règlement (UE) 2019/2152 — statistiques des échanges (EMEBI)

**Barèmes** : `tva.seuils`

**Exemples vérifiés par les tests**

- *PME exportatrice* → `nbObligations` = 3

#### Importation : droits de douane et TVA

`POST /api/calc/tva/tva-importation` — version 1.0.0

Calcule les droits de douane, la base de TVA à l’importation (valeur en douane + droits + frais jusqu’au premier lieu de destination), la TVA autoliquidée et le coût de revient.

```text
Droits = valeur en douane × taux ; base TVA = valeur + droits + frais accessoires ; TVA = base × t
```

**Entrées**

- `valeurDouane` (montant) — Valeur en douane (CIF) — défaut : `30000`
- `tauxDroits` (taux) — Taux des droits de douane — défaut : `4.2`
- `fraisAccessoires` (montant) — Frais jusqu’au premier lieu de destination — défaut : `850`
- `taux` (taux) — Taux de TVA — défaut : `20`
- `coefficient` (taux) — Coefficient de déduction — défaut : `100`

**Références**

- CGI art. 292 — base d’imposition des importations
- CGI art. 1695 II — autoliquidation obligatoire depuis le 01/01/2022
- Code des douanes de l’Union, art. 70 — valeur transactionnelle

**Exemples vérifiés par les tests**

- *Import 30 000 €* → `droits` = 1260.00, `baseTva` = 32110.00, `tva` = 6422.00, `coutRevient` = 32110.00

### Régimes particuliers

#### TVA sur la marge

`POST /api/calc/tva/tva-sur-marge` — version 1.0.0

Biens d’occasion, œuvres d’art, agences de voyages et opérations immobilières : la TVA est calculée « en dedans » sur la marge TTC.

```text
Marge TTC = prix de vente − prix d’achat ; TVA = Marge TTC × t / (1 + t) ; marge HT = marge TTC − TVA
```

**Entrées**

- `regime` (choix) — Régime — défaut : `occasion`
- `prixVente` (montant) — Prix de vente TTC — défaut : `15800`
- `prixAchat` (montant) — Prix d’achat (ou coût des prestations / prix du terrain) — défaut : `12500`
- `taux` (taux) — Taux de TVA — défaut : `20`

**Références**

- CGI art. 297 A — biens d’occasion, œuvres d’art, objets de collection
- CGI art. 266-1-e et 268 bis — agences de voyages
- CGI art. 268 — immeubles et terrains à bâtir

**Exemples vérifiés par les tests**

- *Véhicule d’occasion* → `margeTTC` = 3300.00, `tva` = 550.00, `margeHT` = 2750.00, `prixVenteHT` = 15250.00
- *Marge négative* → `tva` = 0.00

### Déductions

#### Coefficient de déduction (assujettis partiels)

`POST /api/calc/tva/coefficient-deduction` — version 1.0.0

Calcule le coefficient de déduction = assujettissement × taxation × admission, le coefficient de taxation pouvant être déterminé à partir du chiffre d’affaires, puis la TVA déductible et la TVA non récupérable.

```text
Coef = C_assujettissement × C_taxation × C_admission ; C_taxation = CA ouvrant droit / CA total (arrondi à l’unité supérieure en %)
```

**Entrées**

- `tva` (montant) — TVA d’amont — défaut : `10000`
- `assujettissement` (taux) — Coefficient d’assujettissement — défaut : `100`
- `modeTaxation` (choix) — Coefficient de taxation — défaut : `ca`
- `caDroitDeduction` (montant) — CA ouvrant droit à déduction — défaut : `730000`
- `caTotal` (montant) — CA total (y c. exonéré) — défaut : `960000`
- `taxation` (taux) — Coefficient de taxation — défaut : `100`
- `admission` (taux) — Coefficient d’admission — défaut : `100`

**Références**

- CGI ann. II art. 205 à 207 — coefficient de déduction
- CGI ann. II art. 212 — arrondi du rapport à l’unité supérieure
- BOI-TVA-DED-20-10

**Exemples vérifiés par les tests**

- *Banque-assurance partielle* → `taxation` = 77.00, `coefficient` = 77.00, `deductible` = 7700.00, `nonDeductible` = 2300.00

#### Régularisation de la TVA sur immobilisations

`POST /api/calc/tva/regularisation-immobilisation` — version 1.0.0

Régularisation annuelle lorsque le coefficient de déduction varie de plus de 10 points, ou régularisation globale en cas de cession avant la fin de la période (5 ans pour les biens meubles, 20 ans pour les immeubles).

```text
Annuelle : TVA initiale × (coef N − coef initial) / 5 (ou 20) ; cession : TVA × coef × années restantes / 5 (ou 20)
```

**Entrées**

- `tvaInitiale` (montant) — TVA grevant le bien (totale) — défaut : `40000`
- `coefInitial` (taux) — Coefficient de déduction initial — défaut : `80`
- `bien` (choix) — Nature du bien — défaut : `meuble`
- `evenement` (choix) — Événement — défaut : `annuelle`
- `coefAnnee` (taux) — Coefficient de l’année — défaut : `55`
- `rangAnnee` (entier) — Rang de l’année (1 = année d’acquisition) — défaut : `2`

**Références**

- CGI ann. II art. 207 — régularisations
- BOI-TVA-DED-60-20

**Exemples vérifiés par les tests**

- *Baisse de 25 points* → `regularisation` = -2000.00
- *Cession exonérée année 3* → `regularisation` = -12800.00
- *Cession taxée année 3* → `regularisation` = 3200.00

### Clôture

#### TVA sur FNP et FAE (clôture)

`POST /api/calc/tva/fnp-fae` — version 1.0.0

Calcule la TVA à régulariser sur les factures non parvenues (44586) et les factures à établir (44587) à la clôture, et génère les écritures de rattachement.

```text
TVA = HT × t ; FNP : 6xx + 44586 / 408 ; FAE : 418 / 7xx + 44587
```

**Entrées**

- `pieces` (table) — Pièces à rattacher

**Références**

- PCG art. 944-44 — comptes 408, 418, 44586, 44587
- PCG art. 512-4 — rattachement à l’exercice

**Exemples vérifiés par les tests**

- *Clôture* → `tvaFnp` = 1010.00, `tvaFae` = 1480.00, `totalFnp` = 6060.00, `totalFae` = 8880.00

## <a id="amortissements"></a>Amortissements

Linéaire, dégressif, unités d’œuvre, composants, dérogatoires, cessions, crédit-bail.

### Modes d’amortissement

#### Amortissement linéaire

`POST /api/calc/amortissements/lineaire` — version 1.0.0

Plan d’amortissement linéaire complet avec valeur résiduelle et prorata temporis la première année ; la dernière annuité solde exactement la base.

```text
Annuité = (VO − VR) / n ; 1re annuité × jours / 360 ; VNC = VO − cumul
```

**Entrées**

- `vo` (montant) — Valeur d’origine (HT) — défaut : `24000`
- `vr` (montant) — Valeur résiduelle — défaut : `0`
- `duree` (nombre) — Durée d’utilisation (années) — défaut : `5`
- `miseEnService` (date) — Date de mise en service — défaut : `2024-04-15`
- `premiereCloture` (date) — Date de clôture du 1er exercice — défaut : `2024-12-31`
- `prorata` (choix) — Prorata temporis — défaut : `jours360`

**Références**

- PCG art. 214-13 et 214-14 — plan d’amortissement
- CGI art. 39-1-2° — amortissements déductibles
- BOI-BIC-AMT-20-20-10 — prorata temporis

**Exemples vérifiés par les tests**

- *24 000 € sur 5 ans, 15/04* → `annuite` = 4800.00, `dotation1` = 3413.33, `nbExercices` = 6, `totalDotations` = 24000.00
- *Année pleine* → `dotation1` = 4800.00, `nbExercices` = 5

#### Amortissement dégressif fiscal

`POST /api/calc/amortissements/degressif` — version 1.0.0

Plan dégressif : taux linéaire × coefficient (1,25 / 1,75 / 2,25 selon la durée), prorata en mois dès le mois d’acquisition, bascule automatique en linéaire sur la durée restante.

```text
Taux = (1/n) × coef ; annuité = VNC × taux ; bascule quand VNC / années restantes ≥ VNC × taux
```

**Entrées**

- `vo` (montant) — Valeur d’origine (HT) — défaut : `10000`
- `duree` (entier) — Durée (années, ≥ 3) — défaut : `5`
- `acquisition` (date) — Date d’acquisition — défaut : `2024-04-01`
- `premiereCloture` (date) — Clôture du 1er exercice — défaut : `2024-12-31`
- `coefficientManuel` (booleen) — Forcer le coefficient — défaut : `false`
- `coefficient` (nombre) — Coefficient — défaut : `1.75`

**Références**

- CGI art. 39 A — amortissement dégressif
- CGI ann. II art. 15 bis — coefficients et biens éligibles
- BOI-BIC-AMT-20-20-20

**Exemples vérifiés par les tests**

- *Manuel BOFiP-type : 10 000 €, 5 ans, 01/04* → `taux` = 35.00, `dotation1` = 2625.00, `dotation2` = 2581.25, `dotation3` = 1677.81, `dotation4` = 1557.97, `dotation5` = 1557.97, `rangBascule` = 4 (source : Calcul manuel conforme BOI-BIC-AMT-20-20-20-20)

#### Amortissement par unités d’œuvre

`POST /api/calc/amortissements/unites-oeuvre` — version 1.0.0

Amortissement variable en fonction de l’utilisation (kilomètres, heures machine, pièces produites).

```text
Dotation = (VO − VR) × unités de l’exercice / unités totales prévues
```

**Entrées**

- `vo` (montant) — Valeur d’origine — défaut : `180000`
- `vr` (montant) — Valeur résiduelle — défaut : `20000`
- `unitesTotales` (nombre) — Unités d’œuvre totales prévues — défaut : `400000`
- `unitesAnnuelles` (liste) — Unités consommées par exercice

**Références**

- PCG art. 214-13 et 214-14 — plan d’amortissement
- PCG art. 214-13 — mode reflétant le rythme de consommation des avantages

**Exemples vérifiés par les tests**

- *Machine 400 000 pièces* → `coutUnitaire` = 0.4, `dotation1` = 26000.00, `totalDotations` = 160000.00

#### Amortissement par composants

`POST /api/calc/amortissements/composants` — version 1.0.0

Décompose une immobilisation en structure et composants ayant des durées distinctes ; chaque composant suit son propre plan linéaire, les dotations sont consolidées par exercice.

```text
Structure = VO − Σ composants ; dotation(N) = Σ dotations linéaires des composants
```

**Entrées**

- `vo` (montant) — Valeur d’origine totale — défaut : `850000`
- `dureeStructure` (nombre) — Durée de la structure (années) — défaut : `40`
- `miseEnService` (date) — Mise en service — défaut : `2024-07-01`
- `premiereCloture` (date) — Clôture du 1er exercice — défaut : `2024-12-31`
- `composants` (table) — Composants

**Références**

- PCG art. 214-9 — approche par composants
- BOI-BIC-AMT-10-40-10

**Exemples vérifiés par les tests**

- *Immeuble de bureaux* → `structure` = 540000.00, `dotation1` = 15441.67, `dotation2` = 30883.33

### Écarts comptable / fiscal

#### Amortissements dérogatoires

`POST /api/calc/amortissements/derogatoire` — version 1.0.0

Compare le plan comptable (durée d’usage, linéaire) au plan fiscal (dégressif ou durée d’usage fiscale) et calcule les dotations et reprises dérogatoires année par année.

```text
Dérogatoire(N) = amortissement fiscal(N) − amortissement comptable(N) ; > 0 : dotation 6872 / 145 ; < 0 : reprise 145 / 7872
```

**Entrées**

- `vo` (montant) — Valeur d’origine — défaut : `50000`
- `acquisition` (date) — Acquisition / mise en service — défaut : `2024-01-01`
- `premiereCloture` (date) — Clôture du 1er exercice — défaut : `2024-12-31`
- `dureeComptable` (nombre) — Durée comptable (usage réel) — défaut : `8`
- `modeFiscal` (choix) — Plan fiscal — défaut : `degressif`
- `dureeFiscale` (entier) — Durée fiscale (années) — défaut : `5`

**Références**

- PCG art. 214-17 — amortissements dérogatoires
- CGI art. 39 B — obligation d’amortissement minimal
- PCG art. 941-14 — compte 145

**Exemples vérifiés par les tests**

- *Linéaire 8 ans / dégressif 5 ans* → `derogatoire1` = 11250.00

#### Véhicule de tourisme : amortissement non déductible

`POST /api/calc/amortissements/vehicule-tourisme` — version 1.0.0

Détermine le plafond fiscal selon le taux d’émission de CO₂ (WLTP) et la quote-part d’amortissement à réintégrer chaque année.

```text
Réintégration = amortissement × (prix TTC − plafond) / prix TTC
```

**Entrées**

- `prixTTC` (montant) — Prix d’acquisition TTC (TVA non récupérable) — défaut : `42000`
- `co2` (entier) — Émissions CO₂ WLTP (g/km) — défaut : `128`
- `duree` (nombre) — Durée d’amortissement (années) — défaut : `5`
- `dateOperation` (date) — Date d’acquisition — défaut : `2024-03-01`
- `premiereCloture` (date) — Clôture du 1er exercice — défaut : `2024-12-31`

**Références**

- CGI art. 39-4 — plafonnement de l’amortissement des véhicules de tourisme
- BOI-BIC-AMT-20-40-50

**Barèmes** : `amortissement.plafonds-vp`

**Exemples vérifiés par les tests**

- *Berline 128 g* → `plafond` = 18300.00, `reintegration1` = 3950.00, `reintegrationTotale` = 23700.00

### Cessions

#### Cession d’immobilisation : dotation complémentaire et plus-value

`POST /api/calc/amortissements/cession` — version 1.0.0

Calcule la dotation complémentaire de l’exercice de cession, le cumul des amortissements, la VNC, la plus ou moins-value comptable et sa ventilation fiscale court terme / long terme, avec les écritures de sortie.

```text
VNC = VO − Σ amortissements ; PV = prix de cession − VNC ; PV CT = min(PV, amortissements) si détention ≥ 2 ans
```

**Entrées**

- `vo` (montant) — Valeur d’origine — défaut : `24000`
- `duree` (nombre) — Durée d’amortissement (années) — défaut : `5`
- `miseEnService` (date) — Mise en service — défaut : `2022-07-01`
- `premiereCloture` (date) — Clôture du 1er exercice — défaut : `2022-12-31`
- `dateCession` (date) — Date de cession — défaut : `2025-03-31`
- `prixCession` (montant) — Prix de cession HT — défaut : `12500`
- `derogatoiresCumules` (montant) — Amortissements dérogatoires cumulés (145) — défaut : `0`

**Références**

- PCG art. 214-19 — sortie d’actif
- CGI art. 39 duodecies — plus-values à court et long terme
- PCG art. 946-67 et 947-77 — comptes 675 et 775

**Exemples vérifiés par les tests**

- *Cession après 2 ans 9 mois* → `dotationComplementaire` = 1200.00, `cumulAmortissements` = 13200.00, `vnc` = 10800.00, `plusValue` = 1700.00, `pvCourtTerme` = 1700.00, `pvLongTerme` = 0.00

### Incorporels

#### Fonds commercial

`POST /api/calc/amortissements/fonds-commercial` — version 1.0.0

Traitement comptable (non amortissable sauf durée limitée ou option des petites entreprises sur 10 ans) et fiscal (déduction temporaire de l’amortissement pour les fonds acquis du 01/01/2022 au 31/12/2025).

```text
Dotation = valeur / durée (si amortissable) ; déductible si acquisition dans la fenêtre fiscale, sinon réintégrée
```

**Entrées**

- `valeur` (montant) — Valeur du fonds commercial — défaut : `150000`
- `acquisition` (date) — Date d’acquisition — défaut : `2024-05-01`
- `premiereCloture` (date) — Clôture du 1er exercice — défaut : `2024-12-31`
- `traitement` (choix) — Traitement comptable — défaut : `non-amorti`
- `duree` (nombre) — Durée (années) — défaut : `10`

**Références**

- PCG art. 214-3 — durée d’utilisation non limitée, option 10 ans des petites entreprises
- CGI art. 39-1-2° al. 2 (loi de finances 2022, art. 23) — déduction temporaire

**Exemples vérifiés par les tests**

- *Option 10 ans, acquis 2024* → `dotation1` = 10000.00, `deductible1` = 10000.00
- *Non amorti* → `dotation1` = 0.00

#### Frais d’établissement, R&D, logiciels, brevets

`POST /api/calc/amortissements/incorporels` — version 1.0.0

Plan comptable et plan fiscal propres à chaque incorporel (frais d’établissement ≤ 5 ans, développement, logiciel acquis amortissable fiscalement sur 12 mois, brevet ≥ 5 ans) et amortissements dérogatoires associés.

```text
Comptable : linéaire sur la durée d’usage ; fiscal : règle propre à l’actif ; dérogatoire = fiscal − comptable
```

**Entrées**

- `nature` (choix) — Nature — défaut : `etablissement`
- `valeur` (montant) — Valeur — défaut : `36000`
- `dureeComptable` (nombre) — Durée comptable (années) — défaut : `3`
- `miseEnService` (date) — Mise en service — défaut : `2024-10-01`
- `premiereCloture` (date) — Clôture du 1er exercice — défaut : `2024-12-31`

**Références**

- PCG art. 212-9 — frais d’établissement (5 ans maximum)
- PCG art. 212-3 et 212-9 — frais de développement
- CGI art. 236 I — déduction immédiate des dépenses de recherche
- CGI art. 236 II — logiciels acquis : amortissement exceptionnel sur 12 mois
- CGI art. 39-1-2° — brevets : 5 ans minimum

**Exemples vérifiés par les tests**

- *Logiciel 3 ans / 12 mois fiscal* → `comptable1` = 3000.00, `fiscal1` = 9000.00, `derogatoire1` = 6000.00

### Crédit-bail

#### Retraitement du crédit-bail

`POST /api/calc/amortissements/credit-bail` — version 1.0.0

Retraite un contrat de crédit-bail comme une acquisition financée par emprunt (méthode préférentielle) : taux implicite, tableau de la dette, amortissement théorique du bien et impact annuel sur le résultat.

```text
Valeur du bien = Σ redevances actualisées + option actualisée au taux implicite ; impact = redevances − (intérêts + dotation)
```

**Entrées**

- `valeurBien` (montant) — Valeur du bien à la signature — défaut : `60000`
- `redevance` (montant) — Redevance périodique HT — défaut : `3300`
- `nbRedevances` (entier) — Nombre de redevances — défaut : `20`
- `periodicite` (choix) — Périodicité — défaut : `4`
- `terme` (choix) — Paiement — défaut : `echoir`
- `optionAchat` (montant) — Option d’achat — défaut : `600`
- `dureeUtilisation` (nombre) — Durée d’utilisation du bien (années) — défaut : `7`

**Références**

- Règlement ANC 2020-01, art. 272-2 — retraitement des contrats de location-financement (méthode préférentielle)
- PCG art. 212-5 et annexe — information sur les engagements de crédit-bail
- IFRS 16 — contrats de location

**Exemples vérifiés par les tests**

- *Machine 60 000 € — 20 trimestres* → `tauxPeriodique` = 1.1156, `interets1` = 2350.36, `dotation1` = 8571.43

## <a id="provisions"></a>Provisions & dépréciations

Créances douteuses, stocks, titres, risques et charges, retraites, tests de dépréciation.

### Créances

#### Dépréciation d’une créance douteuse

`POST /api/calc/provisions/creance-douteuse` — version 1.0.0

Reclasse la créance en 416, calcule la dépréciation sur la base hors taxes selon le risque estimé et l’ajustement par rapport à la dépréciation existante.

```text
Base HT = créance TTC / (1 + t) ; dépréciation = base HT × % de perte probable ; variation = nouvelle − existante
```

**Entrées**

- `creanceTTC` (montant) — Créance TTC — défaut : `14400`
- `tauxTva` (taux) — Taux de TVA de la facture — défaut : `20`
- `risque` (taux) — Perte probable estimée — défaut : `40`
- `depreciationExistante` (montant) — Dépréciation déjà constituée — défaut : `0`
- `dejaReclassee` (booleen) — Créance déjà en 416 — défaut : `false`

**Références**

- PCG art. 214-25 et 944-49 — dépréciation des créances (491)
- CGI art. 39-1-5° — déductibilité des provisions pour créances douteuses individualisées
- BOI-BIC-PROV-30-20-10

**Exemples vérifiés par les tests**

- *Client en redressement* → `baseHT` = 12000.00, `depreciation` = 4800.00, `variation` = 4800.00
- *Ajustement à la baisse* → `depreciation` = 3000.00, `variation` = -1800.00

#### Dépréciation statistique des créances

`POST /api/calc/provisions/provision-statistique` — version 1.0.0

Applique des taux de perte par tranche d’ancienneté du poste clients (balance âgée). Méthode admise comptablement ; fiscalement, seules les dépréciations individualisées sont déductibles.

```text
Dépréciation = Σ (encours HT de la tranche × taux de perte historique)
```

**Entrées**

- `tranches` (table) — Balance âgée (HT)
- `depreciationExistante` (montant) — Dépréciation existante — défaut : `15000`
- `fiscalementJustifiee` (booleen) — Statistiques historiques fiables et documentées — défaut : `false`

**Références**

- PCG art. 214-25 — dépréciation à hauteur de la perte probable
- CE 23/01/1985 n° 41226 et BOI-BIC-PROV-30-20-10 — provision globale non déductible sauf statistiques fiables

**Exemples vérifiés par les tests**

- *Balance âgée* → `depreciation` = 21400.00, `variation` = 6400.00, `reintegration` = 21400.00

### Stocks et titres

#### Dépréciation des stocks

`POST /api/calc/provisions/depreciation-stocks` — version 1.0.0

Compare pour chaque article le coût d’entrée à la valeur nette de réalisation et calcule la dépréciation, puis la dotation ou reprise par rapport à l’existant.

```text
Dépréciation = Σ quantité × max(0 ; coût unitaire − VNR unitaire)
```

**Entrées**

- `articles` (table) — Articles
- `depreciationExistante` (montant) — Dépréciation existante (39x) — défaut : `2500`
- `nature` (choix) — Nature du stock — défaut : `marchandises`

**Références**

- PCG art. 214-25 et 213-7 — évaluation à la clôture, valeur actuelle
- CGI art. 38-3 — stocks évalués au cours du jour s’il est inférieur

**Exemples vérifiés par les tests**

- *Trois articles* → `valeurStock` = 21760.00, `depreciation` = 5900.00, `variation` = 3400.00

#### Dépréciation des titres

`POST /api/calc/provisions/depreciation-titres` — version 1.0.0

Compare le coût d’acquisition à la valeur d’inventaire (cours moyen du dernier mois pour les titres cotés, valeur d’utilité pour les participations) et calcule la dépréciation et son traitement fiscal.

```text
Dépréciation = nombre × max(0 ; coût unitaire − valeur d’inventaire unitaire)
```

**Entrées**

- `categorie` (choix) — Catégorie — défaut : `participation`
- `nombre` (nombre) — Nombre de titres — défaut : `2000`
- `coutUnitaire` (montant) — Coût d’acquisition unitaire — défaut : `45.80`
- `valeurInventaire` (montant) — Valeur d’inventaire unitaire — défaut : `38.15`
- `depreciationExistante` (montant) — Dépréciation existante — défaut : `0`

**Références**

- PCG art. 221-3 et 221-6 — valeur d’inventaire des titres
- CGI art. 39-1-5° al. 18 — dépréciation des titres de participation (régime LT, non déductible)

**Exemples vérifiés par les tests**

- *Participation dépréciée* → `depreciation` = 15300.00, `variation` = 15300.00, `deductible` = 0.00

### Risques et charges

#### Ajustement, reprise partielle ou totale

`POST /api/calc/provisions/ajustement-provision` — version 1.0.0

Compare la provision existante à la nouvelle estimation et distingue la reprise pour utilisation (charge survenue) de la reprise devenue sans objet.

```text
Variation = estimation − (existante − utilisation) ; reprise = existante − estimation
```

**Entrées**

- `existante` (montant) — Provision existante — défaut : `50000`
- `utilisation` (montant) — Charge effectivement supportée sur l’exercice — défaut : `18000`
- `estimation` (montant) — Nouvelle estimation du risque résiduel — défaut : `20000`
- `nature` (choix) — Nature — défaut : `exploitation`

**Références**

- PCG art. 323-1 à 323-7 — passifs : évaluation à chaque clôture
- PCG art. 946-68 / 947-78

**Exemples vérifiés par les tests**

- *Litige partiellement dénoué* → `repriseUtilisee` = 18000.00, `repriseSansObjet` = 12000.00, `dotation` = 0.00, `provisionFinale` = 20000.00

#### Provision pour risques et charges

`POST /api/calc/provisions/provision-risques` — version 1.0.0

Évalue la provision à partir de scénarios probabilisés (meilleure estimation et espérance), avec actualisation optionnelle pour une sortie de ressources lointaine.

```text
Espérance = Σ montant × probabilité ; meilleure estimation = scénario le plus probable ; VA = montant / (1 + r)^n
```

**Entrées**

- `nature` (choix) — Nature — défaut : `litige`
- `scenarios` (table) — Scénarios
- `methode` (choix) — Montant retenu — défaut : `plus-probable`
- `tauxActualisation` (taux) — Taux d’actualisation — défaut : `0`
- `horizon` (nombre) — Échéance attendue (années) — défaut : `0`
- `existante` (montant) — Provision existante — défaut : `0`

**Références**

- PCG art. 321-1 à 323-12 — définition, comptabilisation et évaluation des passifs
- CGI art. 39-1-5° — conditions de déductibilité

**Exemples vérifiés par les tests**

- *Litige prud’homal* → `esperance` = 54750.00, `retenu` = 45000.00, `provision` = 45000.00
- *Espérance actualisée* → `provision` = 51607.13

#### Provision pour garantie clients

`POST /api/calc/provisions/provision-garantie` — version 1.0.0

Estime le coût futur des garanties sur les ventes à partir du taux de retour historique, du coût moyen de prise en charge et de la durée de garantie restant à courir.

```text
Provision = CA garanti × taux de retour × coût moyen / prix moyen × durée restante / durée totale
```

**Entrées**

- `caGaranti` (montant) — Ventes sous garantie (CA HT) — défaut : `2400000`
- `tauxRetour` (taux) — Taux de retour historique — défaut : `3.5`
- `coutRelatif` (taux) — Coût de prise en charge en % du prix — défaut : `40`
- `dureeTotale` (nombre) — Durée de garantie (mois) — défaut : `24`
- `dureeRestante` (nombre) — Durée moyenne restant à courir (mois) — défaut : `14`
- `existante` (montant) — Provision existante — défaut : `15000`

**Références**

- PCG art. 322-1 — garanties données aux clients (1512)
- BOI-BIC-PROV-30-20-20

**Exemples vérifiés par les tests**

- *Électroménager* → `provision` = 19600.00, `variation` = 4600.00

#### Provision pour gros entretien

`POST /api/calc/provisions/gros-entretien` — version 1.0.0

Répartit le coût d’un programme pluriannuel de gros entretien ou de grandes révisions sur la période qui précède l’intervention.

```text
Dotation annuelle = (coût estimé − provision constituée) / années restantes
```

**Entrées**

- `coutEstime` (montant) — Coût estimé de l’intervention — défaut : `96000`
- `dureeProgramme` (entier) — Durée totale du programme (années) — défaut : `8`
- `anneesEcoulees` (entier) — Années déjà provisionnées — défaut : `3`
- `provisionConstituee` (montant) — Provision déjà constituée — défaut : `36000`

**Références**

- PCG art. 214-10 et 322-3 — provisions pour gros entretien ou grandes révisions
- CGI art. 39-1-5° — dépenses précisément évaluées et programmées

**Exemples vérifiés par les tests**

- *Ravalement à 8 ans* → `dotation` = 12000.00, `provisionCible` = 48000.00

### Retraites

#### Engagement d’indemnités de fin de carrière

`POST /api/calc/provisions/indemnites-retraite` — version 1.0.0

Évalue l’engagement de retraite d’un salarié par la méthode des unités de crédit projetées : droits à la date de départ, revalorisation, probabilité de présence (rotation, survie), actualisation, charges sociales et prorata des droits acquis.

```text
Engagement = M × (1 + g)^T × droits(A + T) × A / (A + T) × (1 − rotation)^T × survie × (1 + r)^−T × (1 + charges)
```

**Entrées**

- `salaireMensuel` (montant) — Salaire mensuel brut de référence — défaut : `3500`
- `anciennete` (nombre) — Ancienneté actuelle (années) — défaut : `12`
- `age` (entier) — Âge actuel — défaut : `45`
- `ageDepart` (entier) — Âge de départ prévu — défaut : `64`
- `modeDepart` (choix) — Modalité de départ — défaut : `volontaire`
- `moisConventionnels` (nombre) — Mois d’indemnité conventionnelle au départ — défaut : `3`
- `revalorisation` (taux) — Revalorisation annuelle des salaires — défaut : `2`
- `rotation` (taux) — Taux de rotation annuel — défaut : `3`
- `survie` (taux) — Probabilité de survie jusqu’au départ — défaut : `92`
- `actualisation` (taux) — Taux d’actualisation — défaut : `3.5`
- `charges` (taux) — Taux de charges sociales patronales — défaut : `45`

**Références**

- Recommandation ANC 2013-02 (révisée 2021) — évaluation des engagements de retraite
- PCG art. 324-1 — méthode préférentielle de comptabilisation
- IAS 19 — avantages du personnel (méthode des unités de crédit projetées)
- Code du travail art. D.1237-1 (départ volontaire) et R.1234-2 (mise à la retraite)

**Exemples vérifiés par les tests**

- *Cadre de 45 ans* → `moisDroits` = 2, `anneesRestantes` = 19, `engagement` = 1535.58

### Dépréciation d’actifs

#### Test de dépréciation (valeur recouvrable)

`POST /api/calc/provisions/test-depreciation` — version 1.0.0

Détermine la valeur d’utilité par actualisation des flux futurs (avec valeur terminale de Gordon-Shapiro), la valeur recouvrable = max(valeur vénale nette, valeur d’utilité) et la dépréciation à constater.

```text
VU = Σ CFt / (1 + r)^t + [CFn × (1 + g) / (r − g)] / (1 + r)^n ; dépréciation = max(0 ; VNC − max(JV − coûts de sortie ; VU))
```

**Entrées**

- `vnc` (montant) — Valeur nette comptable de l’actif / UGT — défaut : `2500000`
- `valeurVenaleNette` (montant) — Juste valeur diminuée des coûts de sortie — défaut : `1900000`
- `flux` (liste) — Flux de trésorerie futurs (années 1 à n)
- `taux` (taux) — Taux d’actualisation (CMPC avant impôt) — défaut : `9.5`
- `valeurTerminale` (booleen) — Inclure une valeur terminale — défaut : `true`
- `croissance` (taux) — Croissance à l’infini — défaut : `1.5`

**Références**

- PCG art. 214-15 à 214-19 — dépréciation des actifs
- IAS 36 — dépréciation d’actifs (UGT, valeur recouvrable)

**Exemples vérifiés par les tests**

- *UGT industrielle* → `valeurUtilite` = 4313626.14, `depreciation` = 0.00

### Provisions réglementées

#### Provision pour hausse des prix

`POST /api/calc/provisions/provision-hausse-prix` — version 1.0.0

Provision réglementée lorsque le prix unitaire d’une matière ou d’un produit augmente de plus de 10 % sur une période de deux exercices au plus.

```text
Provision = quantité × (prix fin − prix début) − 10 % × quantité × prix début, si hausse > 10 %
```

**Entrées**

- `quantite` (nombre) — Quantité en stock à la clôture — défaut : `12000`
- `prixDebut` (montant) — Prix unitaire en début de période (≤ 2 exercices) — défaut : `4.20`
- `prixFin` (montant) — Prix unitaire à la clôture — défaut : `5.10`

**Références**

- CGI art. 39-1-5° al. 11 — provision pour hausse des prix
- BOI-BIC-PROV-60-100

**Exemples vérifiés par les tests**

- *Hausse de 21 %* → `hausse` = 21.43, `provision` = 5760.00

### Change

#### Écarts de conversion et provision pour perte de change

`POST /api/calc/provisions/ecarts-conversion` — version 1.0.0

Réévalue à la clôture les créances et dettes en devises, constate les écarts de conversion actif (476) et passif (477) et la provision pour perte de change, avec option de position globale de change.

```text
Écart = montant devise × (cours clôture − cours historique) ; perte latente → 476 + provision 1515 ; gain latent → 477
```

**Entrées**

- `elements` (table) — Créances et dettes en devises
- `positionGlobale` (booleen) — Position globale de change (même devise / échéances voisines) — défaut : `false`

**Références**

- PCG art. 420-5 à 420-7 — conversion des opérations en devises à la clôture
- PCG art. 420-8 — position globale de change
- CGI art. 38-4 — écarts de conversion fiscalement imposables/déductibles

**Exemples vérifiés par les tests**

- *Portefeuille trois devises* → `eca` = 2100.00, `ecp` = 900.00, `provision` = 2100.00

## <a id="paie"></a>Paie & cotisations

Bulletin complet, cotisations, CSG/CRDS, PAS, réduction générale, indemnités de rupture.

### Bulletin

#### Bulletin de paie complet

`POST /api/calc/paie/bulletin` — version 1.0.0

Calcule intégralement un bulletin mensuel : brut, tranches, toutes les cotisations salariales et patronales, CSG/CRDS, réduction générale, dispositifs heures supplémentaires, net imposable, prélèvement à la source, net à payer et coût employeur, avec contrôles de cohérence.

```text
Brut → Σ cotisations (assiette × taux) → net = brut − cotisations salariales → PAS → net à payer ; coût = brut + cotisations patronales
```

**Entrées**

- `dateOperation` (date) — Période de paie (date) — défaut : `2024-06-30`
- `statut` (choix) — Statut — défaut : `non-cadre`
- `effectif` (choix) — Effectif de l’entreprise — défaut : `20-49`
- `salaireBase` (montant) — Salaire de base mensuel brut — défaut : `3200`
- `heuresContrat` (nombre) — Heures mensuelles contractuelles — défaut : `151.67`
- `hs25` (nombre) — Heures supplémentaires à 25 % — défaut : `0`
- `hs50` (nombre) — Heures supplémentaires à 50 % — défaut : `0`
- `primes` (montant) — Primes soumises — défaut : `0`
- `avantagesNature` (montant) — Avantages en nature — défaut : `0`
- `absences` (montant) — Retenue pour absences — défaut : `0`
- `fraisNonSoumis` (montant) — Indemnités non soumises (transport, frais) — défaut : `0`
- `tauxAT` (taux) — Taux accident du travail — défaut : `1.5`
- `tauxVM` (taux) — Taux de versement mobilité — défaut : `0`
- `mutuelleSalarie` (montant) — Complémentaire santé — part salariale — défaut : `0`
- `mutuellePatronale` (montant) — Complémentaire santé — part patronale — défaut : `0`
- `prevoyanceSalarie` (montant) — Prévoyance — part salariale — défaut : `0`
- `prevoyancePatronale` (montant) — Prévoyance — part patronale (hors minimum cadre) — défaut : `0`
- `modePas` (choix) — Prélèvement à la source — défaut : `personnalise`
- `tauxPAS` (taux) — Taux de PAS — défaut : `0`
- `alsaceMoselle` (booleen) — Régime local Alsace-Moselle — défaut : `false`

**Références**

- Code de la sécurité sociale, art. L.241-1 à L.242-1 et D.242-3 et s.
- [URSSAF — taux et montants en vigueur](https://www.urssaf.fr/accueil/outils-documentation/taux-baremes.html)
- CSS art. L.136-1-1 et L.136-8 — CSG (assiette 98,25 %)
- CSS art. L.241-13 et D.241-7 — réduction générale
- CSS art. L.241-17 et L.241-18 — heures supplémentaires
- CGI art. 204 A et s. — prélèvement à la source
- Code du travail art. R.3243-1 — mentions du bulletin

**Barèmes** : `paie.constantes`, `paie.cotisations`, `paie.pas-metropole`

**Exemples vérifiés par les tests**

- *Non-cadre 3 200 €, juin 2024* → `brut` = 3200.00, `cotisationsSalariales` = 666.89, `netAvantImpot` = 2533.11, `reductionGenerale` = 0.00
- *Salarié au SMIC, 2024 (réduction générale)* → `brut` = 1766.96, `reductionGenerale` = 563.84 (source : Coefficient maximal T = 0,3191 (FNAL 0,10 %) au niveau du SMIC)

#### Calcul inverse : net → brut

`POST /api/calc/paie/net-vers-brut` — version 1.0.0

Détermine le salaire de base brut permettant d’atteindre un net avant impôt cible (ou un net à payer), en résolvant le bulletin complet par dichotomie.

```text
Trouver B tel que net(bulletin(B)) = net cible (|écart| < 0,005 €)
```

**Entrées**

- `netCible` (montant) — Net cible — défaut : `2500`
- `typeNet` (choix) — Net visé — défaut : `avant-impot`
- `dateOperation` (date) — Période de paie (date) — défaut : `2024-06-30`
- `statut` (choix) — Statut — défaut : `non-cadre`
- `effectif` (choix) — Effectif de l’entreprise — défaut : `20-49`
- `heuresContrat` (nombre) — Heures mensuelles contractuelles — défaut : `151.67`
- `hs25` (nombre) — Heures supplémentaires à 25 % — défaut : `0`
- `hs50` (nombre) — Heures supplémentaires à 50 % — défaut : `0`
- `primes` (montant) — Primes soumises — défaut : `0`
- `avantagesNature` (montant) — Avantages en nature — défaut : `0`
- `absences` (montant) — Retenue pour absences — défaut : `0`
- `fraisNonSoumis` (montant) — Indemnités non soumises (transport, frais) — défaut : `0`
- `tauxAT` (taux) — Taux accident du travail — défaut : `1.5`
- `tauxVM` (taux) — Taux de versement mobilité — défaut : `0`
- `mutuelleSalarie` (montant) — Complémentaire santé — part salariale — défaut : `0`
- `mutuellePatronale` (montant) — Complémentaire santé — part patronale — défaut : `0`
- `prevoyanceSalarie` (montant) — Prévoyance — part salariale — défaut : `0`
- `prevoyancePatronale` (montant) — Prévoyance — part patronale (hors minimum cadre) — défaut : `0`
- `modePas` (choix) — Prélèvement à la source — défaut : `personnalise`
- `tauxPAS` (taux) — Taux de PAS — défaut : `0`
- `alsaceMoselle` (booleen) — Régime local Alsace-Moselle — défaut : `false`

**Références**

- Code de la sécurité sociale, art. L.241-1 à L.242-1 et D.242-3 et s.
- [URSSAF — taux et montants en vigueur](https://www.urssaf.fr/accueil/outils-documentation/taux-baremes.html)

**Barèmes** : `paie.constantes`, `paie.cotisations`

**Exemples vérifiés par les tests**

- *Net 2 500 €* → `salaireBase` = 3158.16, `netObtenu` = 2500.00

### Rémunération

#### Conversion de salaire (horaire, mensuel, annuel)

`POST /api/calc/paie/conversion-salaire` — version 1.0.0

Convertit un salaire entre ses expressions horaire, journalière, mensuelle et annuelle, à temps plein ou partiel, et le compare au SMIC.

```text
Mensuel = horaire × heures mensuelles (35 h → 151,67 h) ; annuel = mensuel × nombre de mois ; journalier = mensuel / 21,67
```

**Entrées**

- `dateOperation` (date) — Date — défaut : `2025-06-30`
- `depuis` (choix) — Montant connu — défaut : `mensuel`
- `montant` (montant) — Montant — défaut : `2400`
- `heuresHebdo` (nombre) — Heures hebdomadaires — défaut : `35`
- `nbMois` (nombre) — Nombre de mois versés par an — défaut : `12`

**Références**

- Code du travail art. L.3121-27 — durée légale 35 h
- Code du travail art. L.3231-2 — SMIC

**Barèmes** : `paie.constantes`

**Exemples vérifiés par les tests**

- *2 400 € mensuels* → `horaire` = 15.8238, `annuel` = 28800.00, `journalier` = 110.75, `ratioSmic` = 133.20

#### Heures supplémentaires

`POST /api/calc/paie/heures-supplementaires` — version 1.0.0

Ventile les heures au-delà de 35 h par semaine entre majoration à 25 % (8 premières) et 50 %, calcule la rémunération, la réduction de cotisations salariales, la déduction patronale et contrôle les durées maximales.

```text
HS25 = min(h − 35 ; 8) ; HS50 = max(h − 43 ; 0) ; montant = TH × (1,25 × HS25 + 1,5 × HS50)
```

**Entrées**

- `dateOperation` (date) — Date — défaut : `2024-06-30`
- `tauxHoraire` (montant) — Taux horaire brut — défaut : `16.50`
- `semaines` (table) — Heures travaillées par semaine
- `majorations` (choix) — Majorations — défaut : `legales`
- `majoration1` (taux) — Majoration des premières heures — défaut : `10`
- `majoration2` (taux) — Majoration au-delà de 8 heures — défaut : `25`
- `effectif` (choix) — Effectif — défaut : `1-10`

**Références**

- Code du travail art. L.3121-28 et L.3121-36 — majorations
- Code du travail art. L.3121-20 — 48 h maximum par semaine
- CSS art. L.241-17 (réduction salariale) et L.241-18 (déduction patronale)
- CGI art. 81 quater — exonération d’IR jusqu’à 7 500 € par an

**Barèmes** : `paie.cotisations`

**Exemples vérifiés par les tests**

- *Mois de juin* → `hs25` = 19, `hs50` = 1.5, `montant` = 429.00, `deductionPatronale` = 30.75, `reductionSalariale` = 48.52

#### Heures complémentaires (temps partiel)

`POST /api/calc/paie/heures-complementaires` — version 1.0.0

Calcule les heures complémentaires d’un salarié à temps partiel : majoration de 10 % jusqu’au dixième de la durée contractuelle, 25 % au-delà, dans la limite du tiers.

```text
HC10 = min(HC ; durée/10) ; HC25 = HC − HC10 ; plafond : durée/3 et < 35 h
```

**Entrées**

- `dureeContrat` (nombre) — Durée contractuelle hebdomadaire — défaut : `24`
- `heuresTravaillees` (nombre) — Heures travaillées dans la semaine — défaut : `29`
- `tauxHoraire` (montant) — Taux horaire brut — défaut : `13.20`
- `accordTiers` (booleen) — Accord collectif portant la limite au tiers — défaut : `true`

**Références**

- Code du travail art. L.3123-8, L.3123-20 et L.3123-29

**Exemples vérifiés par les tests**

- *Contrat 24 h* → `hc10` = 2.4, `hc25` = 2.6, `montant` = 77.75

### Avantages en nature

#### Avantage en nature véhicule

`POST /api/calc/paie/avantage-vehicule` — version 1.0.0

Évaluation forfaitaire mensuelle de l’avantage lié à la mise à disposition permanente d’un véhicule (achat ou location, carburant pris en charge ou non, abattement des véhicules électriques).

```text
Achat : prix TTC × taux / 12 ; location : coût global annuel TTC × taux / 12 ; − abattement électrique plafonné
```

**Entrées**

- `dateOperation` (date) — Date — défaut : `2024-06-30`
- `mode` (choix) — Mode de détention — défaut : `achat`
- `prixTTC` (montant) — Prix d’achat TTC (remises incluses) — défaut : `38000`
- `moinsDe5Ans` (booleen) — Véhicule de moins de 5 ans — défaut : `true`
- `coutLocationAnnuel` (montant) — Coût global annuel TTC (location, entretien, assurance) — défaut : `9600`
- `carburant` (booleen) — Carburant pris en charge par l’employeur — défaut : `false`
- `electrique` (booleen) — Véhicule 100 % électrique — défaut : `false`

**Références**

- Arrêté du 10/12/2002 relatif à l’évaluation des avantages en nature, art. 3
- BOSS — Avantages en nature, chapitre véhicule

**Barèmes** : `paie.avantages-nature`

**Exemples vérifiés par les tests**

- *Achat 38 000 €, juin 2024* → `avantageMensuel` = 285.00, `avantageAnnuel` = 3420.00

#### Avantage en nature nourriture

`POST /api/calc/paie/avantage-repas` — version 1.0.0

Évaluation forfaitaire des repas fournis par l’employeur, après participation éventuelle du salarié.

```text
Avantage = nombre de repas × max(0 ; forfait − participation)
```

**Entrées**

- `dateOperation` (date) — Date — défaut : `2025-03-31`
- `repas` (entier) — Nombre de repas du mois — défaut : `20`
- `participation` (montant) — Participation du salarié par repas — défaut : `0`

**Références**

- Arrêté du 10/12/2002, art. 1er — revalorisé chaque 1er janvier

**Barèmes** : `paie.avantages-nature`

**Exemples vérifiés par les tests**

- *20 repas 2025* → `forfait` = 5.45, `avantage` = 109.00

### Congés et absences

#### Congés payés : acquisition et indemnité

`POST /api/calc/paie/conges-payes` — version 1.0.0

Calcule les jours acquis (2,5 jours ouvrables par mois de travail, 2 jours par mois d’arrêt maladie non professionnelle), le solde et l’indemnité selon la règle la plus favorable entre le dixième et le maintien de salaire.

```text
Acquis = ⌈2,5 × mois travaillés + 2 × mois de maladie⌉ (≤ 30 j) ; indemnité = max(1/10 × brut de référence × jours pris / jours acquis ; salaire × jours pris / jours ouvrables du mois)
```

**Entrées**

- `moisTravailles` (nombre) — Mois de travail effectif sur la période de référence — défaut : `11`
- `moisMaladie` (nombre) — Mois d’arrêt maladie non professionnelle — défaut : `1`
- `joursPris` (nombre) — Jours ouvrables pris — défaut : `12`
- `brutReference` (montant) — Brut de la période de référence — défaut : `39600`
- `salaireMensuel` (montant) — Salaire mensuel actuel — défaut : `3400`
- `joursOuvrablesMois` (nombre) — Jours ouvrables du mois de prise — défaut : `26`

**Références**

- Code du travail art. L.3141-3 et L.3141-7 — acquisition, arrondi à l’entier supérieur
- Code du travail art. L.3141-5-1 (loi n° 2024-364) — maladie non professionnelle
- Code du travail art. L.3141-24 — règle du dixième / maintien

**Exemples vérifiés par les tests**

- *12 jours pris* → `joursAcquis` = 30, `solde` = 18, `indemniteDixieme` = 1584.00, `indemniteMaintien` = 1569.23, `indemnite` = 1584.00

#### Indemnités journalières maladie (IJSS)

`POST /api/calc/paie/ijss-maladie` — version 1.0.0

Calcule le salaire journalier de base (3 derniers mois / 91,25, plafonné), l’IJ à 50 % et le total après délai de carence.

```text
SJB = min(Σ 3 brut / 91,25 ; plafond × SMIC mensuel × 3 / 91,25) ; IJ = 50 % × SJB ; jours indemnisés = jours d’arrêt − 3
```

**Entrées**

- `dateOperation` (date) — Date de début de l’arrêt — défaut : `2024-09-02`
- `brut3Mois` (montant) — Brut des 3 mois précédant l’arrêt — défaut : `9300`
- `joursArret` (entier) — Durée de l’arrêt (jours calendaires) — défaut : `15`

**Références**

- CSS art. L.323-1, R.323-1, R.323-4 et R.323-9

**Barèmes** : `paie.ijss`, `paie.constantes`

**Exemples vérifiés par les tests**

- *Arrêt de 15 jours* → `sjb` = 101.92, `ij` = 50.96, `joursIndemnises` = 12, `total` = 611.52

#### Maintien de salaire légal (maladie)

`POST /api/calc/paie/maintien-salaire` — version 1.0.0

Complément employeur : 90 % puis 66,66 % de la rémunération brute, durées croissant de 10 jours par période de 5 ans d’ancienneté, après 7 jours de carence, sous déduction des IJSS.

```text
Complément = salaire journalier × (jours à 90 % × 90 % + jours à 66,66 % × 2/3) − IJSS
```

**Entrées**

- `salaireMensuel` (montant) — Salaire mensuel brut — défaut : `3000`
- `anciennete` (nombre) — Ancienneté (années) — défaut : `7`
- `joursArret` (entier) — Durée de l’arrêt (jours) — défaut : `60`
- `ijJournaliere` (montant) — IJSS journalière brute — défaut : `49.32`
- `carence` (entier) — Jours de carence employeur — défaut : `7`

**Références**

- Code du travail art. L.1226-1, D.1226-1 à D.1226-3

**Exemples vérifiés par les tests**

- *60 jours, 7 ans* → `jours90` = 40, `jours66` = 13, `complement` = 1852.71

#### Activité partielle

`POST /api/calc/paie/activite-partielle` — version 1.0.0

Indemnité versée au salarié (60 % du brut horaire), allocation remboursée par l’État (36 %), plafonnées à 4,5 SMIC, et reste à charge employeur.

```text
Indemnité = heures chômées × TH × 60 % ; allocation = heures × min(TH ; 4,5 SMIC) × 36 %
```

**Entrées**

- `dateOperation` (date) — Mois — défaut : `2024-05-31`
- `tauxHoraire` (montant) — Taux horaire brut — défaut : `18.40`
- `heuresChomees` (nombre) — Heures chômées indemnisables — défaut : `42`

**Références**

- Code du travail art. L.5122-1, R.5122-12 et R.5122-18 (taux de droit commun)

**Barèmes** : `paie.constantes`

**Exemples vérifiés par les tests**

- *42 heures* → `indemnite` = 463.68, `allocation` = 278.21, `resteACharge` = 185.47

### Rupture du contrat

#### Indemnité légale de licenciement

`POST /api/calc/paie/indemnite-licenciement` — version 1.0.0

Calcule l’ancienneté (préavis inclus), le salaire de référence le plus favorable et l’indemnité légale ; compare à l’indemnité conventionnelle et retient la plus élevée.

```text
Indemnité = S × [min(A ; 10) / 4 + max(A − 10 ; 0) / 3] ; S = max(moyenne 12 mois ; moyenne 3 mois)
```

**Entrées**

- `dateEntree` (date) — Date d’entrée — défaut : `2012-09-03`
- `dateSortie` (date) — Date de fin du préavis — défaut : `2025-06-30`
- `moyenne12` (montant) — Moyenne brute des 12 derniers mois — défaut : `3650`
- `moyenne3` (montant) — Moyenne brute des 3 derniers mois (primes proratisées) — défaut : `3580`
- `conventionnelle` (montant) — Indemnité conventionnelle (si connue) — défaut : `0`

**Références**

- Code du travail art. L.1234-9 — droit à l’indemnité (8 mois d’ancienneté)
- Code du travail art. R.1234-2 et R.1234-4 — montant et salaire de référence

**Exemples vérifiés par les tests**

- *12 ans 9 mois 27 jours* → `salaireReference` = 3650.00, `indemniteLegale` = 12560.83, `indemniteDue` = 12560.83

#### Rupture conventionnelle : minimum et contribution patronale

`POST /api/calc/paie/rupture-conventionnelle` — version 1.0.0

Vérifie que l’indemnité négociée atteint le minimum légal, détermine la fraction exonérée de cotisations (2 PASS) et la contribution patronale spécifique de 30 %.

```text
Minimum = indemnité légale ; exonéré social = min(indemnité ; 2 PASS) si indemnité ≤ 10 PASS ; contribution = 30 % × part exonérée
```

**Entrées**

- `dateEntree` (date) — Date d’entrée — défaut : `2016-02-01`
- `dateOperation` (date) — Date de rupture — défaut : `2025-04-30`
- `salaireReference` (montant) — Salaire de référence — défaut : `4200`
- `indemniteNegociee` (montant) — Indemnité négociée — défaut : `15000`

**Références**

- Code du travail art. L.1237-13 — indemnité ≥ indemnité légale
- CSS art. L.137-12 (loi n° 2023-270) — contribution patronale de 30 % depuis le 01/09/2023
- CSS art. L.242-1 II 7° — exonération dans la limite de 2 PASS

**Barèmes** : `paie.constantes`

**Exemples vérifiés par les tests**

- *9 ans 2 mois 29 jours* → `minimumLegal` = 9708.42, `exonereSocial` = 15000.00, `contributionPatronale` = 4500.00

#### Indemnité de fin de CDD

`POST /api/calc/paie/indemnite-precarite` — version 1.0.0

Indemnité de précarité (10 %, ou 6 % avec accord et accès à la formation) et indemnité compensatrice de congés payés calculée sur la rémunération majorée de la précarité.

```text
Précarité = brut total × 10 % ; ICCP = (brut total + précarité) × 10 %
```

**Entrées**

- `brutTotal` (montant) — Rémunération brute totale du contrat — défaut : `14800`
- `taux` (taux) — Taux de l’indemnité de précarité — défaut : `10`
- `iccpDejaVersee` (booleen) — Congés déjà pris ou payés — défaut : `false`

**Références**

- Code du travail art. L.1243-8 et L.1243-9 — indemnité de fin de contrat
- Code du travail art. L.1242-16 — congés payés en CDD

**Exemples vérifiés par les tests**

- *CDD 6 mois* → `precarite` = 1480.00, `iccp` = 1628.00, `total` = 3108.00

#### Solde de tout compte

`POST /api/calc/paie/solde-tout-compte` — version 1.0.0

Récapitule les sommes dues à la sortie : salaire du dernier mois au prorata, indemnité compensatrice de congés payés, de préavis et indemnité de rupture.

```text
Total brut = salaire au prorata + ICCP + préavis + indemnité de rupture
```

**Entrées**

- `salaireMensuel` (montant) — Salaire mensuel brut — défaut : `2900`
- `joursTravaillesMois` (nombre) — Jours ouvrés travaillés le dernier mois — défaut : `12`
- `joursOuvresMois` (nombre) — Jours ouvrés du mois — défaut : `22`
- `joursCpRestants` (nombre) — Jours ouvrables de congés restants — défaut : `8.5`
- `moisPreavisNonEffectue` (nombre) — Mois de préavis non effectué (dispense employeur) — défaut : `0`
- `indemniteRupture` (montant) — Indemnité de rupture (licenciement, RC…) — défaut : `6800`

**Références**

- Code du travail art. L.1234-20 — reçu pour solde de tout compte
- Code du travail art. L.1234-5 et L.3141-28

**Exemples vérifiés par les tests**

- *Départ mi-mois* → `salaireProrata` = 1581.82, `iccp` = 948.08, `total` = 9329.90

### Impôt

#### Prélèvement à la source

`POST /api/calc/paie/pas` — version 1.0.0

Calcule la retenue à la source sur le net imposable avec le taux transmis par la DGFiP ou la grille du taux neutre.

```text
PAS = net imposable × taux (personnalisé ou grille neutre selon la base mensuelle)
```

**Entrées**

- `dateOperation` (date) — Mois de versement — défaut : `2025-06-30`
- `netImposable` (montant) — Net imposable du mois — défaut : `2650`
- `mode` (choix) — Taux — défaut : `neutre`
- `taux` (taux) — Taux personnalisé — défaut : `6.2`

**Références**

- CGI art. 204 A, 204 H et 204 J

**Barèmes** : `paie.pas-metropole`

**Exemples vérifiés par les tests**

- *Grille 2025* → `taux` = 5.30, `pas` = 140.45

### Coût employeur

#### Masse salariale et coût employeur

`POST /api/calc/paie/masse-salariale` — version 1.0.0

Agrège la masse salariale annuelle, les charges patronales, le coût total, le coût moyen par salarié et le coût horaire moyen.

```text
Coût = Σ brut × mois × (1 + taux de charges) ; coût horaire = coût / heures annuelles
```

**Entrées**

- `salaries` (table) — Salariés

**Références**

- PCG comptes 641 et 645
- DSN — déclaration sociale nominative

**Exemples vérifiés par les tests**

- *TPE* → `masse` = 137200.00, `charges` = 56442.00, `coutTotal` = 193642.00

## <a id="fiscal"></a>Fiscalité entreprise

IS, acomptes, déficits, CFE, CVAE, taxe sur les salaires, taxes diverses, contrôle FEC.

### Impôt sur les sociétés

#### Impôt sur les sociétés

`POST /api/calc/fiscal/impot-societes` — version 1.0.0

Calcule l’IS au taux réduit PME (15 % jusqu’à 42 500 €, proratisé selon la durée de l’exercice) et au taux normal (25 %), la contribution sociale de 3,3 %, l’imputation des crédits d’impôt et le taux effectif.

```text
IS = 15 % × min(RF ; 42 500 × d/12) + 25 % × reste ; CSB = 3,3 % × (IS − 763 000) si CA ≥ 7,63 M€ ; IS net = IS + CSB − crédits
```

**Entrées**

- `dateOperation` (date) — Date de clôture — défaut : `2024-12-31`
- `resultatFiscal` (montant) — Résultat fiscal — défaut : `186000`
- `ca` (montant) — Chiffre d’affaires HT (ramené à 12 mois) — défaut : `2400000`
- `conditionsCapital` (booleen) — Capital entièrement libéré et détenu à 75 % par des personnes physiques — défaut : `true`
- `dureeMois` (entier) — Durée de l’exercice (mois) — défaut : `12`
- `creditsImpot` (montant) — Crédits et réductions d’impôt imputables (CIR, mécénat…) — défaut : `0`

**Références**

- CGI art. 219 I — taux de l’IS et taux réduit des PME
- CGI art. 235 ter ZC — contribution sociale sur l’IS
- CGI art. 1657 — arrondi à l’euro

**Barèmes** : `fiscal.is`

**Exemples vérifiés par les tests**

- *PME 186 000 €* → `isReduit` = 6375, `isNormal` = 35875, `isBrut` = 42250, `isNet` = 42250
- *Grande entreprise* → `isBrut` = 1250000, `csb` = 16071, `isNet` = 1266071

#### Acomptes d’IS et de contribution sociale

`POST /api/calc/fiscal/acomptes-is` — version 1.0.0

Calcule les quatre acomptes d’IS (et de CSB) à partir de l’impôt de référence, leurs dates d’exigibilité selon la date d’ouverture de l’exercice, et la dispense éventuelle.

```text
Acompte = IS de référence / 4 (dispense si IS < 3 000 €) ; échéances le 15 des 3e, 6e, 9e et 12e mois
```

**Entrées**

- `dateOperation` (date) — Ouverture de l’exercice en cours — défaut : `2025-01-01`
- `isReference` (montant) — IS de référence (dernier exercice clos, hors CSB) — défaut : `42250`
- `csbReference` (montant) — CSB de référence — défaut : `0`

**Références**

- CGI art. 1668 — acomptes et solde de l’IS
- BOI-IS-DECLA-20-10

**Barèmes** : `fiscal.is`

**Exemples vérifiés par les tests**

- *Exercice civil 2025* → `acompte` = 10562.50, `echeance1` = 2025-03-15, `echeance4` = 2025-12-15

#### Solde d’IS (relevé 2572)

`POST /api/calc/fiscal/solde-is` — version 1.0.0

Détermine le solde à payer ou l’excédent à rembourser après imputation des acomptes et des crédits, et la date limite de paiement.

```text
Solde = IS dû + CSB − acomptes versés − crédits imputables ; échéance : le 15 du 4e mois suivant la clôture (15 mai pour un exercice civil)
```

**Entrées**

- `cloture` (date) — Date de clôture — défaut : `2024-12-31`
- `isDu` (montant) — IS dû de l’exercice — défaut : `42250`
- `csb` (montant) — Contribution sociale — défaut : `0`
- `acomptes` (montant) — Acomptes versés — défaut : `38000`
- `credits` (montant) — Crédits d’impôt imputables — défaut : `1200`

**Références**

- CGI art. 1668 — liquidation du solde
- Formulaire 2572-SD

**Exemples vérifiés par les tests**

- *Solde 2024* → `solde` = 3050.00, `dateLimite` = 2025-05-15

#### Détermination du résultat fiscal (2058-A)

`POST /api/calc/fiscal/resultat-fiscal` — version 1.0.0

Passe du résultat comptable au résultat fiscal : réintégrations (IS, amendes, TVS, amortissements excédentaires, provisions non déductibles, QPFC…), déductions (dividendes mère-fille, reprises…), imputation des déficits antérieurs dans la limite légale.

```text
RF = résultat comptable + Σ réintégrations − Σ déductions − déficits imputés [≤ 1 M€ + 50 % × (bénéfice − 1 M€)]
```

**Entrées**

- `dateOperation` (date) — Date de clôture — défaut : `2024-12-31`
- `resultatComptable` (montant) — Résultat comptable — défaut : `152000`
- `reintegrations` (table) — Réintégrations
- `deductions` (table) — Déductions
- `deficitsAnterieurs` (montant) — Déficits antérieurs reportables — défaut : `20000`

**Références**

- CGI art. 38 et 39 — bénéfice imposable, charges déductibles
- CGI art. 209 I — imputation des déficits
- Formulaire 2058-A-SD

**Barèmes** : `fiscal.is`

**Exemples vérifiés par les tests**

- *PME* → `resultatAvantDeficits` = 185620.00, `deficitsImputes` = 20000.00, `resultatFiscal` = 165620.00, `deficitsRestants` = 0.00

#### Report en avant des déficits

`POST /api/calc/fiscal/deficits-reportables` — version 1.0.0

Impute les déficits antérieurs sur le bénéfice de l’exercice dans la limite de 1 M€ majoré de 50 % de la fraction excédentaire, et suit le stock reportable sans limite de durée.

```text
Imputable = min(stock ; 1 000 000 + 50 % × max(0 ; bénéfice − 1 000 000)) ; nouveau stock = stock − imputé
```

**Entrées**

- `dateOperation` (date) — Date de clôture — défaut : `2024-12-31`
- `benefice` (montant) — Bénéfice fiscal de l’exercice (avant imputation) — défaut : `3000000`
- `stock` (montant) — Stock de déficits reportables — défaut : `2800000`

**Références**

- CGI art. 209 I al. 3 — report en avant
- BOI-IS-DEF-10-30

**Barèmes** : `fiscal.is`

**Exemples vérifiés par les tests**

- *Gros bénéfice* → `plafond` = 2000000.00, `impute` = 2000000.00, `beneficeImposable` = 1000000.00, `stockRestant` = 800000.00

#### Report en arrière (carry-back)

`POST /api/calc/fiscal/carry-back` — version 1.0.0

Option pour imputer le déficit sur le bénéfice de l’exercice précédent, dans la limite de 1 M€ et du bénéfice non distribué : génère une créance remboursable au bout de 5 ans.

```text
Imputable = min(déficit ; bénéfice N−1 non distribué ; 1 000 000) ; créance = imputable × taux normal
```

**Entrées**

- `dateOperation` (date) — Date de clôture de l’exercice déficitaire — défaut : `2024-12-31`
- `deficit` (montant) — Déficit de l’exercice — défaut : `450000`
- `beneficeN1` (montant) — Bénéfice de l’exercice précédent — défaut : `380000`
- `distribue` (montant) — Bénéfice N−1 distribué — défaut : `50000`

**Références**

- CGI art. 220 quinquies — report en arrière des déficits
- BOI-IS-DEF-20

**Barèmes** : `fiscal.is`

**Exemples vérifiés par les tests**

- *Déficit 450 k€* → `imputable` = 330000.00, `creance` = 82500.00, `solde` = 120000.00

#### Plus-values de cession à l’IS

`POST /api/calc/fiscal/plus-values-is` — version 1.0.0

Régime des plus-values selon la nature de l’actif : titres de participation (taux 0 % avec QPFC de 12 %), produits de brevets (10 %), autres actifs (taux normal).

```text
Titres de participation : IS = PV × 12 % × taux normal ; brevets : PV × 10 % ; autres : PV × taux normal
```

**Entrées**

- `dateOperation` (date) — Date de cession — défaut : `2024-09-30`
- `nature` (choix) — Nature de l’actif — défaut : `titres-participation`
- `prixCession` (montant) — Prix de cession — défaut : `900000`
- `valeurFiscale` (montant) — Valeur fiscale (prix de revient ou VNC fiscale) — défaut : `400000`

**Références**

- CGI art. 219 I a quinquies — titres de participation
- CGI art. 238 — régime des brevets (taux de 10 %)
- CGI art. 39 duodecies et 219 I a — autres plus-values

**Barèmes** : `fiscal.is`

**Exemples vérifiés par les tests**

- *Cession de participation* → `plusValue` = 500000.00, `baseImposable` = 60000.00, `impot` = 15000.00
- *Brevet* → `impot` = 50000.00

### Groupes

#### Régime des sociétés mères

`POST /api/calc/fiscal/regime-mere-fille` — version 1.0.0

Vérifie les conditions du régime mère-fille et calcule l’exonération des dividendes, la quote-part de frais et charges réintégrée et l’économie d’impôt.

```text
Déduction = dividendes ; réintégration QPFC = 5 % (1 % en groupe intégré / UE équivalent) × dividendes
```

**Entrées**

- `dateOperation` (date) — Date de perception — défaut : `2024-06-30`
- `dividendes` (montant) — Dividendes perçus — défaut : `120000`
- `detention` (taux) — Pourcentage de détention — défaut : `35`
- `conservation2ans` (booleen) — Titres détenus (ou engagement de conservation) depuis 2 ans — défaut : `true`
- `groupeIntegre` (booleen) — Filiale membre du même groupe intégré (ou équivalent UE) — défaut : `false`

**Références**

- CGI art. 145 — conditions (5 % du capital, conservation 2 ans)
- CGI art. 216 — quote-part de frais et charges

**Barèmes** : `fiscal.is`

**Exemples vérifiés par les tests**

- *Filiale à 35 %* → `deduction` = 120000.00, `qpfc` = 6000.00, `economieIs` = 28500.00
- *Groupe intégré* → `qpfc` = 1200.00

#### Intégration fiscale : résultat d’ensemble

`POST /api/calc/fiscal/integration-fiscale` — version 1.0.0

Somme les résultats fiscaux des sociétés du groupe (≥ 95 % de détention), applique les neutralisations, calcule l’IS du groupe et l’économie d’intégration par rapport à une imposition séparée.

```text
Résultat d’ensemble = Σ résultats fiscaux + rectifications ; économie = Σ IS individuels − IS du groupe
```

**Entrées**

- `dateOperation` (date) — Date de clôture — défaut : `2024-12-31`
- `societes` (table) — Sociétés du groupe
- `neutralisations` (montant) — Rectifications (neutralisations intragroupe, ±) — défaut : `-15000`
- `pme` (booleen) — Taux réduit applicable au groupe — défaut : `false`

**Références**

- CGI art. 223 A à 223 U — régime de groupe
- Formulaires 2058-A-SD à 2058-ES

**Barèmes** : `fiscal.is`

**Exemples vérifiés par les tests**

- *Groupe de 4 sociétés* → `resultatEnsemble` = 630000.00, `isGroupe` = 157500, `economie` = 55000

### Impôts locaux

#### Cotisation foncière des entreprises (CFE)

`POST /api/calc/fiscal/cfe` — version 1.0.0

Base d’imposition (valeur locative, abattement industriel, réductions de création, base minimum), cotisation au taux communal, taxes additionnelles et frais de gestion.

```text
Base = max(VL × (1 − abattements) ; base minimum) ; CFE = base × taux + taxes additionnelles + frais de gestion
```

**Entrées**

- `valeurLocative` (montant) — Valeur locative cadastrale des biens — défaut : `18500`
- `industriel` (booleen) — Établissement industriel (méthode comptable) — défaut : `false`
- `annee` (choix) — Situation — défaut : `courante`
- `baseMinimum` (montant) — Base minimum votée par la commune (selon CA) — défaut : `1200`
- `tauxCommunal` (taux) — Taux communal et intercommunal — défaut : `26.48`
- `taxesAdditionnelles` (taux) — Taxes additionnelles (CCI, TSE…) en % de la base — défaut : `1.2`
- `fraisGestion` (taux) — Frais de gestion de la fiscalité locale — défaut : `3`

**Références**

- CGI art. 1447 à 1478 — CFE
- CGI art. 1499 — abattement de 50 % des établissements industriels
- CGI art. 1647 D — cotisation minimum
- CGI art. 1478 II — exonération l’année de création, base réduite de moitié l’année suivante

**Exemples vérifiés par les tests**

- *Commerce* → `base` = 18500, `cotisation` = 4899, `totalAPayer` = 5275

#### Cotisation sur la valeur ajoutée (CVAE)

`POST /api/calc/fiscal/cvae` — version 1.0.0

Plafonne la valeur ajoutée (80 % ou 85 % du CA), applique le taux effectif progressif de l’année (en extinction progressive) et calcule la cotisation.

```text
VA retenue = min(VA ; 80 % × CA si CA ≤ 7,6 M€, sinon 85 %) ; CVAE = VA retenue × taux effectif(CA)
```

**Entrées**

- `dateOperation` (date) — Année d’imposition (date) — défaut : `2024-12-31`
- `ca` (montant) — Chiffre d’affaires HT — défaut : `6500000`
- `va` (montant) — Valeur ajoutée (CA − consommations en provenance des tiers) — défaut : `2800000`

**Références**

- CGI art. 1586 ter à 1586 octies — CVAE
- CGI art. 1586 quater — taux effectif et réduction progressive (LF 2023, LF 2024, LF 2025)

**Barèmes** : `fiscal.cvae`

**Exemples vérifiés par les tests**

- *CA 6,5 M€ — 2024* → `vaRetenue` = 2800000.00, `tauxEffectif` = 0.1773, `cvae` = 4965

#### Contribution économique territoriale et plafonnement

`POST /api/calc/fiscal/plafonnement-cet` — version 1.0.0

Additionne CFE et CVAE (CET) et calcule le dégrèvement pour plafonnement en fonction de la valeur ajoutée.

```text
CET = CFE + CVAE ; dégrèvement = max(0 ; CET − VA × taux de plafonnement)
```

**Entrées**

- `dateOperation` (date) — Année d’imposition (date) — défaut : `2024-12-31`
- `cfe` (montant) — CFE (hors taxes additionnelles) — défaut : `22000`
- `cvae` (montant) — CVAE — défaut : `3293`
- `va` (montant) — Valeur ajoutée — défaut : `1200000`

**Références**

- CGI art. 1647 B sexies — plafonnement de la CET

**Barèmes** : `fiscal.cvae`

**Exemples vérifiés par les tests**

- *Dégrèvement* → `cet` = 25293.00, `plafond` = 18372, `degrevement` = 6921

### Taxes sur les rémunérations

#### Taxe sur les salaires

`POST /api/calc/fiscal/taxe-salaires` — version 1.0.0

Pour les employeurs non (ou partiellement) assujettis à la TVA : barème progressif par salarié, rapport d’assujettissement, abattement des associations, franchise et décote.

```text
TS(s) = 4,25 % × R + 4,25 % × (R entre S1 et S2) + 9,35 % × (R > S2) ; TS = Σ TS(s) × rapport ; franchise < 1 200 €, décote = 3/4 × (2 040 − TS)
```

**Entrées**

- `dateOperation` (date) — Année (date) — défaut : `2024-12-31`
- `salaries` (table) — Rémunérations annuelles (assiette CSG)
- `rapport` (taux) — Rapport d’assujettissement (CA non soumis à TVA / CA total) — défaut : `100`
- `association` (booleen) — Association / organisme sans but lucratif (abattement) — défaut : `false`

**Références**

- CGI art. 231 — assiette et barème
- CGI art. 1679 — franchise, décote et abattement des associations
- BOI-TPS-TS

**Barèmes** : `fiscal.taxe-salaires`

**Exemples vérifiés par les tests**

- *Cabinet médical 2024* → `tsBrute` = 13314, `tsDue` = 13314

#### Taxe d’apprentissage et contribution formation

`POST /api/calc/fiscal/contributions-formation` — version 1.0.0

Contribution unique à la formation professionnelle et à l’alternance (CUFPA) : taxe d’apprentissage (part principale et solde), contribution à la formation professionnelle, 1 % CPF-CDD.

```text
TA = MS × 0,59 % (0,44 % Alsace-Moselle) + MS × 0,09 % ; CFP = MS × 0,55 % (< 11) ou 1 % ; CPF-CDD = MS CDD × 1 %
```

**Entrées**

- `dateOperation` (date) — Année (date) — défaut : `2024-12-31`
- `masseSalariale` (montant) — Masse salariale brute annuelle — défaut : `850000`
- `masseCdd` (montant) — dont rémunérations des CDD — défaut : `60000`
- `effectif` (entier) — Effectif moyen — défaut : `18`
- `alsaceMoselle` (booleen) — Établissement en Alsace-Moselle — défaut : `false`

**Références**

- Code du travail art. L.6241-1 et s. — taxe d’apprentissage
- Code du travail art. L.6131-2 et L.6331-1 — contribution formation
- CGI art. 1599 ter A — taxe d’apprentissage

**Barèmes** : `fiscal.divers`

**Exemples vérifiés par les tests**

- *PME 18 salariés* → `taPrincipale` = 5015.00, `taSolde` = 765.00, `cfp` = 8500.00, `cpfCdd` = 600.00, `total` = 14880.00

### Taxes diverses

#### Taxes annuelles sur les véhicules de tourisme (ex-TVS)

`POST /api/calc/fiscal/taxes-vehicules` — version 1.0.0

Taxe annuelle sur les émissions de CO₂ (barème marginal WLTP) et taxe annuelle sur l’ancienneté / les polluants atmosphériques, au prorata de la durée d’affectation.

```text
Taxe CO₂ = Σ (g/km de chaque tranche × tarif marginal) × prorata ; taxe polluants = tarif catégorie × prorata
```

**Entrées**

- `dateOperation` (date) — Année d’imposition (date) — défaut : `2024-12-31`
- `co2` (entier) — Émissions CO₂ WLTP (g/km) — défaut : `128`
- `categorie` (choix) — Catégorie polluants — défaut : `critair1`
- `jours` (entier) — Jours d’affectation à l’activité — défaut : `365`
- `joursAnnee` (entier) — Jours de l’année — défaut : `366`

**Références**

- CIBS art. L.421-119 à L.421-132 — taxe annuelle sur les émissions de CO₂
- CIBS art. L.421-133 à L.421-135 — taxe annuelle sur les polluants atmosphériques

**Barèmes** : `fiscal.tvs`

**Exemples vérifiés par les tests**

- *Berline 128 g toute l’année* → `tarifCo2` = 363.00, `taxeCo2` = 362.01, `taxePolluants` = 99.73, `total` = 462

#### Contribution sociale de solidarité des sociétés (C3S)

`POST /api/calc/fiscal/c3s` — version 1.0.0

Contribution due par les entreprises dont le CA dépasse 19 M€, assise sur la fraction excédentaire.

```text
C3S = 0,16 % × max(0 ; CA HT − 19 000 000)
```

**Entrées**

- `dateOperation` (date) — Année de référence (date) — défaut : `2024-12-31`
- `ca` (montant) — Chiffre d’affaires HT de l’année N−1 — défaut : `42000000`

**Références**

- CSS art. L.137-30 à L.137-37 — C3S et contribution additionnelle

**Barèmes** : `fiscal.divers`

**Exemples vérifiés par les tests**

- *CA 42 M€* → `base` = 23000000.00, `c3s` = 36800

#### Taxe sur les bureaux en Île-de-France

`POST /api/calc/fiscal/taxe-bureaux-idf` — version 1.0.0

Taxe annuelle sur les locaux à usage de bureaux, commerciaux, de stockage et les surfaces de stationnement, selon les tarifs au m² de la circonscription (exonération des surfaces sous les seuils).

```text
Taxe = Σ surface taxable × tarif au m² de la circonscription
```

**Entrées**

- `bureaux` (nombre) — Surface de bureaux (m²) — défaut : `850`
- `tarifBureaux` (montant) — Tarif bureaux (€/m²) de la circonscription — défaut : `24.21`
- `commerciaux` (nombre) — Locaux commerciaux (m²) — défaut : `0`
- `tarifCommerciaux` (montant) — Tarif locaux commerciaux (€/m²) — défaut : `9.46`
- `stockage` (nombre) — Locaux de stockage (m²) — défaut : `0`
- `tarifStockage` (montant) — Tarif stockage (€/m²) — défaut : `4.89`
- `stationnement` (nombre) — Surfaces de stationnement (m²) — défaut : `320`
- `tarifStationnement` (montant) — Tarif stationnement (€/m²) — défaut : `2.91`

**Références**

- CGI art. 231 ter — taxe annuelle sur les locaux en Île-de-France
- BOI-IF-AUT-50

**Exemples vérifiés par les tests**

- *Siège social* → `taxe` = 20579

#### Taxe locale sur la publicité extérieure (enseignes)

`POST /api/calc/fiscal/tlpe` — version 1.0.0

TLPE sur les enseignes : exonération jusqu’à 7 m², tarif de base jusqu’à 12 m², doublé de 12 à 50 m², quadruplé au-delà ; prorata en cas d’installation en cours d’année.

```text
TLPE = surface totale × tarif de base × coefficient (1 ; 2 ; 4) × prorata
```

**Entrées**

- `surface` (nombre) — Surface totale des enseignes (m²) — défaut : `18`
- `tarifBase` (montant) — Tarif de base de la commune (€/m²) — défaut : `17.30`
- `exonerationCommune` (booleen) — Exonération des enseignes ≤ 12 m² votée par la commune — défaut : `false`
- `moisInstallation` (nombre) — Mois d’installation sur l’année — défaut : `12`

**Références**

- CGCT art. L.2333-6 à L.2333-16 — TLPE

**Exemples vérifiés par les tests**

- *Enseigne de 18 m²* → `coefficient` = 2, `tlpe` = 623

#### Taxe sur les surfaces commerciales (TaSCom)

`POST /api/calc/fiscal/tascom` — version 1.0.0

Commerces de détail de plus de 400 m² : tarif au m² fonction du CA par m², modulation communale et majoration des grandes surfaces.

```text
CA/m² < 3 000 : 5,74 € ; 3 000 à 12 000 : 5,74 + 0,00315 × (CA/m² − 3 000) ; > 12 000 : 34,12 € ; × surface × coefficient
```

**Entrées**

- `dateOperation` (date) — Année (date) — défaut : `2024-12-31`
- `surface` (nombre) — Surface de vente (m²) — défaut : `1800`
- `ca` (montant) — CA HT de l’année précédente — défaut : `9450000`
- `coefficient` (nombre) — Coefficient de modulation communal (0,8 à 1,3) — défaut : `1.1`

**Références**

- Loi n° 72-657 du 13/07/1972, art. 3 — TaSCom
- BOI-TFP-TSC

**Barèmes** : `fiscal.tascom`

**Exemples vérifiés par les tests**

- *Supermarché 1 800 m²* → `caParM2` = 5250.00, `tarif` = 12.83, `tascom` = 25403

#### Taxe sur les spectacles

`POST /api/calc/fiscal/taxe-spectacles` — version 1.0.0

Taxe sur la billetterie des spectacles de variétés (CNM) ou dramatiques, lyriques et chorégraphiques (ASTP).

```text
Taxe = recettes de billetterie HT × 3,5 %
```

**Entrées**

- `dateOperation` (date) — Date du spectacle — défaut : `2024-10-15`
- `billetterieHT` (montant) — Recettes de billetterie HT — défaut : `48000`

**Références**

- CIBS art. L.453-1 et s. (ex-CGI art. 1535 et 76 de la loi n° 2003-1312)

**Barèmes** : `fiscal.divers`

**Exemples vérifiés par les tests**

- *Concert* → `taxe` = 1680.00

### Déclarations

#### Contrôle du fichier des écritures comptables (FEC)

`POST /api/calc/fiscal/controle-fec` — version 1.0.0

Analyse un FEC (séparateur | ou tabulation) : structure des 18 colonnes, champs obligatoires, formats de dates et montants, équilibre de chaque écriture et du fichier, numérotation et chronologie de validation, appartenance des dates à l’exercice.

```text
18 colonnes A47 A-1 ; Σ débit = Σ crédit par EcritureNum et au total ; dates AAAAMMJJ dans l’exercice ; ValidDate ≥ EcritureDate
```

**Entrées**

- `fichier` (texte) — Contenu du FEC — défaut : `JournalCode|JournalLib|EcritureNum|EcritureDate|CompteNum|CompteLib|CompAuxNum|CompAuxLib|PieceRef|PieceDate|EcritureLib|Debit|Credit|EcritureLet|DateLet|ValidDate|Montantdevise|Idevise
AC|Achats|1|20240105|607000|Achats de marchandises|||F101|20240105|Facture Dupont|1000,00|0,00|||20240110||
AC|Achats|1|20240105|445660|TVA déductible|||F101|20240105|Facture Dupont|200,00|0,00|||20240110||
AC|Achats|1|20240105|401000|Fournisseurs|401DUP|Dupont|F101|20240105|Facture Dupont|0,00|1200,00|||20240110||
VE|Ventes|2|20240112|411000|Clients|411MAR|Martin|V55|20240112|Facture Martin|2400,00|0,00|||20240115||
VE|Ventes|2|20240112|706000|Prestations|||V55|20240112|Facture Martin|0,00|2000,00|||20240115||
VE|Ventes|2|20240112|445710|TVA collectée|||V55|20240112|Facture Martin|0,00|400,00|||20240115||`
- `debutExercice` (date) — Début de l’exercice — défaut : `2024-01-01`
- `finExercice` (date) — Fin de l’exercice — défaut : `2024-12-31`

**Références**

- LPF art. L.47 A-I — remise du FEC lors d’un contrôle
- LPF art. A.47 A-1 — format et contenu du fichier
- CGI art. 1729 D — amende pour défaut de présentation

**Exemples vérifiés par les tests**

- *FEC conforme* → `lignes` = 6, `ecritures` = 2, `totalDebit` = 3600.00, `totalCredit` = 3600.00, `anomalies` = 0
- *Écriture déséquilibrée* → `anomalies` = 1

#### Déclaration des honoraires (DAS2)

`POST /api/calc/fiscal/das2` — version 1.0.0

Détermine les bénéficiaires à déclarer : honoraires, commissions, courtages, ristournes et droits d’auteur versés à un même bénéficiaire au-delà de 1 200 € TTC par an.

```text
Déclarable si Σ sommes versées au bénéficiaire > 1 200 € TTC
```

**Entrées**

- `dateOperation` (date) — Année (date) — défaut : `2024-12-31`
- `versements` (table) — Versements

**Références**

- CGI art. 240 et 241 — déclaration des honoraires
- CGI art. 1736 I — amende de 50 % des sommes non déclarées

**Barèmes** : `fiscal.divers`

**Exemples vérifiés par les tests**

- *Quatre versements* → `aDeclarer` = 2, `montantDeclare` = 8600.00

#### Dividendes : prélèvements et IFU

`POST /api/calc/fiscal/ifu-dividendes` — version 1.0.0

Calcule le prélèvement forfaitaire non libératoire (12,8 %) et les prélèvements sociaux (17,2 %) à retenir à la source sur les dividendes versés à des personnes physiques résidentes, et les montants à porter sur l’IFU.

```text
PFNL = dividende brut × 12,8 % (sauf dispense) ; PS = dividende brut × 17,2 % ; net versé = brut − PFNL − PS
```

**Entrées**

- `dateOperation` (date) — Date de mise en paiement — défaut : `2024-06-15`
- `associes` (table) — Associés personnes physiques

**Références**

- CGI art. 117 quater — prélèvement forfaitaire non libératoire
- CGI art. 200 A — prélèvement forfaitaire unique (PFU)
- CGI art. 242 ter — imprimé fiscal unique (2561)

**Barèmes** : `fiscal.divers`

**Exemples vérifiés par les tests**

- *Deux associés* → `pfnl` = 3200.00, `prelevementsSociaux` = 5676.00, `netVerse` = 24124.00

## <a id="financier"></a>Analyse financière

SIG, CAF, bilan fonctionnel, ratios de rentabilité, structure, liquidité, activité, leviers.

### États financiers

#### États financiers depuis la balance

`POST /api/calc/financier/etats-depuis-balance` — version 1.0.0

À partir d’une balance générale, construit automatiquement le bilan (actif net / passif), le compte de résultat et les SIG, en classant chaque compte selon le PCG et selon le sens de son solde ; contrôle l’équilibre de la balance et du bilan.

```text
Résultat = Σ classe 7 − Σ classe 6 ; Actif net = Σ soldes débiteurs d’actif − amortissements ; Passif = CP + résultat + provisions + dettes ; actif = passif
```

**Entrées**

- `balance` (table) — Balance générale (soldes)

**Références**

- Règlement ANC 2014-03 — plan de comptes (art. 932-1) et modèles d’états (art. 821-1 et s.)
- Code de commerce art. L.123-12 à L.123-14 — comptes annuels

**Exemples vérifiés par les tests**

- *Balance de clôture* → `resultat` = 7700.00, `totalActif` = 159200.00, `totalPassif` = 159200.00, `margeCommerciale` = 95000.00, `valeurAjoutee` = 112000.00, `ebe` = 24500.00, `resultatNet` = 7700.00

### Compte de résultat

#### Soldes intermédiaires de gestion

`POST /api/calc/financier/sig` — version 1.0.0

Calcule en cascade la marge commerciale, la production, la valeur ajoutée, l’EBE, le résultat d’exploitation, le RCAI, le résultat exceptionnel et le résultat net, et contrôle la concordance avec le résultat comptable.

```text
MC → VA = MC + production − consommations → EBE = VA + subventions − impôts − personnel → RE → RCAI → RN
```

**Entrées**

- `ventesMarchandises` (montant) — Ventes de marchandises (707) — défaut : `850000`
- `achatsMarchandises` (montant) — Achats de marchandises (607) — défaut : `520000`
- `variationStockMarchandises` (montant) — Variation de stock de marchandises (6037, SI − SF) — défaut : `-12000`
- `productionVendue` (montant) — Production vendue (70 hors 707) — défaut : `310000`
- `productionStockee` (montant) — Production stockée (71) — défaut : `8000`
- `productionImmobilisee` (montant) — Production immobilisée (72) — défaut : `0`
- `consommationsTiers` (montant) — Consommations en provenance des tiers (60 hors 607, 61, 62) — défaut : `196000`
- `subventionsExploitation` (montant) — Subventions d’exploitation (74) — défaut : `5000`
- `impotsTaxes` (montant) — Impôts et taxes (63) — défaut : `14500`
- `chargesPersonnel` (montant) — Charges de personnel (64) — défaut : `298000`
- `autresProduits` (montant) — Autres produits (75) — défaut : `1500`
- `reprisesTransferts` (montant) — Reprises et transferts de charges (781, 791) — défaut : `6000`
- `autresCharges` (montant) — Autres charges (65) — défaut : `3200`
- `dotationsExploitation` (montant) — Dotations d’exploitation (681) — défaut : `42000`
- `produitsFinanciers` (montant) — Produits financiers (76, 786, 796) — défaut : `1800`
- `chargesFinancieres` (montant) — Charges financières (66, 686) — défaut : `9400`
- `produitsExceptionnels` (montant) — Produits exceptionnels (77, 787, 797) — défaut : `4000`
- `chargesExceptionnelles` (montant) — Charges exceptionnelles (67, 687) — défaut : `2500`
- `participation` (montant) — Participation des salariés (691) — défaut : `0`
- `impotBenefices` (montant) — Impôt sur les bénéfices (695) — défaut : `24000`
- `resultatComptable` (montant, optionnel) — Résultat comptable à rapprocher (optionnel)

**Références**

- PCG art. 821-1 à 821-4 — modèles de compte de résultat ; liasse 2052-2053 et 2033-B

**Exemples vérifiés par les tests**

- *PME industrielle et commerciale* → `margeCommerciale` = 342000.00, `valeurAjoutee` = 464000.00, `ebe` = 156500.00, `resultatExploitation` = 118800.00, `resultatNet` = 88700.00

#### Capacité d’autofinancement

`POST /api/calc/financier/caf` — version 1.0.0

Calcule la CAF par la méthode additive (depuis le résultat net) et par la méthode soustractive (depuis l’EBE), vérifie leur égalité, puis l’autofinancement et les ratios associés.

```text
Additive : RN + dotations − reprises + VNC cédées − produits de cession − QP subventions ; soustractive : EBE + autres produits − autres charges + PF encaissables − CF décaissables + PE encaissables − CE décaissables − participation − IS
```

**Entrées**

- `resultatNet` (montant) — Résultat net — défaut : `88700`
- `dotations` (montant) — Dotations aux amortissements, dépréciations et provisions (681, 686, 687) — défaut : `43000`
- `reprises` (montant) — Reprises (781, 786, 787) — défaut : `6000`
- `vncCedees` (montant) — Valeur comptable des éléments cédés (675) — défaut : `1500`
- `produitsCessions` (montant) — Produits des cessions d’éléments d’actif (775) — défaut : `3000`
- `quotePartSubventions` (montant) — Quote-part des subventions virée au résultat (777) — défaut : `1000`
- `ebe` (montant) — EBE — défaut : `156500`
- `autresProduits` (montant) — Autres produits d’exploitation (75) — défaut : `1500`
- `autresCharges` (montant) — Autres charges d’exploitation (65) — défaut : `3200`
- `transfertsCharges` (montant) — Transferts de charges (791) — défaut : `0`
- `produitsFinanciersEnc` (montant) — Produits financiers encaissables (76 + 796) — défaut : `1800`
- `chargesFinancieresDec` (montant) — Charges financières décaissables (66) — défaut : `9400`
- `produitsExceptionnelsEnc` (montant) — Produits exceptionnels encaissables (771, 778, 797) — défaut : `0`
- `chargesExceptionnellesDec` (montant) — Charges exceptionnelles décaissables (671, 678) — défaut : `0`
- `participation` (montant) — Participation (691) — défaut : `0`
- `impot` (montant) — Impôt sur les bénéfices (695) — défaut : `24000`
- `dividendes` (montant) — Dividendes versés dans l’exercice — défaut : `30000`
- `ca` (montant) — Chiffre d’affaires HT — défaut : `1160000`
- `dettesFinancieres` (montant) — Dettes financières — défaut : `210000`

**Références**

- PCG — tableau de financement (art. 832-13) ; liasse 2033-B / Banque de France

**Exemples vérifiés par les tests**

- *Concordance* → `cafAdditive` = 123200.00, `cafSoustractive` = 123200.00, `autofinancement` = 93200.00

### Bilan

#### Bilan fonctionnel : FRNG, BFR, trésorerie

`POST /api/calc/financier/bilan-fonctionnel` — version 1.0.0

Reclasse le bilan en emplois et ressources stables, calcule le fonds de roulement net global, le BFR d’exploitation et hors exploitation, la trésorerie nette, et vérifie l’identité FRNG − BFR = TN.

```text
FRNG = ressources stables − emplois stables ; BFR = stocks + créances − dettes non financières ; TN = disponibilités − concours bancaires = FRNG − BFR
```

**Entrées**

- `capitauxPropres` (montant) — Capitaux propres — défaut : `420000`
- `amortissementsProvisions` (montant) — Amortissements, dépréciations et provisions — défaut : `310000`
- `dettesFinancieres` (montant) — Dettes financières (hors concours bancaires courants) — défaut : `210000`
- `actifImmobiliseBrut` (montant) — Actif immobilisé brut — défaut : `760000`
- `stocks` (montant) — Stocks (bruts) — défaut : `145000`
- `creancesExploitation` (montant) — Créances d’exploitation (clients, TVA déductible…) — défaut : `236000`
- `dettesExploitation` (montant) — Dettes d’exploitation (fournisseurs, fiscales et sociales) — défaut : `198000`
- `creancesHorsExploitation` (montant) — Créances hors exploitation — défaut : `12000`
- `dettesHorsExploitation` (montant) — Dettes hors exploitation (IS, immobilisations…) — défaut : `26000`
- `disponibilites` (montant) — Disponibilités et VMP — défaut : `11000`
- `concoursBancaires` (montant) — Concours bancaires courants — défaut : `0`
- `ca` (montant) — Chiffre d’affaires HT (pour les jours de CA) — défaut : `1160000`

**Références**

- PCG — tableau de financement (art. 832-13 et s.)
- Méthodologie Banque de France / Centrale des bilans — ratios d’analyse financière

**Exemples vérifiés par les tests**

- *PME* → `frng` = 180000.00, `bfre` = 183000.00, `bfr` = 169000.00, `tresorerieNette` = 11000.00, `tresorerieBilan` = 11000.00

### Ratios

#### Ratios de rentabilité

`POST /api/calc/financier/ratios-rentabilite` — version 1.0.0

Marges (brute, d’EBE, nette), rentabilité financière (ROE), rentabilité des actifs (ROA), rentabilité économique, ROCE et ROIC (NOPAT / capitaux investis).

```text
ROE = RN / CP ; ROA = RN / total actif ; ROCE = RE / capitaux employés ; ROIC = RE × (1 − t) / capitaux investis
```

**Entrées**

- `ca` (montant) — Chiffre d’affaires HT — défaut : `1160000`
- `coutAchat` (montant) — Coût d’achat des marchandises vendues — défaut : `508000`
- `ebe` (montant) — EBE — défaut : `156500`
- `resultatExploitation` (montant) — Résultat d’exploitation (EBIT) — défaut : `118800`
- `resultatNet` (montant) — Résultat net — défaut : `88700`
- `capitauxPropres` (montant) — Capitaux propres — défaut : `420000`
- `totalActif` (montant) — Total actif — défaut : `904000`
- `dettesFinancieres` (montant) — Dettes financières — défaut : `210000`
- `tresorerie` (montant) — Trésorerie active — défaut : `61000`
- `tauxIs` (taux) — Taux d’impôt normatif — défaut : `25`

**Références**

- Méthodologie Banque de France / Centrale des bilans — ratios d’analyse financière

**Exemples vérifiés par les tests**

- *PME* → `margeNette` = 7.65, `roe` = 21.12, `roa` = 9.81, `roce` = 20.88, `roic` = 15.66

#### Ratios de structure et d’endettement

`POST /api/calc/financier/ratios-structure` — version 1.0.0

Autonomie financière, gearing brut et net, couverture des emplois stables, capacité de remboursement, poids des frais financiers.

```text
Autonomie = CP / total passif ; gearing = DF / CP ; gearing net = (DF − trésorerie) / CP ; capacité de remboursement = DF / CAF
```

**Entrées**

- `capitauxPropres` (montant) — Capitaux propres — défaut : `420000`
- `totalPassif` (montant) — Total du bilan — défaut : `904000`
- `dettesFinancieres` (montant) — Dettes financières — défaut : `210000`
- `tresorerie` (montant) — Trésorerie active — défaut : `61000`
- `ressourcesStables` (montant) — Ressources stables — défaut : `940000`
- `emploisStables` (montant) — Emplois stables — défaut : `760000`
- `caf` (montant) — CAF — défaut : `124700`
- `chargesFinancieres` (montant) — Charges financières — défaut : `9400`
- `ebe` (montant) — EBE — défaut : `156500`

**Références**

- Méthodologie Banque de France / Centrale des bilans — ratios d’analyse financière

**Exemples vérifiés par les tests**

- *PME* → `autonomie` = 46.46, `gearing` = 50.00, `gearingNet` = 35.48, `capaciteRemboursement` = 1.68

#### Ratios de liquidité

`POST /api/calc/financier/ratios-liquidite` — version 1.0.0

Liquidité générale, réduite (hors stocks) et immédiate, ratio de cash-flow.

```text
Générale = actif circulant / dettes CT ; réduite = (créances + trésorerie) / dettes CT ; immédiate = trésorerie / dettes CT
```

**Entrées**

- `stocks` (montant) — Stocks nets — défaut : `145000`
- `creances` (montant) — Créances à moins d’un an — défaut : `248000`
- `tresorerie` (montant) — Disponibilités et VMP — défaut : `61000`
- `dettesCT` (montant) — Dettes à moins d’un an — défaut : `254000`
- `fluxExploitation` (montant) — Flux de trésorerie d’exploitation — défaut : `98000`

**Références**

- Méthodologie Banque de France / Centrale des bilans — ratios d’analyse financière

**Exemples vérifiés par les tests**

- *PME* → `generale` = 1.79, `reduite` = 1.22, `immediate` = 0.24

#### Ratios d’activité et de rotation (DSO, DPO)

`POST /api/calc/financier/ratios-activite` — version 1.0.0

Rotation et durée de stockage, délai de recouvrement clients (DSO), délai de paiement fournisseurs (DPO), rotation de l’actif et des capitaux propres, cycle de conversion de trésorerie.

```text
Stock moyen = (SI + SF) / 2 ; rotation = coût des ventes / stock moyen ; DSO = clients / CA TTC × 360 ; DPO = fournisseurs / achats TTC × 360
```

**Entrées**

- `caHT` (montant) — Chiffre d’affaires HT — défaut : `1160000`
- `achatsHT` (montant) — Achats HT (marchandises et matières) — défaut : `520000`
- `coutVentes` (montant) — Coût d’achat des marchandises vendues — défaut : `508000`
- `stockInitial` (montant) — Stock initial — défaut : `133000`
- `stockFinal` (montant) — Stock final — défaut : `145000`
- `clients` (montant) — Créances clients TTC — défaut : `212000`
- `fournisseurs` (montant) — Dettes fournisseurs TTC — défaut : `98000`
- `tva` (taux) — Taux de TVA moyen — défaut : `20`
- `totalActif` (montant) — Total actif — défaut : `904000`
- `capitauxPropres` (montant) — Capitaux propres — défaut : `420000`
- `base` (choix) — Année commerciale — défaut : `360`

**Références**

- Méthodologie Banque de France / Centrale des bilans — ratios d’analyse financière

**Exemples vérifiés par les tests**

- *PME* → `rotationStocks` = 3.65, `dureeStockage` = 98.5, `dso` = 54.8, `dpo` = 56.5, `cycleTresorerie` = 96.8

#### Ratios boursiers

`POST /api/calc/financier/ratios-boursiers` — version 1.0.0

Bénéfice par action, PER, dividende par action, taux de distribution, rendement, valeur comptable par action et Price-to-Book.

```text
BPA = RN / nb actions ; PER = cours / BPA ; rendement = DPA / cours ; PBR = cours / (CP / nb actions)
```

**Entrées**

- `resultatNet` (montant) — Résultat net part du groupe — défaut : `12500000`
- `nbActions` (nombre) — Nombre moyen pondéré d’actions — défaut : `5000000`
- `cours` (montant) — Cours de l’action — défaut : `38.40`
- `dividendes` (montant) — Dividendes distribués — défaut : `5000000`
- `capitauxPropres` (montant) — Capitaux propres — défaut : `96000000`

**Références**

- IAS 33 — résultat par action
- Méthodologie Banque de France / Centrale des bilans — ratios d’analyse financière

**Exemples vérifiés par les tests**

- *Société cotée* → `bpa` = 2.50, `per` = 15.36, `dpa` = 1.00, `distribution` = 40.00, `rendement` = 2.60, `pbr` = 2.00

#### Leviers opérationnel, financier et combiné

`POST /api/calc/financier/leviers` — version 1.0.0

Sensibilité du résultat aux variations d’activité (levier opérationnel), à l’endettement (levier financier, effet de levier sur la rentabilité des capitaux propres) et levier combiné.

```text
LO = MCV / RE ; LF = RE / (RE − charges financières) ; levier combiné = LO × LF ; Rf = [Re + (Re − i) × D / CP] × (1 − t)
```

**Entrées**

- `ca` (montant) — Chiffre d’affaires — défaut : `1160000`
- `chargesVariables` (montant) — Charges variables — défaut : `696000`
- `chargesFixes` (montant) — Charges fixes d’exploitation — défaut : `345200`
- `chargesFinancieres` (montant) — Charges financières (intérêts) — défaut : `9400`
- `capitauxPropres` (montant) — Capitaux propres — défaut : `420000`
- `dettes` (montant) — Dettes financières — défaut : `210000`
- `tauxIs` (taux) — Taux d’IS — défaut : `25`

**Références**

- Analyse financière — effet de levier (formule de Modigliani-Miller)

**Exemples vérifiés par les tests**

- *PME* → `resultatExploitation` = 118800.00, `levierOperationnel` = 3.91, `levierFinancier` = 1.09, `levierCombine` = 4.24, `rentabiliteFinanciere` = 19.54

## <a id="tresorerie"></a>Trésorerie & financement

Emprunts, TAEG, agios, escompte, affacturage, budgets et plans de trésorerie, placements.

### Emprunts

#### Emprunt : échéancier, coût et TAEG

`POST /api/calc/tresorerie/emprunt` — version 1.0.0

Tableau d’amortissement complet (échéances constantes, amortissement constant ou in fine), différé partiel ou total, assurance sur capital initial ou restant dû, coût total du crédit, TEG proportionnel et TAEG actuariel.

```text
Échéance = C × i / (1 − (1 + i)^−n) ; intérêts = CRD × i ; amortissement = échéance − intérêts ; TAEG : (1 + i_p)^k − 1 où i_p annule C − frais − Σ échéances actualisées
```

**Entrées**

- `capital` (montant) — Capital emprunté — défaut : `100000`
- `taux` (taux) — Taux nominal annuel — défaut : `4`
- `dureeMois` (entier) — Durée (mois) — défaut : `60`
- `periodicite` (choix) — Périodicité des échéances — défaut : `12`
- `type` (choix) — Mode de remboursement — défaut : `annuites`
- `differe` (entier) — Différé (nombre d’échéances) — défaut : `0`
- `typeDiffere` (choix) — Type de différé — défaut : `partiel`
- `assurance` (taux) — Taux annuel d’assurance — défaut : `0`
- `assuranceSurCrd` (booleen) — Assurance calculée sur le capital restant dû — défaut : `false`
- `frais` (montant) — Frais de dossier et de garantie — défaut : `0`
- `premiereEcheance` (date, optionnel) — Date de la première échéance

**Références**

- Code de la consommation art. L.314-1 à L.314-5 et R.314-1 à R.314-4 — TAEG
- Code monétaire et financier art. L.313-4 — TEG des prêts aux professionnels

**Exemples vérifiés par les tests**

- *100 000 € à 4 % sur 5 ans* → `echeance` = 1841.65, `coutInterets` = 10499.17, `taeg` = 4.0742 (source : Formule de l’annuité constante, vérifiable sur tout simulateur bancaire)
- *Amortissement constant* → `coutInterets` = 10166.65
- *Avec frais et assurance* → `coutAssurance` = 1500.00

#### Emprunt à taux variable ou à paliers

`POST /api/calc/tresorerie/emprunt-taux-variable` — version 1.0.0

Recalcule l’échéance à chaque changement de taux sur le capital restant dû et la durée résiduelle (durée constante, échéance variable).

```text
À chaque palier : échéance = CRD × i / (1 − (1 + i)^−n restant)
```

**Entrées**

- `capital` (montant) — Capital emprunté — défaut : `200000`
- `dureeMois` (entier) — Durée (mois) — défaut : `120`
- `paliers` (table) — Paliers de taux

**Références**

- Code de la consommation art. L.313-25 — information sur la variation du taux

**Exemples vérifiés par les tests**

- *Trois paliers* → `echeanceInitiale` = 1949.73, `nbChangements` = 2

#### Loyer de crédit-bail ou de location financière

`POST /api/calc/tresorerie/loyer-credit-bail` — version 1.0.0

Calcule le loyer périodique constant à partir de la valeur du bien, du taux, de la durée et de la valeur résiduelle (option d’achat), terme échu ou à échoir.

```text
Loyer échu = (V − VR / (1 + i)^n) × i / (1 − (1 + i)^−n) ; à échoir : loyer échu / (1 + i)
```

**Entrées**

- `valeur` (montant) — Valeur du bien HT — défaut : `60000`
- `valeurResiduelle` (montant) — Valeur résiduelle / option d’achat — défaut : `600`
- `taux` (taux) — Taux annuel — défaut : `4.5`
- `nbLoyers` (entier) — Nombre de loyers — défaut : `20`
- `periodicite` (choix) — Périodicité des échéances — défaut : `12`
- `terme` (choix) — Paiement — défaut : `echoir`

**Références**

- Code monétaire et financier art. L.313-7 — crédit-bail

**Exemples vérifiés par les tests**

- *Matériel 60 000 €* → `loyer` = 3302.84

### Crédits court terme

#### Agios de découvert (échelle d’intérêts)

`POST /api/calc/tresorerie/agios-decouvert` — version 1.0.0

Établit l’échelle d’intérêts en dates de valeur : nombres débiteurs, intérêts débiteurs (base 360), commission du plus fort découvert, commission de mouvement, coût total et taux effectif, contrôle du taux d’usure.

```text
Intérêts = Σ (solde débiteur × jours) × taux / 360 ; CPFD = plus fort découvert × taux ; commission de mouvement = Σ débits × taux
```

**Entrées**

- `debut` (date) — Début de la période — défaut : `2025-03-01`
- `fin` (date) — Fin de la période — défaut : `2025-03-31`
- `soldeInitial` (montant) — Solde initial (négatif si débiteur) — défaut : `-4200`
- `mouvements` (table) — Mouvements (dates de valeur)
- `tauxDebiteur` (taux) — Taux débiteur annuel — défaut : `9.5`
- `cpfd` (taux) — Commission du plus fort découvert (mensuelle) — défaut : `0.05`
- `commissionMouvement` (taux) — Commission de mouvement — défaut : `0.025`
- `tauxUsure` (taux) — Taux de l’usure applicable — défaut : `15.2`

**Références**

- Code monétaire et financier art. L.313-4 et L.314-6 — usure
- Code de la consommation art. L.314-6 — taux d’usure (BdF)

**Exemples vérifiés par les tests**

- *Mars 2025* → `nombresDebiteurs` = 247700.00, `interets` = 65.37, `plusFortDecouvert` = 14800.00, `commissionPfd` = 7.40, `commissionMvt` = 3.98, `totalAgios` = 76.75

#### Escompte commercial et cession Dailly

`POST /api/calc/tresorerie/escompte-dailly` — version 1.0.0

Calcule l’escompte de chaque effet (jours de banque, minimum de jours), les commissions et leur TVA, le net crédité et le taux réel de revient du financement.

```text
Escompte = nominal × taux × jours / 360 (jours = max(échéance − remise + jours de banque ; minimum)) ; net = Σ nominaux − escompte − commissions TTC
```

**Entrées**

- `operation` (choix) — Opération — défaut : `escompte`
- `dateRemise` (date) — Date de remise / cession — défaut : `2025-04-10`
- `effets` (table) — Effets / créances
- `taux` (taux) — Taux d’escompte annuel — défaut : `6.2`
- `joursBanque` (entier) — Jours de banque — défaut : `1`
- `minimumJours` (entier) — Minimum de jours — défaut : `10`
- `commissionParEffet` (montant) — Commission HT par effet — défaut : `6.50`
- `tvaCommissions` (taux) — TVA sur commissions — défaut : `20`

**Références**

- Code de commerce art. L.511-1 et s. — lettre de change
- Code monétaire et financier art. L.313-23 à L.313-34 — cession de créances professionnelles (Dailly)
- CGI art. 261 C-1° — exonération de TVA des intérêts

**Exemples vérifiés par les tests**

- *Bordereau de 3 LCR* → `totalNominal` = 12610.00, `escompte` = 114.38, `commissionsHT` = 19.50, `net` = 12472.22

#### Coût de l’affacturage

`POST /api/calc/tresorerie/affacturage` — version 1.0.0

Coût annuel d’un contrat d’affacturage : commission d’affacturage (TVA en sus), commission de financement sur l’encours financé, retenue de garantie, financement mobilisable et coût rapporté au CA.

```text
Commission d’affacturage = CA cédé TTC × taux ; financement = CA cédé × (1 − retenue) × taux × délai / 360 ; coût = commissions HT
```

**Entrées**

- `caCedeTTC` (montant) — CA cédé annuel TTC — défaut : `1800000`
- `commission` (taux) — Commission d’affacturage — défaut : `0.6`
- `tauxFinancement` (taux) — Taux de la commission de financement (annuel) — défaut : `5.4`
- `delaiMoyen` (nombre) — Délai moyen de règlement des clients (jours) — défaut : `58`
- `retenue` (taux) — Retenue de garantie — défaut : `10`
- `tva` (taux) — TVA sur commission d’affacturage — défaut : `20`

**Références**

- Code monétaire et financier art. L.313-23 et s. ; subrogation conventionnelle (Code civil art. 1346-1)

**Exemples vérifiés par les tests**

- *CA cédé 1,8 M€* → `commissionAffacturage` = 10800.00, `commissionFinancement` = 14094.00, `coutTotalHT` = 24894.00, `financementDisponible` = 1620000.00

### Prévisionnel

#### Budget de trésorerie mensuel

`POST /api/calc/tresorerie/budget-tresorerie` — version 1.0.0

Transforme les ventes et achats en encaissements et décaissements décalés selon les délais clients et fournisseurs, ajoute les autres flux, calcule la trésorerie de fin de mois et détecte les tensions.

```text
Encaissements(m) = Σ CA(m − k) × %k ; décaissements(m) = Σ achats(m − k) × %k + autres ; trésorerie(m) = trésorerie(m − 1) + encaissements − décaissements
```

**Entrées**

- `tresorerieInitiale` (montant) — Trésorerie de début — défaut : `25000`
- `clientsComptant` (taux) — Clients payés au comptant — défaut : `20`
- `clients30` (taux) — Clients à 30 jours — défaut : `50`
- `clients60` (taux) — Clients à 60 jours — défaut : `30`
- `fournisseursComptant` (taux) — Fournisseurs payés au comptant — défaut : `0`
- `fournisseurs30` (taux) — Fournisseurs à 30 jours — défaut : `40`
- `fournisseurs60` (taux) — Fournisseurs à 60 jours — défaut : `60`
- `creancesInitialesM1` (montant) — Créances antérieures encaissées en M1 — défaut : `38000`
- `creancesInitialesM2` (montant) — Créances antérieures encaissées en M2 — défaut : `14000`
- `dettesInitialesM1` (montant) — Dettes fournisseurs antérieures payées en M1 — défaut : `21000`
- `dettesInitialesM2` (montant) — Dettes fournisseurs antérieures payées en M2 — défaut : `9000`
- `mois` (table) — Prévisions mensuelles (TTC)

**Références**

- Gestion de trésorerie — budget des encaissements et des décaissements

**Exemples vérifiés par les tests**

- *Semestre* → `tresorerieFinale` = 33600.00, `tresorerieMin` = 26000.00, `moisTension` = 0

#### Plan de trésorerie à 13 semaines

`POST /api/calc/tresorerie/plan-13-semaines` — version 1.0.0

Prévision glissante hebdomadaire : solde de chaque semaine, comparaison au seuil de sécurité et à la ligne de crédit autorisée, besoin de financement.

```text
Trésorerie(s) = trésorerie(s − 1) + encaissements(s) − décaissements(s) ; alerte si < seuil ; besoin = max(0 ; −point bas − ligne autorisée)
```

**Entrées**

- `tresorerieInitiale` (montant) — Trésorerie disponible — défaut : `42000`
- `seuil` (montant) — Seuil de sécurité — défaut : `15000`
- `ligneAutorisee` (montant) — Découvert / ligne de crédit autorisée — défaut : `30000`
- `semaines` (table) — Semaines

**Références**

- Pratique de gestion de trésorerie (13-week cash flow forecast)

**Exemples vérifiés par les tests**

- *13 semaines* → `tresorerieFinale` = 5000.00, `pointBas` = -3000.00, `semainesSousSeuil` = 6, `besoinFinancement` = 0.00

### Placements

#### Intérêts simples et composés, valeur acquise et actuelle

`POST /api/calc/tresorerie/interets-placement` — version 1.0.0

Intérêts simples ou composés (capitalisation annuelle, mensuelle…), valeur acquise d’un placement ou valeur actuelle d’une somme future, taux actuariel équivalent.

```text
Simples : I = C × i × n ; composés : Cn = C × (1 + i/k)^(n×k) ; valeur actuelle : C0 = Cn / (1 + i/k)^(n×k)
```

**Entrées**

- `calcul` (choix) — Calcul — défaut : `simples`
- `montant` (montant) — Capital placé (ou somme future) — défaut : `50000`
- `taux` (taux) — Taux annuel — défaut : `3.5`
- `duree` (nombre) — Durée (années) — défaut : `5`
- `capitalisation` (choix) — Capitalisation — défaut : `1`

**Références**

- Mathématiques financières — capitalisation et actualisation

**Exemples vérifiés par les tests**

- *Composés annuels* → `valeur` = 59384.32, `interets` = 9384.32
- *Simples* → `interets` = 8750.00, `valeur` = 58750.00
- *Valeur actuelle* → `valeur` = 50000.00

#### Obligation : taux actuariel, duration, sensibilité

`POST /api/calc/tresorerie/rendement-obligation` — version 1.0.0

Taux de rendement actuariel d’une obligation à coupon fixe acquise à un prix donné, duration de Macaulay, duration modifiée (sensibilité) et convexité.

```text
Prix = Σ coupon / (1 + r)^t + remboursement / (1 + r)^n ; D = Σ t × CFt / (1 + r)^t / prix ; S = −D / (1 + r)
```

**Entrées**

- `nominal` (montant) — Valeur nominale — défaut : `1000`
- `prix` (montant) — Prix d’acquisition (pied de coupon) — défaut : `965`
- `coupon` (taux) — Taux du coupon annuel — défaut : `3`
- `annees` (entier) — Années restant à courir — défaut : `6`
- `primeRemboursement` (taux) — Prix de remboursement (% du nominal) — défaut : `100`

**Références**

- Mathématiques financières — évaluation obligataire

**Exemples vérifiés par les tests**

- *Obligation 3 % à 6 ans* → `tauxActuariel` = 3.6603, `duration` = 5.5708, `sensibilite` = -5.3741

#### Valeur actuelle et valeur acquise d’une suite d’annuités

`POST /api/calc/tresorerie/annuites` — version 1.0.0

Valeur actuelle et valeur acquise d’une suite de versements constants en fin ou en début de période (épargne, loyers, rentes).

```text
VA = a × (1 − (1 + i)^−n) / i ; VF = a × ((1 + i)^n − 1) / i ; × (1 + i) en début de période
```

**Entrées**

- `annuite` (montant) — Versement périodique — défaut : `500`
- `taux` (taux) — Taux périodique — défaut : `0.25`
- `n` (entier) — Nombre de versements — défaut : `120`
- `terme` (choix) — Versements — défaut : `echu`

**Références**

- Mathématiques financières — annuités constantes

**Exemples vérifiés par les tests**

- *500 €/mois pendant 10 ans à 0,25 %/mois* → `valeurActuelle` = 51780.88, `valeurAcquise` = 69870.71, `totalVerse` = 60000.00

## <a id="analytique"></a>Comptabilité analytique

Coûts complets, centres d’analyse, ABC, seuil de rentabilité, analyse des écarts.

### Coûts complets

#### Cascade des coûts complets

`POST /api/calc/analytique/cout-complet` — version 1.0.0

Du coût d’achat au coût de revient puis au résultat analytique, en totalité et à l’unité.

```text
Coût d’achat = prix + frais d’approvisionnement ; coût de production = matières consommées + MOD + charges de production ; coût de revient = coût de production des produits vendus + distribution ; résultat = CA − coût de revient
```

**Entrées**

- `quantiteAchetee` (nombre) — Quantité de matières achetées — défaut : `12000`
- `prixAchat` (montant) — Prix d’achat unitaire — défaut : `4.20`
- `fraisApprovisionnement` (montant) — Frais d’approvisionnement — défaut : `6600`
- `quantiteConsommee` (nombre) — Quantité de matières consommées — défaut : `11000`
- `mod` (montant) — Main-d’œuvre directe — défaut : `38500`
- `chargesProduction` (montant) — Charges indirectes de production (centres) — défaut : `27300`
- `quantiteProduite` (nombre) — Quantité produite — défaut : `5000`
- `quantiteVendue` (nombre) — Quantité vendue — défaut : `4600`
- `distribution` (montant) — Coût de distribution — défaut : `14100`
- `prixVente` (montant) — Prix de vente unitaire HT — défaut : `39`

**Références**

- Plan comptable général 1982, titre III — comptabilité analytique (méthode des centres d’analyse)

**Exemples vérifiés par les tests**

- *Fabrication* → `coutAchat` = 57000.00, `coutAchatUnitaire` = 4.7500, `coutProduction` = 118050.00, `coutProductionUnitaire` = 23.6100, `coutRevient` = 122706.00, `resultat` = 56694.00

#### Tableau de répartition des charges indirectes

`POST /api/calc/analytique/repartition-centres` — version 1.0.0

Répartition primaire, répartition secondaire des centres auxiliaires (y compris prestations réciproques résolues par système d’équations) et coût de l’unité d’œuvre des centres principaux.

```text
Pour chaque auxiliaire A : total(A) = primaire(A) + Σ % reçus × total(autres auxiliaires) ; coût UO = total centre principal / nombre d’UO
```

**Entrées**

- `centres` (table) — Centres et répartition primaire
- `cles` (table) — Clés de répartition secondaire (%)

**Références**

- Plan comptable général 1982, titre III — comptabilité analytique (méthode des centres d’analyse)

**Exemples vérifiés par les tests**

- *Deux auxiliaires réciproques* → `total_Administration` = 27551.02, `total_Entretien` = 17755.10, `cout_Atelier` = 29.8744, `totalPrincipaux` = 134000.00

#### Méthode ABC (coûts par activités)

`POST /api/calc/analytique/abc` — version 1.0.0

Calcule le coût unitaire de chaque inducteur à partir du coût des activités, puis affecte ces coûts aux produits selon leur consommation d’inducteurs.

```text
Coût de l’inducteur = coût de l’activité / volume de l’inducteur ; coût produit = Σ consommation × coût inducteur
```

**Entrées**

- `activites` (table) — Activités
- `consommations` (table) — Consommation d’inducteurs par produit

**Références**

- Activity Based Costing (Kaplan & Cooper) ; PCG — comptabilité analytique

**Exemples vérifiés par les tests**

- *Deux gammes* → `inducteur_Réception` = 70.0000, `cout_Standard` = 143500.00, `cout_Sur mesure` = 81500.00

#### Imputation rationnelle des charges fixes

`POST /api/calc/analytique/imputation-rationnelle` — version 1.0.0

Neutralise l’effet du niveau d’activité sur les coûts : charges fixes imputées au prorata de l’activité réelle sur l’activité normale, différence d’incorporation (coût de sous-activité ou boni de suractivité).

```text
Coefficient = activité réelle / activité normale ; CF imputées = CF × coefficient ; différence = CF − CF imputées
```

**Entrées**

- `chargesFixes` (montant) — Charges fixes du centre — défaut : `84000`
- `chargesVariables` (montant) — Charges variables du centre — défaut : `46200`
- `activiteNormale` (nombre) — Activité normale (UO) — défaut : `12000`
- `activiteReelle` (nombre) — Activité réelle (UO) — défaut : `10500`

**Références**

- PCG art. 213-31 — exclusion des coûts de sous-activité du coût des stocks
- Plan comptable général 1982, titre III — comptabilité analytique (méthode des centres d’analyse)

**Exemples vérifiés par les tests**

- *Sous-activité* → `coefficient` = 87.50, `fixesImputees` = 73500.00, `difference` = 10500.00, `coutUoRationnel` = 11.4000

### Coûts partiels

#### Coûts variables et seuil de rentabilité

`POST /api/calc/analytique/seuil-rentabilite` — version 1.0.0

Marge sur coût variable, taux de MCV, seuil de rentabilité en valeur et en quantité, point mort (en jours et en date), marge et indice de sécurité, levier opérationnel.

```text
MCV = CA − CV ; taux MCV = MCV / CA ; SR = CF / taux MCV ; point mort = SR / CA × 360 j ; MS = CA − SR ; IS = MS / CA ; LO = MCV / résultat
```

**Entrées**

- `ca` (montant) — Chiffre d’affaires HT — défaut : `1200000`
- `chargesVariables` (montant) — Charges variables — défaut : `720000`
- `chargesFixes` (montant) — Charges fixes — défaut : `330000`
- `prixUnitaire` (montant, optionnel) — Prix de vente unitaire (optionnel)
- `debutExercice` (date) — Début de l’exercice — défaut : `2025-01-01`
- `fermeture` (choix) — Activité — défaut : `reguliere`

**Références**

- Méthode du coût variable (direct costing)

**Exemples vérifiés par les tests**

- *PME* → `mcv` = 480000.00, `tauxMcv` = 40.00, `seuil` = 825000.00, `pointMortJours` = 248, `dateSeuil` = 2025-09-08, `margeSecurite` = 375000.00, `indiceSecurite` = 31.25, `levier` = 3.20

### Analyse des écarts

#### Écarts sur matières et main-d’œuvre directe

`POST /api/calc/analytique/ecarts-matieres-mod` — version 1.0.0

Décompose l’écart entre coût réel et coût préétabli de la production réelle en écart sur prix (ou taux) et écart sur quantité (ou temps).

```text
Écart global = Qr × Pr − Qp × Ps ; écart sur prix = (Pr − Ps) × Qr ; écart sur quantité = (Qr − Qp) × Ps, avec Qp = quantité standard × production réelle
```

**Entrées**

- `nature` (choix) — Nature — défaut : `matieres`
- `productionReelle` (nombre) — Production réelle (unités) — défaut : `4800`
- `quantiteStandardUnitaire` (nombre) — Quantité standard par unité — défaut : `2.5`
- `prixStandard` (montant) — Prix (ou taux horaire) standard — défaut : `6.00`
- `quantiteReelle` (nombre) — Quantité (ou heures) réelle consommée — défaut : `12300`
- `prixReel` (montant) — Prix (ou taux horaire) réel — défaut : `5.85`

**Références**

- Contrôle de gestion — analyse des écarts sur coûts directs

**Exemples vérifiés par les tests**

- *Matières* → `coutReel` = 71955.00, `coutPreetabli` = 72000.00, `ecartGlobal` = -45.00, `ecartPrix` = -1845.00, `ecartQuantite` = 1800.00

#### Écarts sur charges indirectes (budget, activité, rendement)

`POST /api/calc/analytique/ecarts-centre` — version 1.0.0

Analyse de l’écart d’un centre de production avec un budget flexible : écart sur budget, écart sur activité (imputation des charges fixes) et écart sur rendement.

```text
Budget flexible BF(A) = CV unitaire × A + CF ; E/budget = CR − BF(Ar) ; E/activité = BF(Ar) − Cs × Ar ; E/rendement = Cs × (Ar − Ap)
```

**Entrées**

- `activiteNormale` (nombre) — Activité normale (UO) — défaut : `10000`
- `chargesFixesBudget` (montant) — Charges fixes budgétées — défaut : `60000`
- `cvUnitaire` (montant) — Charge variable standard par UO — défaut : `4.50`
- `activiteReelle` (nombre) — Activité réelle (UO consommées) — défaut : `9400`
- `activitePreetablie` (nombre) — Activité préétablie pour la production réelle (UO) — défaut : `9000`
- `coutReel` (montant) — Coût réel du centre — défaut : `105800`

**Références**

- Contrôle de gestion — budget flexible et analyse des écarts sur centres

**Exemples vérifiés par les tests**

- *Atelier* → `coutStandardUo` = 10.5000, `ecartBudget` = 3500.00, `ecartActivite` = 3600.00, `ecartRendement` = 4200.00, `ecartGlobal` = 11300.00

#### Écarts sur chiffre d’affaires (prix, volume, composition)

`POST /api/calc/analytique/ecarts-ca` — version 1.0.0

Décompose l’écart entre CA réel et CA budgété en écart sur prix, écart sur volume global et écart sur composition des ventes (mix).

```text
E/prix = Σ (Pr − Pp) × Qr ; E/volume = (Qr total − Qp total) × Pp moyen ; E/mix = Σ Pp × (Qr − Qr total × mix prévu) 
```

**Entrées**

- `produits` (table) — Produits

**Références**

- Contrôle de gestion — analyse des écarts sur chiffre d’affaires

**Exemples vérifiés par les tests**

- *Deux gammes* → `caPrevu` = 180000.00, `caReel` = 195100.00, `ecartGlobal` = 15100.00, `ecartPrix` = -1900.00, `ecartVolume` = 15000.00, `ecartComposition` = 2000.00

### Pilotage

#### Prix de cession interne

`POST /api/calc/analytique/prix-cession-interne` — version 1.0.0

Compare les méthodes de fixation du prix de cession entre centres (coût complet, coût variable, coût majoré, prix de marché) et leur effet sur le résultat de chaque centre.

```text
Résultat cédant = (PCI − coût complet) × Q ; résultat acheteur = (prix final − PCI − coûts propres) × Q ; Σ = constant
```

**Entrées**

- `quantite` (nombre) — Quantité cédée — défaut : `10000`
- `coutVariable` (montant) — Coût variable unitaire du cédant — défaut : `18`
- `coutComplet` (montant) — Coût complet unitaire du cédant — défaut : `26`
- `marge` (taux) — Marge sur coût complet — défaut : `10`
- `prixMarche` (montant) — Prix de marché unitaire — défaut : `31`
- `coutsPropresAcheteur` (montant) — Coûts propres unitaires de l’acheteur — défaut : `14`
- `prixVenteFinal` (montant) — Prix de vente final unitaire — défaut : `48`

**Références**

- Contrôle de gestion — prix de cession interne ; CGI art. 57 et OCDE (prix de transfert) pour les flux entre entités

**Exemples vérifiés par les tests**

- *Comparaison* → `resultatGroupe` = 80000.00, `cedant_marche` = 50000.00, `acheteur_marche` = 30000.00

#### Coût cible (target costing)

`POST /api/calc/analytique/cout-cible` — version 1.0.0

Déduit le coût admissible du prix de marché et de la marge visée, le compare au coût estimé et ventile l’effort de réduction par fonction.

```text
Coût cible = prix de marché × (1 − taux de marge visé) ; écart = coût estimé − coût cible
```

**Entrées**

- `prixMarche` (montant) — Prix de vente accepté par le marché — défaut : `250`
- `margeVisee` (taux) — Marge visée sur prix de vente — défaut : `22`
- `fonctions` (table) — Coût estimé par fonction

**Références**

- Contrôle de gestion — target costing

**Exemples vérifiés par les tests**

- *Nouveau produit* → `coutCible` = 195.00, `coutEstime` = 209.00, `ecart` = 14.00, `reductionNecessaire` = 6.70

## <a id="investissement"></a>Investissement & décision

VAN, TRI, IP, DRCI, CMPC, MEDAF, Monte-Carlo, choix de financement.

### Critères de choix

#### VAN, TRI, TRIM, IP et délai de récupération

`POST /api/calc/investissement/van-tri` — version 1.0.0

Évalue un projet à partir de l’investissement initial et des flux nets de trésorerie : VAN, TRI, TRI modifié, indice de profitabilité, délai de récupération simple et actualisé.

```text
VAN = Σ CFt / (1 + k)^t − I0 ; TRI : VAN = 0 ; IP = Σ CFt actualisés / I0 ; TRIM = (VF des flux au taux de réinvestissement / I0)^(1/n) − 1
```

**Entrées**

- `investissement` (montant) — Investissement initial (I0) — défaut : `250000`
- `flux` (liste) — Flux nets de trésorerie (années 1 à n)
- `taux` (taux) — Taux d’actualisation — défaut : `9`
- `valeurResiduelle` (montant) — Valeur résiduelle et récupération du BFR (année n) — défaut : `20000`
- `tauxReinvestissement` (taux) — Taux de réinvestissement (TRIM) — défaut : `6`

**Références**

- Finance d’entreprise — critères de choix d’investissement (VAN, TRI, IP, DRCI)

**Exemples vérifiés par les tests**

- *Projet industriel* → `van` = 55934.94, `tri` = 16.77, `ip` = 1.2237, `drci` = 3.31, `drciActualise` = 4.08

#### Construction des flux nets de trésorerie d’un projet

`POST /api/calc/investissement/flux-investissement` — version 1.0.0

Construit les flux annuels à partir du CA, des charges décaissables, des dotations (économie d’impôt), de la variation du BFR et de la valeur résiduelle nette d’impôt, puis calcule VAN et TRI.

```text
CAF d’exploitation = (EBE − dotations) × (1 − t) + dotations ; flux = CAF − ΔBFR − investissement + VR nette
```

**Entrées**

- `investissement` (montant) — Investissement (amortissable linéairement) — défaut : `300000`
- `duree` (entier) — Durée du projet et d’amortissement (années) — défaut : `5`
- `caAnnee1` (montant) — Chiffre d’affaires année 1 — défaut : `400000`
- `croissance` (taux) — Croissance annuelle du CA — défaut : `5`
- `tauxCharges` (taux) — Charges décaissables en % du CA — défaut : `70`
- `bfr` (taux) — BFR en % du CA — défaut : `10`
- `valeurResiduelle` (montant) — Prix de revente en fin de projet — défaut : `30000`
- `tauxIs` (taux) — Taux d’IS — défaut : `25`
- `taux` (taux) — Taux d’actualisation — défaut : `8`

**Références**

- Finance d’entreprise — critères de choix d’investissement (VAN, TRI, IP, DRCI)

**Exemples vérifiés par les tests**

- *Nouvelle ligne de production* → `van` = 158831.32, `tri` = 23.52

### Coût du capital

#### Coût moyen pondéré du capital (CMPC / WACC)

`POST /api/calc/investissement/cmpc` — version 1.0.0

Pondère le coût des fonds propres et le coût de la dette après impôt par leurs valeurs de marché.

```text
CMPC = Ke × CP / (CP + D) + Kd × (1 − t) × D / (CP + D)
```

**Entrées**

- `capitauxPropres` (montant) — Valeur de marché des capitaux propres — défaut : `6000000`
- `dettes` (montant) — Valeur de marché de la dette nette — défaut : `2500000`
- `coutFondsPropres` (taux) — Coût des fonds propres (Ke) — défaut : `11.2`
- `coutDette` (taux) — Coût de la dette avant impôt (Kd) — défaut : `4.8`
- `tauxIs` (taux) — Taux d’IS — défaut : `25`

**Références**

- Finance d’entreprise — coût du capital (Modigliani-Miller avec impôt)

**Exemples vérifiés par les tests**

- *ETI* → `cmpc` = 8.96, `poidsFondsPropres` = 70.59

#### Coût des fonds propres (MEDAF) et bêta

`POST /api/calc/investissement/medaf` — version 1.0.0

Coût des fonds propres par le MEDAF, avec désendettement et réendettement du bêta (formule de Hamada) pour adapter un bêta sectoriel à la structure financière de l’entreprise.

```text
Ke = Rf + β × (Rm − Rf) [+ prime spécifique] ; βu = βl / (1 + (1 − t) × D/CP) ; βl = βu × (1 + (1 − t) × D/CP)
```

**Entrées**

- `sansRisque` (taux) — Taux sans risque (OAT 10 ans) — défaut : `3.1`
- `primeMarche` (taux) — Prime de risque du marché (Rm − Rf) — défaut : `5.5`
- `betaReference` (nombre) — Bêta endetté de référence (comparables) — défaut : `1.15`
- `detteSurCpReference` (nombre) — D/CP des comparables — défaut : `0.4`
- `detteSurCpCible` (nombre) — D/CP de l’entreprise — défaut : `0.6`
- `tauxIs` (taux) — Taux d’IS — défaut : `25`
- `primeSpecifique` (taux) — Prime spécifique (taille, illiquidité) — défaut : `1.5`

**Références**

- Sharpe (1964), Lintner (1965) — MEDAF ; Hamada (1972)

**Exemples vérifiés par les tests**

- *PME non cotée* → `betaDesendette` = 0.884615, `betaReendette` = 1.282692, `ke` = 11.65

#### Bêta d’un titre (régression sur le marché)

`POST /api/calc/investissement/beta` — version 1.0.0

Estime le bêta d’un titre à partir des séries de rentabilités du titre et du marché, ainsi que le coefficient de corrélation et le R².

```text
β = cov(Ri, Rm) / var(Rm) ; ρ = cov / (σi × σm) ; α = moy(Ri) − β × moy(Rm)
```

**Entrées**

- `titre` (liste) — Rentabilités du titre (%)
- `marche` (liste) — Rentabilités du marché (%)

**Références**

- Modèle de marché (Sharpe, 1963)

**Exemples vérifiés par les tests**

- *12 mois* → `beta` = 1.337

### Risque

#### Analyse par scénarios

`POST /api/calc/investissement/scenarios` — version 1.0.0

VAN de chaque scénario (pessimiste, réaliste, optimiste…), espérance, écart-type et coefficient de variation de la VAN, probabilité de VAN négative.

```text
VAN(s) = Σ CF(s) / (1 + k)^t − I0 ; E(VAN) = Σ p(s) × VAN(s) ; σ = √Σ p(s) × (VAN(s) − E)²
```

**Entrées**

- `investissement` (montant) — Investissement initial — défaut : `250000`
- `duree` (entier) — Durée (années) — défaut : `5`
- `taux` (taux) — Taux d’actualisation — défaut : `9`
- `scenarios` (table) — Scénarios

**Références**

- Finance d’entreprise — critères de choix d’investissement (VAN, TRI, IP, DRCI)

**Exemples vérifiés par les tests**

- *Trois scénarios* → `esperance` = 39779.02, `ecartType` = 60540.02, `probaVanNegative` = 25.00

#### Simulation de Monte-Carlo de la VAN

`POST /api/calc/investissement/monte-carlo` — version 1.0.0

Simule la VAN d’un projet en tirant chaque année un flux selon une loi normale (moyenne, écart-type). Le générateur pseudo-aléatoire est initialisé par une graine : la simulation est reproductible.

```text
CFt ~ N(μ, σ) ; VAN_s = Σ CFt,s / (1 + k)^t − I0 ; statistiques sur les simulations
```

**Entrées**

- `investissement` (montant) — Investissement initial — défaut : `250000`
- `duree` (entier) — Durée (années) — défaut : `5`
- `fluxMoyen` (montant) — Flux annuel moyen — défaut : `75000`
- `ecartTypeFlux` (montant) — Écart-type du flux annuel — défaut : `18000`
- `taux` (taux) — Taux d’actualisation — défaut : `9`
- `simulations` (entier) — Nombre de simulations — défaut : `1000`
- `graine` (entier) — Graine du générateur — défaut : `42`

**Références**

- Méthode de Monte-Carlo appliquée au choix d’investissement (Hertz, 1964)

**Exemples vérifiés par les tests**

- *1 000 tirages, graine 42* → `simulations` = 1000, `vanMoyenne` = 42495.93, `ecartType` = 31974.76, `probaVanNegative` = 7.70

#### Arbre de décision

`POST /api/calc/investissement/arbre-decision` — version 1.0.0

Calcule l’espérance de gain de chaque option (somme des issues pondérées par leur probabilité, moins le coût de l’option) et recommande l’option dominante.

```text
E(option) = Σ p(issue) × gain(issue) − coût ; décision = argmax E
```

**Entrées**

- `issues` (table) — Options et issues

**Références**

- Théorie de la décision — critère de l’espérance mathématique

**Exemples vérifiés par les tests**

- *Capacité de production* → `meilleure` = Grande usine, `esperanceMax` = 420000.00

### Financement

#### Choix du mode de financement

`POST /api/calc/investissement/choix-financement` — version 1.0.0

Compare la valeur actuelle des décaissements nets d’impôt d’un financement par fonds propres, par emprunt et par crédit-bail, et retient la solution la moins coûteuse.

```text
Emprunt : Σ (annuité − économie d’IS sur intérêts et dotations) actualisés ; crédit-bail : Σ (loyer × (1 − t)) + option − économies d’IS ; actualisation au coût de la dette après impôt
```

**Entrées**

- `investissement` (montant) — Montant de l’investissement — défaut : `200000`
- `duree` (entier) — Durée d’amortissement et de financement (années) — défaut : `5`
- `tauxIs` (taux) — Taux d’IS — défaut : `25`
- `tauxEmprunt` (taux) — Taux de l’emprunt — défaut : `4.5`
- `loyerAnnuel` (montant) — Loyer annuel de crédit-bail (début d’année) — défaut : `45500`
- `optionAchat` (montant) — Option d’achat (fin de contrat) — défaut : `2000`
- `tauxActualisation` (taux) — Taux d’actualisation (coût de la dette après impôt) — défaut : `3.375`

**Références**

- Finance d’entreprise — critères de choix d’investissement (VAN, TRI, IP, DRCI)
- Code monétaire et financier art. L.313-7 — crédit-bail

**Exemples vérifiés par les tests**

- *Machine 200 000 €* → `meilleure` = Emprunt

## <a id="stocks"></a>Stocks & approvisionnements

CMP, FIFO, LIFO, Wilson, stock de sécurité, rotation, écarts d’inventaire.

### Valorisation

#### Valorisation des stocks : CMP, FIFO, LIFO

`POST /api/calc/stocks/valorisation-stock` — version 1.0.0

Établit la fiche de stock selon la méthode choisie (CMP après chaque entrée, CMP périodique, FIFO, LIFO) et compare les quatre méthodes sur le coût des sorties et le stock final.

```text
CMP = (valeur du stock + valeur de l’entrée) / (quantité du stock + quantité entrée) ; FIFO : sorties au coût des lots les plus anciens ; LIFO : des plus récents
```

**Entrées**

- `methode` (choix) — Méthode de la fiche — défaut : `cmp`
- `qInitiale` (nombre) — Stock initial — quantité — défaut : `200`
- `vInitiale` (montant) — Stock initial — valeur — défaut : `2400`
- `mouvements` (table) — Mouvements

**Références**

- PCG art. 213-34 — coût d’entrée des biens fongibles : CMP ou PEPS
- IAS 2 § 25 — FIFO ou coût moyen pondéré ; LIFO interdit
- CGI ann. III art. 38 nonies

**Exemples vérifiés par les tests**

- *CMP* → `coutSorties` = 7911.91, `stockFinalV` = 3478.09, `stockFinalQ` = 270
- *FIFO* → `coutSorties` = 7853.00, `stockFinalV` = 3537.00
- *LIFO* → `coutSorties` = 8018.00, `stockFinalV` = 3372.00

#### Valeur nette de réalisation

`POST /api/calc/stocks/valeur-nette-realisation` — version 1.0.0

Calcule la valeur nette de réalisation (prix de vente estimé − coûts d’achèvement − coûts de commercialisation) et la dépréciation éventuelle par rapport au coût.

```text
VNR = prix de vente estimé − coûts d’achèvement − frais de vente ; dépréciation = max(0 ; coût − VNR) × quantité
```

**Entrées**

- `quantite` (nombre) — Quantité en stock — défaut : `850`
- `cout` (montant) — Coût unitaire d’entrée — défaut : `42`
- `prixVente` (montant) — Prix de vente estimé unitaire — défaut : `55`
- `coutsAchevement` (montant) — Coûts d’achèvement unitaires — défaut : `6`
- `fraisVente` (taux) — Frais de commercialisation (% du prix) — défaut : `18`

**Références**

- PCG art. 214-25 ; IAS 2 § 28 à 33 — valeur nette de réalisation

**Exemples vérifiés par les tests**

- *Produits en cours* → `vnrUnitaire` = 39.10, `depreciation` = 2465.00, `valeurBilan` = 33235.00

### Gestion des approvisionnements

#### Quantité économique de commande (Wilson)

`POST /api/calc/stocks/wilson` — version 1.0.0

Détermine la quantité optimale à commander qui minimise la somme des coûts de passation et de possession, le nombre de commandes, la périodicité et le coût total de gestion.

```text
Q* = √(2 × D × Cp / Cs) avec Cs = taux de possession × prix unitaire ; N = D / Q* ; coût = Cp × D/Q + Cs × Q/2
```

**Entrées**

- `demande` (nombre) — Consommation annuelle (unités) — défaut : `24000`
- `coutPassation` (montant) — Coût de passation d’une commande — défaut : `150`
- `prixUnitaire` (montant) — Prix d’achat unitaire — défaut : `8`
- `tauxPossession` (taux) — Taux de possession annuel — défaut : `12`

**Références**

- Modèle de Wilson (Harris, 1913)

**Exemples vérifiés par les tests**

- *Composant* → `quantiteOptimale` = 2739, `nbCommandes` = 8.76, `periodicite` = 41.1, `coutGestion` = 2629.07

#### Stock de sécurité et point de commande

`POST /api/calc/stocks/stock-securite` — version 1.0.0

Stock de sécurité par la méthode statistique (niveau de service) ou forfaitaire (jours de sécurité), point de commande et stock d’alerte.

```text
Statistique : SS = z × σ_journalière × √délai ; forfaitaire : SS = consommation journalière × jours de sécurité ; point de commande = consommation × délai + SS
```

**Entrées**

- `consommationJournaliere` (nombre) — Consommation moyenne par jour — défaut : `80`
- `delai` (nombre) — Délai de livraison (jours) — défaut : `12`
- `methode` (choix) — Méthode — défaut : `statistique`
- `ecartTypeJournalier` (nombre) — Écart-type de la consommation journalière — défaut : `22`
- `niveauService` (choix) — Niveau de service — défaut : `1.6449`
- `joursSecurite` (nombre) — Jours de sécurité — défaut : `5`

**Références**

- Gestion des stocks — niveau de service et loi normale

**Exemples vérifiés par les tests**

- *Statistique 95 %* → `stockSecurite` = 126, `pointCommande` = 1086
- *Forfaitaire* → `stockSecurite` = 400, `pointCommande` = 1360

### Indicateurs

#### Rotation, durée de stockage et couverture

`POST /api/calc/stocks/rotation-stocks` — version 1.0.0

Stock moyen, coefficient de rotation, durée moyenne de stockage et couverture du stock final en jours de consommation.

```text
Stock moyen = (SI + SF) / 2 ; rotation = coût des sorties / stock moyen ; durée = 360 / rotation ; couverture = SF / consommation journalière
```

**Entrées**

- `stockInitial` (montant) — Stock initial (valeur) — défaut : `48000`
- `stockFinal` (montant) — Stock final (valeur) — défaut : `56000`
- `achats` (montant) — Achats de la période — défaut : `318000`
- `joursPeriode` (nombre) — Jours de la période — défaut : `360`

**Références**

- Analyse financière — rotation des stocks (Banque de France)

**Exemples vérifiés par les tests**

- *Négoce* → `coutSorties` = 310000.00, `stockMoyen` = 52000.00, `rotation` = 5.96, `duree` = 60.4, `couverture` = 65.0

### Inventaire

#### Écarts d’inventaire

`POST /api/calc/stocks/ecarts-inventaire` — version 1.0.0

Compare le stock théorique (inventaire permanent) à l’inventaire physique, valorise les écarts, calcule le taux de démarque et propose l’écriture de régularisation.

```text
Écart = (quantité physique − quantité théorique) × coût unitaire ; démarque = Σ écarts négatifs / stock théorique
```

**Entrées**

- `articles` (table) — Articles

**Références**

- Code de commerce art. L.123-12 — inventaire annuel
- PCG art. 946-60 / 947-71 — variations de stocks

**Exemples vérifiés par les tests**

- *Inventaire de clôture* → `stockTheorique` = 13705.50, `stockPhysique` = 13556.30, `ecartNet` = -149.20, `demarque` = 1.34

#### Variation des stocks (inventaire intermittent)

`POST /api/calc/stocks/variation-stocks` — version 1.0.0

Calcule la variation des stocks de marchandises, de matières et de produits à la clôture, et génère les écritures d’annulation du stock initial et de constatation du stock final.

```text
Variation achats (603) = SI − SF ; variation production (713) = SF − SI
```

**Entrées**

- `marchandisesSI` (montant) — Marchandises — stock initial — défaut : `42000`
- `marchandisesSF` (montant) — Marchandises — stock final — défaut : `47500`
- `matieresSI` (montant) — Matières premières — stock initial — défaut : `18000`
- `matieresSF` (montant) — Matières premières — stock final — défaut : `15200`
- `produitsSI` (montant) — Produits finis — stock initial — défaut : `26000`
- `produitsSF` (montant) — Produits finis — stock final — défaut : `31000`

**Références**

- PCG art. 946-60 et 947-71 — comptes 603 et 713

**Exemples vérifiés par les tests**

- *Clôture* → `variation6037` = -5500.00, `variation6031` = 2800.00, `variation713` = 5000.00

## <a id="consolidation"></a>Consolidation & international

Périmètre, pourcentages d’intérêt, goodwill, éliminations, conversion, couverture de change.

### Périmètre

#### Pourcentages de contrôle et d’intérêt, méthode de consolidation

`POST /api/calc/consolidation/perimetre` — version 1.0.0

À partir de l’organigramme des participations (y compris détentions indirectes et croisées), calcule pour chaque société le pourcentage d’intérêt (produit des chaînes de détention), le pourcentage de contrôle (droits détenus par la mère et les sociétés qu’elle contrôle) et la méthode de consolidation.

```text
Intérêt : I(X) = Σ I(h) × p(h → X) ; contrôle : C(X) = Σ p(h → X) pour h = mère ou contrôlée ; méthode : > 50 % IG, 20-50 % ME
```

**Entrées**

- `mere` (texte) — Société consolidante — défaut : `Mère`
- `participations` (table) — Participations (droits de vote = capital)

**Références**

- Règlement ANC n° 2020-01 relatif aux comptes consolidés
- Code de commerce art. L.233-16 — contrôle exclusif, conjoint, influence notable

**Exemples vérifiés par les tests**

- *Groupe à 5 filiales* → `interet_A` = 80.00, `interet_B` = 50.00, `controle_B` = 55.00, `interet_C` = 48.00, `interet_D` = 45.00, `controle_D` = 90.00

### Retraitements

#### Écart d’acquisition (goodwill)

`POST /api/calc/consolidation/ecart-acquisition` — version 1.0.0

Détermine l’actif net réévalué de la cible (écarts d’évaluation nets d’impôts différés), puis l’écart d’acquisition selon la méthode du goodwill partiel ou complet, et les intérêts minoritaires.

```text
ANR = CP + écarts d’évaluation × (1 − t) ; GW partiel = prix − % × ANR ; GW complet = prix + JV des minoritaires − ANR
```

**Entrées**

- `prix` (montant) — Coût d’acquisition des titres — défaut : `9500000`
- `pourcentage` (taux) — Pourcentage acquis — défaut : `80`
- `capitauxPropres` (montant) — Capitaux propres comptables de la cible — défaut : `7200000`
- `ecartsEvaluation` (montant) — Écarts d’évaluation (juste valeur − valeur comptable) — défaut : `1600000`
- `tauxIs` (taux) — Taux d’impôt différé — défaut : `25`
- `methode` (choix) — Méthode — défaut : `partiel`
- `jvMinoritaires` (montant) — Juste valeur des intérêts minoritaires — défaut : `2300000`

**Références**

- Règlement ANC n° 2020-01 relatif aux comptes consolidés
- ANC 2020-01, art. 231-1 et s. ; IFRS 3 — regroupements d’entreprises

**Exemples vérifiés par les tests**

- *Partiel* → `anr` = 8400000.00, `goodwill` = 2780000.00, `minoritaires` = 1680000.00
- *Complet* → `goodwill` = 3400000.00, `minoritaires` = 2300000.00

#### Élimination des titres et partage des capitaux propres

`POST /api/calc/consolidation/partage-capitaux-propres` — version 1.0.0

Élimine les titres de la filiale contre sa quote-part de capitaux propres, calcule les réserves consolidées, le résultat part du groupe et les intérêts minoritaires (intégration globale).

```text
Réserves groupe = % × (capital + réserves) − titres − écart d’acquisition ; résultat groupe = % × résultat ; minoritaires = (1 − %) × CP
```

**Entrées**

- `capital` (montant) — Capital de la filiale — défaut : `1000000`
- `reserves` (montant) — Réserves de la filiale — défaut : `2600000`
- `resultat` (montant) — Résultat de la filiale — défaut : `450000`
- `interet` (taux) — Pourcentage d’intérêt — défaut : `75`
- `titres` (montant) — Valeur des titres chez la mère — défaut : `2400000`
- `goodwill` (montant) — Écart d’acquisition — défaut : `0`

**Références**

- Règlement ANC n° 2020-01 relatif aux comptes consolidés

**Exemples vérifiés par les tests**

- *Filiale à 75 %* → `reservesGroupe` = 300000.00, `resultatGroupe` = 337500.00, `minoritaires` = 1012500.00

#### Impôts différés

`POST /api/calc/consolidation/impots-differes` — version 1.0.0

Calcule les impôts différés actifs et passifs sur les différences temporaires entre valeurs comptables et bases fiscales, et sur les déficits reportables.

```text
Actif : VC > base fiscale → IDP ; passif : VC > base fiscale → IDA ; ID = différence × taux ; IDA déficits = déficit × taux (si récupérable)
```

**Entrées**

- `elements` (table) — Éléments
- `deficits` (montant) — Déficits fiscaux reportables — défaut : `0`
- `deficitsRecuperables` (booleen) — Récupération des déficits probable — défaut : `false`
- `taux` (taux) — Taux d’impôt applicable au dénouement — défaut : `25`

**Références**

- Règlement ANC n° 2020-01 relatif aux comptes consolidés
- ANC 2020-01, art. 272-9 et s. — impôts différés (méthode du report variable)
- IAS 12

**Exemples vérifiés par les tests**

- *Retraitements* → `ida` = 58750.00, `idp` = 145000.00, `net` = -86250.00

### Éliminations

#### Élimination des marges internes en stock

`POST /api/calc/consolidation/marges-internes` — version 1.0.0

Élimine la marge réalisée par une société du groupe sur des biens encore en stock chez une autre, constate l’impôt différé actif et répartit l’impact entre groupe et minoritaires.

```text
Marge = stock d’origine interne × taux de marge (sur prix de vente) ; IDA = marge × t ; impact net = marge × (1 − t), réparti selon le % d’intérêt du vendeur
```

**Entrées**

- `stockInterne` (montant) — Stock acheté à une société du groupe (prix de cession) — défaut : `480000`
- `tauxMarge` (taux) — Taux de marge du vendeur sur prix de vente — défaut : `25`
- `tauxIs` (taux) — Taux d’impôt différé — défaut : `25`
- `interetVendeur` (taux) — Pourcentage d’intérêt dans la société venderesse — défaut : `80`

**Références**

- Règlement ANC n° 2020-01 relatif aux comptes consolidés
- ANC 2020-01, art. 272-1 — élimination des résultats internes

**Exemples vérifiés par les tests**

- *Filiale vendeuse à 80 %* → `marge` = 120000.00, `ida` = 30000.00, `impactNet` = 90000.00, `partGroupe` = 72000.00, `partMinoritaires` = 18000.00

#### Rapprochement et élimination des comptes réciproques

`POST /api/calc/consolidation/comptes-reciproques` — version 1.0.0

Rapproche les soldes réciproques entre sociétés du groupe (créances/dettes, ventes/achats, produits/charges financiers), identifie les écarts à analyser et le montant éliminé.

```text
Écart = montant chez A − montant chez B ; élimination = montant chez A après ajustement des écarts
```

**Entrées**

- `soldes` (table) — Soldes réciproques
- `seuil` (montant) — Seuil de signification des écarts — défaut : `1000`

**Références**

- Règlement ANC n° 2020-01 relatif aux comptes consolidés
- ANC 2020-01, art. 272-1 — opérations réciproques

**Exemples vérifiés par les tests**

- *Rapprochement annuel* → `totalElimine` = 2558000.00, `ecartTotal` = 24500.00, `ecartsSignificatifs` = 1

### International

#### Conversion des comptes d’une filiale étrangère

`POST /api/calc/consolidation/conversion-comptes` — version 1.0.0

Méthode du cours de clôture : actifs et passifs au cours de clôture, capitaux propres au cours historique, résultat au cours moyen ; détermine l’écart de conversion et son partage.

```text
Écart de conversion = actif net × cours de clôture − (CP historiques en € + résultat × cours moyen)
```

**Entrées**

- `devise` (texte) — Devise — défaut : `USD`
- `actif` (montant) — Total actif (devise) — défaut : `12500000`
- `dettes` (montant) — Total dettes (devise) — défaut : `7300000`
- `resultat` (montant) — Résultat de l’exercice (devise) — défaut : `600000`
- `cpHistoriquesEuro` (montant) — Capitaux propres hors résultat convertis aux cours historiques (€) — défaut : `4350000`
- `coursCloture` (nombre) — Cours de clôture (1 devise = … €) — défaut : `0.9050`
- `coursMoyen` (nombre) — Cours moyen de l’exercice — défaut : `0.9240`
- `interet` (taux) — Pourcentage d’intérêt — défaut : `100`

**Références**

- Règlement ANC n° 2020-01 relatif aux comptes consolidés
- ANC 2020-01, art. 272-6 et s. — conversion des comptes des entités étrangères
- IAS 21

**Exemples vérifiés par les tests**

- *Filiale américaine* → `actifNetEuro` = 4706000.00, `resultatEuro` = 554400.00, `ecartConversion` = -198400.00

#### Couverture de change à terme

`POST /api/calc/consolidation/couverture-terme` — version 1.0.0

Cours à terme par parité des taux d’intérêt, report ou déport, montant en euros garanti et résultat de la couverture comparé à une position non couverte.

```text
Cours à terme = spot × (1 + r€ × j/360) / (1 + rdevise × j/360) ; report si > spot, déport sinon
```

**Entrées**

- `montantDevise` (montant) — Montant en devise — défaut : `500000`
- `sens` (choix) — Opération — défaut : `vente`
- `spot` (nombre) — Cours au comptant (1 devise = … €) — défaut : `0.9200`
- `tauxEuro` (taux) — Taux d’intérêt euro — défaut : `3.25`
- `tauxDevise` (taux) — Taux d’intérêt de la devise — défaut : `4.75`
- `jours` (nombre) — Durée (jours) — défaut : `90`
- `spotEcheance` (nombre) — Cours au comptant constaté à l’échéance (scénario) — défaut : `0.8950`

**Références**

- Parité couverte des taux d’intérêt
- PCG art. 628-1 et s. — opérations de couverture

**Exemples vérifiés par les tests**

- *Export USD 90 j* → `coursTerme` = 0.916590, `montantGaranti` = 458295.24, `resultatCouverture` = 10795.24

#### Option de change (Garman-Kohlhagen)

`POST /api/calc/consolidation/option-change` — version 1.0.0

Prime théorique d’une option de change européenne (call ou put) selon le modèle de Garman-Kohlhagen, avec les sensibilités delta et le cours plancher/plafond garanti.

```text
d1 = [ln(S/K) + (rd − rf + σ²/2) T] / (σ √T) ; call = S e^(−rf T) N(d1) − K e^(−rd T) N(d2) ; put = K e^(−rd T) N(−d2) − S e^(−rf T) N(−d1)
```

**Entrées**

- `type` (choix) — Type d’option — défaut : `put`
- `montantDevise` (montant) — Nominal en devise — défaut : `500000`
- `spot` (nombre) — Cours au comptant S (1 devise = … €) — défaut : `0.9200`
- `strike` (nombre) — Prix d’exercice K — défaut : `0.9100`
- `maturite` (nombre) — Maturité (années) — défaut : `0.25`
- `tauxEuro` (taux) — Taux sans risque euro (continu) — défaut : `3.2`
- `tauxDevise` (taux) — Taux sans risque devise (continu) — défaut : `4.7`
- `volatilite` (taux) — Volatilité annuelle — défaut : `8`

**Références**

- Garman & Kohlhagen (1983), « Foreign currency option values »

**Exemples vérifiés par les tests**

- *Put 3 mois* → `primeUnitaire` = 0.011437, `primeTotale` = 5718.40

## <a id="sectoriels"></a>Secteurs particuliers

BTP, immobilier, agriculture, associations, professions libérales, banque et assurance.

### BTP

#### BTP : contrat à l’avancement et perte à terminaison

`POST /api/calc/sectoriels/avancement-chantier` — version 1.0.0

Méthode à l’avancement des contrats à long terme : pourcentage d’avancement par les coûts, chiffre d’affaires et marge de l’exercice, provision pour perte à terminaison.

```text
% = coûts engagés / coûts totaux estimés ; CA cumulé = prix × % ; CA exercice = CA cumulé − CA antérieur ; perte à terminaison provisionnée intégralement
```

**Entrées**

- `prixContrat` (montant) — Prix du contrat HT (avenants inclus) — défaut : `2400000`
- `coutsEngages` (montant) — Coûts engagés cumulés à la clôture — défaut : `1320000`
- `coutsRestants` (montant) — Coûts restant à engager (estimation) — défaut : `880000`
- `caAnterieur` (montant) — CA déjà comptabilisé sur les exercices antérieurs — défaut : `600000`
- `margeAnterieure` (montant) — Marge déjà constatée sur les exercices antérieurs — défaut : `50000`
- `facture` (montant) — Facturation cumulée (situations émises) — défaut : `1500000`

**Références**

- PCG art. 622-1 à 622-7 — contrats à long terme (méthode préférentielle à l’avancement)
- CGI art. 38-2 bis — rattachement des produits

**Exemples vérifiés par les tests**

- *Chantier bénéficiaire* → `avancement` = 60.00, `caCumule` = 1440000.00, `caExercice` = 840000.00, `margeExercice` = 70000.00, `fae` = 0.00, `pca` = 60000.00
- *Chantier déficitaire* → `margePrevisionnelle` = -120000.00, `provisionPerte` = 57142.86

#### BTP : situation de travaux et retenue de garantie

`POST /api/calc/sectoriels/situation-travaux` — version 1.0.0

Montant de la situation mensuelle à partir de l’avancement cumulé, TVA (ou autoliquidation du sous-traitant), retenue de garantie de 5 % et net à payer.

```text
Situation HT = marché × avancement cumulé − situations antérieures ; retenue = 5 % × TTC (sauf caution) ; net = TTC − retenue − remboursement d’avance
```

**Entrées**

- `marche` (montant) — Montant du marché HT — défaut : `850000`
- `avancementCumule` (taux) — Avancement cumulé — défaut : `45`
- `situationsAnterieures` (montant) — Situations antérieures cumulées HT — défaut : `255000`
- `tva` (taux) — Taux de TVA — défaut : `20`
- `autoliquidation` (booleen) — Sous-traitant (autoliquidation) — défaut : `false`
- `caution` (booleen) — Retenue remplacée par une caution bancaire — défaut : `false`
- `tauxRetenue` (taux) — Taux de retenue de garantie — défaut : `5`
- `remboursementAvance` (montant) — Remboursement de l’avance forfaitaire — défaut : `0`

**Références**

- Loi n° 71-584 du 16/07/1971 — retenue de garantie limitée à 5 %
- CGI art. 283-2 nonies — autoliquidation en sous-traitance BTP
- CGI art. 279-0 bis — TVA à 10 % (travaux de rénovation)

**Exemples vérifiés par les tests**

- *Situation n° 4* → `situationHT` = 127500.00, `tva` = 25500.00, `ttc` = 153000.00, `retenue` = 7650.00, `netAPayer` = 145350.00

#### BTP : compte prorata

`POST /api/calc/sectoriels/compte-prorata` — version 1.0.0

Répartit les dépenses communes de chantier entre les entreprises au prorata de leur marché, au centime près, et compare aux provisions versées.

```text
Part = dépenses communes × marché de l’entreprise / Σ marchés ; solde = part − provisions versées
```

**Entrées**

- `depensesCommunes` (montant) — Dépenses communes à répartir — défaut : `38500`
- `entreprises` (table) — Entreprises

**Références**

- Norme NF P 03-001 — cahier des clauses administratives générales (compte prorata)

**Exemples vérifiés par les tests**

- *Quatre lots* → `part_1` = 23590.69, `part_2` = 6039.22, `part_3` = 5284.31, `part_4` = 3585.78

### Immobilier

#### VEFA : échéancier des appels de fonds

`POST /api/calc/sectoriels/vefa` — version 1.0.0

Montant maximal cumulé exigible de l’acquéreur selon le stade d’avancement (secteur protégé), déjà appelé et à appeler.

```text
Appel cumulé ≤ prix × plafond du stade (35 % fondations, 70 % hors d’eau, 95 % achèvement) ; à appeler = plafond × prix − déjà appelé
```

**Entrées**

- `prix` (montant) — Prix de vente TTC — défaut : `385000`
- `stade` (choix) — Stade atteint — défaut : `reservation`
- `dejaAppele` (montant) — Montant déjà appelé — défaut : `19250`

**Références**

- Code de la construction et de l’habitation art. R.261-14 — échelonnement des paiements
- CCH art. R.261-28 — dépôt de garantie (5 % maximum)

**Exemples vérifiés par les tests**

- *Hors d’eau* → `plafond` = 269500.00, `aAppeler` = 134750.00

#### Promotion immobilière : résultat à l’avancement par programme

`POST /api/calc/sectoriels/promotion-immobiliere` — version 1.0.0

Résultat d’un programme vendu en VEFA : avancement technique (coûts), avancement commercial (lots vendus), chiffre d’affaires et marge dégagés, stock d’encours.

```text
CA = prix des lots vendus × avancement technique ; coût des ventes = coûts totaux × % commercialisé × avancement ; stock = coûts engagés − coût des ventes
```

**Entrées**

- `prixTotal` (montant) — Prix de vente total du programme HT — défaut : `12000000`
- `commercialisation` (taux) — Lots vendus (en % du prix total) — défaut : `65`
- `coutsEngages` (montant) — Coûts engagés (terrain inclus) — défaut : `5400000`
- `coutsTotaux` (montant) — Coûts totaux estimés — défaut : `9600000`

**Références**

- Règlement ANC 2012-05 — ventes en l’état futur d’achèvement
- PCG art. 622-1 et s.

**Exemples vérifiés par les tests**

- *Résidence de 40 lots* → `avancementTechnique` = 56.25, `ca` = 4387500.00, `coutVentes` = 3510000.00, `marge` = 877500.00, `stock` = 1890000.00

### Agriculture

#### Agriculture : remboursement forfaitaire agricole

`POST /api/calc/sectoriels/remboursement-forfaitaire-agricole` — version 1.0.0

Exploitants non assujettis à la TVA : remboursement forfaitaire calculé sur les ventes de produits agricoles à des assujettis.

```text
RFA = ventes éligibles × taux (5,59 % ou 4,43 % selon les produits)
```

**Entrées**

- `ventesTaux1` (montant) — Ventes de lait, animaux de boucherie et de basse-cour, œufs (4,43 %) — défaut : `62000`
- `ventesTaux2` (montant) — Ventes des autres produits (5,59 %) — défaut : `48000`

**Références**

- CGI art. 298 quater — remboursement forfaitaire agricole

**Exemples vérifiés par les tests**

- *Polyculture-élevage* → `remboursement` = 5429.80

#### Subvention d’investissement (PAC, collectivités) : reprise au résultat

`POST /api/calc/sectoriels/subvention-investissement` — version 1.0.0

Étale la subvention d’investissement au rythme de l’amortissement du bien financé : quote-part annuelle virée au résultat, solde au bilan.

```text
Quote-part = subvention × dotation de l’exercice / base amortissable
```

**Entrées**

- `subvention` (montant) — Subvention reçue — défaut : `45000`
- `valeurBien` (montant) — Valeur du bien financé — défaut : `150000`
- `dotations` (liste) — Dotations aux amortissements par exercice

**Références**

- PCG art. 312-1 et 941-13 — subventions d’investissement (131, 139, 777)
- CGI art. 42 septies — étalement fiscal

**Exemples vérifiés par les tests**

- *Bâtiment d’élevage* → `quotePart1` = 4500.00, `totalRepris` = 45000.00

### Associations

#### Associations : fonds dédiés

`POST /api/calc/sectoriels/fonds-dedies` — version 1.0.0

Constate en fonds dédiés la part des ressources affectées (subventions, dons) non encore utilisée conformément à l’engagement, et reprend les fonds antérieurs utilisés.

```text
Dotation (689) = ressources affectées de l’exercice − emplois de l’exercice sur ces ressources ; reprise (789) = utilisation des fonds dédiés antérieurs
```

**Entrées**

- `fondsAnterieurs` (montant) — Fonds dédiés à l’ouverture — défaut : `18000`
- `ressources` (montant) — Ressources affectées reçues sur l’exercice — défaut : `60000`
- `emplois` (montant) — Emplois réalisés sur l’exercice au titre du projet — défaut : `52000`

**Références**

- Règlement ANC n° 2018-06, art. 132-1 à 132-6 — fonds dédiés

**Exemples vérifiés par les tests**

- *Projet sous-consommé* → `dotation` = 8000.00, `reprise` = 0.00, `fondsCloture` = 8000.00
- *Utilisation des fonds antérieurs* → `dotation` = 0.00, `reprise` = 10000.00, `fondsCloture` = 8000.00

#### Associations : réduction d’impôt des donateurs

`POST /api/calc/sectoriels/reduction-dons` — version 1.0.0

Réduction d’impôt du mécénat d’entreprise (60 %, 40 % au-delà de 2 M€, plafond 20 000 € ou 5 ‰ du CA) ou des dons des particuliers (66 % / 75 %, plafond 20 % du revenu imposable).

```text
Entreprise : 60 % × min(don ; 2 M€) + 40 % × excédent, dans la limite de max(20 000 € ; 5 ‰ CA) ; particulier : 75 % jusqu’à 1 000 € (aide aux personnes) + 66 % du reste, dans la limite de 20 % du revenu
```

**Entrées**

- `dateOperation` (date) — Date du don — défaut : `2024-11-30`
- `donateur` (choix) — Donateur — défaut : `entreprise`
- `don` (montant) — Montant du don — défaut : `35000`
- `ca` (montant) — CA HT de l’entreprise — défaut : `9000000`
- `aidePersonnes` (booleen) — Organisme d’aide aux personnes en difficulté — défaut : `false`
- `revenuImposable` (montant) — Revenu imposable du foyer — défaut : `58000`

**Références**

- CGI art. 238 bis — mécénat des entreprises
- CGI art. 200 — dons des particuliers

**Barèmes** : `sectoriels.mecenat`

**Exemples vérifiés par les tests**

- *Entreprise* → `reduction` = 21000.00, `report` = 0.00
- *Particulier* → `reduction` = 1080.00

### Professions libérales

#### Professions libérales : résultat BNC (2035)

`POST /api/calc/sectoriels/bnc-2035` — version 1.0.0

Détermine le bénéfice non commercial en comptabilité recettes-dépenses (déclaration contrôlée) et le compare au régime micro-BNC.

```text
Bénéfice = recettes encaissées − débours et rétrocessions − dépenses payées − dotations aux amortissements ± plus/moins-values
```

**Entrées**

- `recettes` (montant) — Recettes encaissées (honoraires) — défaut : `142000`
- `debours` (montant) — Débours et honoraires rétrocédés — défaut : `6000`
- `achats` (montant) — Achats — défaut : `3200`
- `personnel` (montant) — Salaires et charges sociales du personnel — défaut : `28000`
- `cotisationsPersonnelles` (montant) — Cotisations sociales personnelles obligatoires — défaut : `24500`
- `loyers` (montant) — Loyers et charges locatives — défaut : `14400`
- `deplacements` (montant) — Frais de déplacement — défaut : `4800`
- `autresDepenses` (montant) — Autres dépenses — défaut : `9100`
- `amortissements` (montant) — Dotations aux amortissements — défaut : `3500`
- `plusValues` (montant) — Plus-values (+) ou moins-values (−) de cession — défaut : `0`

**Références**

- CGI art. 92 et 93 — bénéfices non commerciaux
- Formulaire 2035-SD
- CGI art. 102 ter — micro-BNC (abattement 34 %)

**Exemples vérifiés par les tests**

- *Cabinet libéral* → `benefice` = 48500.00, `microBnc` = 93720.00

#### Micro-entreprise : cotisations et revenu imposable

`POST /api/calc/sectoriels/micro-entreprise` — version 1.0.0

Cotisations sociales, contribution à la formation, versement libératoire éventuel, abattement forfaitaire et revenu imposable ; contrôle du seuil de chiffre d’affaires.

```text
Cotisations = CA × taux ; revenu imposable = CA × (1 − abattement), abattement ≥ 305 € ; versement libératoire = CA × taux
```

**Entrées**

- `dateOperation` (date) — Période (date) — défaut : `2024-12-31`
- `activite` (choix) — Activité — défaut : `vente`
- `ca` (montant) — Chiffre d’affaires / recettes — défaut : `52000`
- `versementLiberatoire` (booleen) — Option pour le versement libératoire de l’IR — défaut : `false`

**Références**

- CGI art. 50-0 (micro-BIC), 102 ter (micro-BNC), 151-0 (versement libératoire)
- CSS art. L.613-7 — régime micro-social

**Barèmes** : `sectoriels.micro`

**Exemples vérifiés par les tests**

- *Services BIC 2024* → `cotisations` = 11024.00, `cfp` = 156.00, `revenuImposable` = 26000.00

### Banque et assurance

#### Assurance : provisions pour sinistres (Chain Ladder)

`POST /api/calc/sectoriels/chain-ladder` — version 1.0.0

Estime la charge ultime et la provision pour sinistres à payer à partir d’un triangle de règlements cumulés, par la méthode des cadences (Chain Ladder).

```text
f_j = Σ C(i, j+1) / Σ C(i, j) ; ultime_i = C(i, dernier) × Π f_j restants ; provision = Σ (ultime − payé)
```

**Entrées**

- `triangle` (table) — Triangle des règlements cumulés

**Références**

- Code des assurances art. R.343-7 — provisions techniques
- Mack (1993) — méthode Chain Ladder

**Exemples vérifiés par les tests**

- *Triangle 5 × 5* → `provision` = 5905.97, `facteur_1` = 1.5986

#### Banque : ratios de solvabilité et de levier (Bâle III)

`POST /api/calc/sectoriels/ratios-prudentiels` — version 1.0.0

Ratios CET1, Tier 1, solvabilité globale et levier rapportés aux exigences minimales (pilier 1 et coussin de conservation).

```text
CET1 = CET1 / RWA (≥ 4,5 % + 2,5 %) ; T1 = (CET1 + AT1) / RWA (≥ 6 % + 2,5 %) ; global = fonds propres / RWA (≥ 8 % + 2,5 %) ; levier = T1 / exposition (≥ 3 %)
```

**Entrées**

- `cet1` (montant) — Fonds propres de base de catégorie 1 (CET1) — défaut : `1250000000`
- `at1` (montant) — Fonds propres additionnels de catégorie 1 (AT1) — défaut : `200000000`
- `t2` (montant) — Fonds propres de catégorie 2 (T2) — défaut : `300000000`
- `rwa` (montant) — Actifs pondérés par les risques (RWA) — défaut : `9800000000`
- `exposition` (montant) — Exposition totale (ratio de levier) — défaut : `32000000000`
- `coussinsSupplementaires` (taux) — Coussins contracyclique / systémique — défaut : `1`

**Références**

- Règlement (UE) n° 575/2013 (CRR), art. 92 et 429
- Directive 2013/36/UE (CRD), art. 129 — coussin de conservation

**Exemples vérifiés par les tests**

- *Banque régionale* → `ratioCet1` = 12.76, `ratioT1` = 14.80, `ratioGlobal` = 17.86, `ratioLevier` = 4.53
