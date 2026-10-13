# Barèmes et taux versionnés

> Généré par `npm run docs`. Le moteur applique la version en vigueur à la date de l’opération ; une version « à vérifier » ou une date postérieure à la dernière version connue déclenche une alerte.

## TVA & taxes sur le CA

### Taux de TVA (France) — `tva.taux`

| Du | Au | Statut | Source |
|---|---|---|---|
| 2014-01-01 | — | officiel | CGI art. 278, 278 bis, 278-0 bis, 279, 281 quater, 294, 296, 297 |

### Seuils et acomptes TVA — `tva.seuils`

| Du | Au | Statut | Source |
|---|---|---|---|
| 2015-01-01 | — | officiel | CGI ann. II art. 242-0 A et 242-0 C ; CGI art. 287-3 ; arrêté du 22/12/2021 (EMEBI) |

## Amortissements

### Plafonds d’amortissement des véhicules de tourisme — `amortissement.plafonds-vp`

| Du | Au | Statut | Source |
|---|---|---|---|
| 2021-01-01 | — | officiel | CGI art. 39-4 (rédaction loi n° 2019-1479, norme WLTP) |

## Paie & cotisations

### PMSS et SMIC — `paie.constantes`

| Du | Au | Statut | Source |
|---|---|---|---|
| 2023-05-01 | — | officiel | Arrêté du 30/11/2022 (PASS 2023) ; arrêté du 26/04/2023 (SMIC) |
| 2024-01-01 | — | officiel | Arrêté du 19/12/2023 (PASS 2024) ; décret n° 2023-1216 (SMIC) |
| 2024-11-01 | — | officiel | Décret n° 2024-951 (SMIC au 01/11/2024) |
| 2025-01-01 | — | officiel | Arrêté du 19/12/2024 (PASS 2025 = 47 100 €) |
| 2026-01-01 | — | ⚠️ à vérifier | PASS 2026 = 48 060 € ; revalorisation du SMIC au 01/01/2026 — valeurs 2026 à confirmer (arrêté PASS, décret SMIC) |

### Taux de cotisations sociales (régime général) — `paie.cotisations`

| Du | Au | Statut | Source |
|---|---|---|---|
| 2024-01-01 | — | officiel | CSS art. D.242-3 et s. ; ANI AGIRC-ARRCO du 17/11/2017 ; Unédic ; CSS art. D.241-7 (réduction générale) |
| 2025-01-01 | — | ⚠️ à vérifier | LFSS 2025 (bandeaux maladie 2,25 SMIC et famille 3,3 SMIC) ; AGS ; décret réduction générale 2025 — taux AGS et paramètre T 2025 à confirmer |
| 2025-05-01 | — | ⚠️ à vérifier | Convention d’assurance chômage 2024 — contribution patronale ramenée à 4,00 % — taux chômage au 01/05/2025 à confirmer |
| 2026-01-01 | — | ⚠️ à vérifier | LFSS 2025 art. 18 — réduction générale dégressive unique (RGDU) à compter du 01/01/2026 — paramètres de la RGDU à confirmer par décret |

### Grille du taux neutre de prélèvement à la source (métropole) — `paie.pas-metropole`

| Du | Au | Statut | Source |
|---|---|---|---|
| 2024-01-01 | — | ⚠️ à vérifier | CGI art. 204 H ; BOI-BAREME-000037 — bornes mensuelles à confirmer avec la grille publiée |
| 2025-01-01 | — | ⚠️ à vérifier | CGI art. 204 H (loi de finances 2025) ; BOI-BAREME-000037 — bornes mensuelles à confirmer avec la grille publiée |

### Évaluation forfaitaire des avantages en nature — `paie.avantages-nature`

| Du | Au | Statut | Source |
|---|---|---|---|
| 2024-01-01 | — | officiel | Arrêté du 10/12/2002 modifié (art. 3) ; abattement VE : arrêté du 21/03/2020 |
| 2025-01-01 | — | officiel | Barème URSSAF 2025 (repas) |
| 2025-02-01 | — | ⚠️ à vérifier | Arrêté du 30/01/2025 — nouvelle évaluation des véhicules mis à disposition — taux véhicule 2025 et plafond d’abattement électrique à confirmer |

### Indemnités journalières maladie — `paie.ijss`

| Du | Au | Statut | Source |
|---|---|---|---|
| 2024-01-01 | — | officiel | CSS art. R.323-4 et R.323-9 |
| 2025-04-01 | — | ⚠️ à vérifier | Décret n° 2025-160 — plafond du revenu d’activité ramené à 1,4 SMIC — plafond 1,4 SMIC à confirmer |

## Fiscalité entreprise

### Impôt sur les sociétés — `fiscal.is`

| Du | Au | Statut | Source |
|---|---|---|---|
| 2022-01-01 | — | officiel | CGI art. 219 I (LF 2018, LF 2023 pour le plafond de 42 500 €), 235 ter ZC, 209 I, 220 quinquies, 216, 238 |

### CVAE et plafonnement de la CET — `fiscal.cvae`

| Du | Au | Statut | Source |
|---|---|---|---|
| 2023-01-01 | — | officiel | CGI art. 1586 quater et 1647 B sexies (LF 2023) |
| 2024-01-01 | — | officiel | CGI art. 1586 quater et 1647 B sexies (LF 2024) |
| 2025-01-01 | — | ⚠️ à vérifier | LF 2025 — report de la suppression de la CVAE — taux 2025 maintenu à 0,28 % — à confirmer |
| 2026-01-01 | — | ⚠️ à vérifier | LF 2025 — trajectoire 2025-2027 — taux 2026 à confirmer (loi de finances) |

### Taxe sur les salaires — `fiscal.taxe-salaires`

| Du | Au | Statut | Source |
|---|---|---|---|
| 2024-01-01 | — | ⚠️ à vérifier | CGI art. 231 et 1679 A (seuils revalorisés pour 2024) — seuils et abattement 2024 à confirmer |
| 2025-01-01 | — | ⚠️ à vérifier | CGI art. 231 et 1679 A (seuils revalorisés pour 2025) — seuils et abattement 2025 à confirmer |

### Taxes annuelles sur les véhicules de tourisme — `fiscal.tvs`

| Du | Au | Statut | Source |
|---|---|---|---|
| 2024-01-01 | — | officiel | CIBS art. L.421-119 à L.421-167 (barème WLTP 2024) |

### Taxe sur les surfaces commerciales — `fiscal.tascom`

| Du | Au | Statut | Source |
|---|---|---|---|
| 2015-01-01 | — | officiel | Loi n° 72-657 du 13/07/1972, art. 3 ; décret n° 95-85 |

### Taxes et contributions diverses — `fiscal.divers`

| Du | Au | Statut | Source |
|---|---|---|---|
| 2022-01-01 | — | officiel | CSS art. L.137-30 et s. ; C. trav. L.6131-2, L.6241-2, L.6331-1 ; CGI art. 200 A et 240 ; CIBS (spectacles) |

## Secteurs particuliers

### Réductions d’impôt pour dons — `sectoriels.mecenat`

| Du | Au | Statut | Source |
|---|---|---|---|
| 2021-01-01 | — | officiel | CGI art. 238 bis (entreprises) et art. 200 (particuliers) |

### Micro-entreprise : seuils, abattements et cotisations — `sectoriels.micro`

| Du | Au | Statut | Source |
|---|---|---|---|
| 2024-01-01 | — | officiel | CGI art. 50-0 et 102 ter ; CSS art. L.613-7 ; décret n° 2023-1236 |
| 2024-07-01 | — | ⚠️ à vérifier | Décret n° 2024-484 — BNC non réglementées (SSI) — taux BNC au 01/07/2024 |
| 2025-01-01 | — | ⚠️ à vérifier | Décret n° 2024-484 — trajectoire 2025 — taux BNC 2025 |
| 2026-01-01 | — | ⚠️ à vérifier | Décret n° 2024-484 — trajectoire 2026 — taux BNC 2026 et seuils de chiffre d’affaires |
