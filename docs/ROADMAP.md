# Feuille de route

État au 13 octobre 2026 et suite proposée. Les étapes sont ordonnées par priorité : la première conditionne un usage en production, les suivantes élargissent le produit.

## Livré

| Domaine | Contenu |
|---|---|
| Moteur | 163 formules, 13 moteurs, 16 barèmes versionnés, `Decimal` 28 chiffres, traçabilité complète (formule, étapes, contrôles, écritures, références, barèmes) |
| Contrôles automatiques | équilibre débit/crédit de chaque écriture, cohérences TVA, équilibre balance et bilan, contrôle FEC, détection de doublons, alertes de barème à confirmer ou non à jour |
| Tests | 548 tests : exemples vérifiés, propriétés (fast-check), balayage de toutes les options ; 15 tests d'API |
| API | `/api/calc/{moteur}/{formule}`, historique par utilisateur avec empreinte SHA-256, barèmes, authentification et rôles |
| Interface | formulaires générés, calcul en direct, affichage des formules et étapes, graphiques, export CSV, historique, barèmes, palette Ctrl+K, thèmes clair et sombre, mobile |
| Exploitation | Docker Compose (PostgreSQL, API, nginx), documentation générée, benchmarks, captures automatisées |

## Étape 1 — Fiabiliser avant usage réel

Objectif : pouvoir s'appuyer sur les résultats pour un dossier client.

1. **Confirmer les barèmes « à vérifier ».** Rapprocher chaque valeur du texte publié et passer la version en `officiel` :
   - `paie.constantes` : PASS et SMIC 2026 ;
   - `paie.cotisations` : paramètres 2025 et réduction générale dégressive unique 2026, taux chômage et AGS ;
   - `paie.pas-metropole` : grilles du taux neutre 2024 et 2025 ;
   - `paie.avantages-nature` : véhicules 2025 et plafond d'abattement électrique ;
   - `paie.ijss` : plafond au 1er avril 2025 ;
   - `fiscal.cvae` : taux 2025 et trajectoire 2026 ;
   - `fiscal.taxe-salaires` : seuils 2024 et 2025 ;
   - `sectoriels.micro` : seuils et taux 2025-2026.
2. **Recouper avec les références officielles.** Comparer un jeu de cas par moteur aux simulateurs publics (URSSAF, impots.gouv) et faire relire les exemples par un expert-comptable ; consigner l'origine de chaque valeur de référence dans les exemples.
3. **Couverture à 100 % des formules critiques.** Bulletin de paie, CA3 et CA12, impôt sur les sociétés et acomptes, emprunts, plans d'amortissement : couvrir toutes les branches, y compris les refus d'entrées incohérentes. Couverture actuelle du moteur : 94,8 % des lignes, 74,2 % des branches.
4. **Compléter le journal d'audit.** Tracer aussi les connexions, les suppressions de calculs et la validation directe à l'enregistrement (`POST /api/calc` avec `valider`), aujourd'hui non journalisées.
5. **Procédure annuelle de mise à jour.** Calendrier (loi de finances et LFSS en décembre, arrêté PASS, revalorisation du SMIC), liste des barèmes concernés et contrôle que le tableau de bord n'affiche plus de barème à surveiller en début d'année.
6. **Intégration continue.** Exécuter typecheck, tests du moteur et de l'API, construction Docker et captures à chaque modification ; refuser une baisse de couverture.

## Étape 2 — Travailler par dossier

Objectif : passer du calcul isolé au dossier client.

1. **Dossiers et exercices.** Rattacher chaque calcul à une entreprise et à un exercice ; filtrer l'historique et le tableau de bord par dossier ; droits par dossier.
2. **Feuille de travail PDF.** Export d'un calcul validé avec entrées, étapes, contrôles, références, barèmes appliqués et empreinte, pour le dossier de travail ou le client.
3. **Chaînage des calculs.** Utiliser un résultat comme entrée d'une autre formule (résultat fiscal → IS → acomptes ; balance → états financiers → ratios) avec propagation automatique des modifications.
4. **Imports.** Balance et FEC depuis un fichier, tables (immobilisations, salariés, stocks) depuis un CSV, au lieu de la saisie ligne à ligne.
5. **Recalcul comparatif.** Rejouer un calcul archivé avec les barèmes actuels et afficher les écarts, pour mesurer l'effet d'une loi de finances.
6. **Administration des comptes.** Écran de gestion des utilisateurs (rôles, désactivation, réinitialisation du mot de passe) ; double authentification.

## Étape 3 — Exploitation à plus grande échelle

1. **Plusieurs instances du backend.** Propager immédiatement une saisie de barème à toutes les instances (PostgreSQL `LISTEN/NOTIFY` ou relecture à chaque calcul), aujourd'hui vue des autres instances seulement au redémarrage.
2. **Allègement du frontend.** Découper le bundle (749 kB) par route et charger les graphiques à la demande.
3. **Image backend plus légère.** 767 Mo aujourd'hui, essentiellement le client et les moteurs Prisma : image distroless ou moteur Prisma sans binaire.
4. **API pour intégrations.** Clés d'API par application, quotas, documentation OpenAPI générée depuis le catalogue.
5. **Sauvegardes et supervision.** Sauvegarde planifiée de la base, métriques (durée des calculs, erreurs 422 par formule), alertes.

## Étape 4 — Étendre le périmètre

1. **Formules en anglais et autres langues.** L'interface est traduite (français, anglais) ; le contenu des 163 formules (noms, champs, étapes, contrôles) reste en français. Le traduire suppose d'extraire ces textes du moteur dans des catalogues par langue.
2. **Monnaies et référentiels non français.** La monnaie est aujourd'hui un affichage (aucune conversion). Pour un usage OHADA (SYSCOHADA) ou d'autres pays, il faudra des barèmes et plans de comptes propres, et des calculs arrondis à l'unité monétaire (sans centime pour le franc CFA).
3. **Déclaratif.** Génération des fichiers réglementaires à partir des calculs : liasse 2033 et 2050, CA3 en EDI, éléments de DSN.
4. **Paie conventionnelle.** Barèmes et règles des principales conventions collectives (minima, primes, maintien de salaire), régimes particuliers.
5. **Consolidation complète.** Chaînage périmètre → retraitements → éliminations → états consolidés, sur plusieurs niveaux de détention.
6. **Nouveaux secteurs.** Selon les dossiers des utilisateurs : hôtellerie-restauration, transport, santé, professions réglementées.

Chaque ajout suit la même règle que l'existant : une formule n'est livrée qu'avec ses références légales, ses exemples vérifiés et ses barèmes datés.
