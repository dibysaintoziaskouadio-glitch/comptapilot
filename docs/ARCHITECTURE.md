# Architecture de Comptapilot

Ce document décrit comment le code est organisé et pourquoi. Il s'adresse aux développeurs qui reprennent ou étendent le projet. Pour l'installation, voir le [README](../README.md) ; pour le détail de chaque formule, voir [FORMULES.md](FORMULES.md) et [BAREMES.md](BAREMES.md), générés depuis le code.

## Vue d'ensemble

```
┌────────────────────────┐   HTTP /api    ┌───────────────────────────┐   Prisma   ┌──────────────┐
│ frontend (React, Vite) │ ─────────────▶ │ backend (Express 5)       │ ─────────▶ │ PostgreSQL   │
│ formulaires générés    │ ◀───────────── │ auth, journal, barèmes    │            │ utilisateurs │
│ depuis le catalogue    │   JSON         │                           │            │ calculs      │
└────────────────────────┘                │   ┌─────────────────────┐ │            │ barèmes      │
                                          │   │ @compta/moteurs     │ │            │ audit        │
                                          │   │ (bibliothèque pure) │ │            └──────────────┘
                                          │   └─────────────────────┘ │
                                          └───────────────────────────┘
```

Trois paquets dans un monorepo npm (workspaces) :

| Paquet | Rôle | Dépend de |
|---|---|---|
| `moteurs` (`@compta/moteurs`) | Toutes les formules. Fonctions pures, sans entrée/sortie, sans base, sans HTTP. | `decimal.js` uniquement |
| `backend` (`@compta/backend`) | Expose le moteur en REST, authentifie, archive les calculs, historise les barèmes. | `@compta/moteurs` compilé (`moteurs/dist`) |
| `frontend` (`@compta/frontend`) | Interface. Ne contient **aucun calcul** : elle affiche ce que renvoie l'API. | types de `@compta/moteurs` seulement |

**Principe directeur : le calcul n'existe qu'à un endroit.** Le frontend ne connaît ni les taux ni les formules ; il construit ses formulaires à partir du catalogue renvoyé par l'API. Ajouter une formule au moteur suffit à la rendre disponible dans l'interface, la documentation, les tests et les benchmarks.

## Le moteur

### Arborescence

```
moteurs/src/
  noyau/
    decimal.ts     Decimal (28 chiffres, ROUND_HALF_UP), d(), arrondis comptable/bancaire/fiscal, somme, pct
    dates.ts       dates ISO sans fuseau, jours fériés, 30/360, ancienneté, prorata
    format.ts      affichage français (1 234,56 €, 20 %)
    baremes.ts     registre versionné, résolution par date, obsolescence
    contexte.ts    Contexte : collecte résultats, étapes, contrôles, tableaux, écritures, barèmes
    formule.ts     déclaration, validation des entrées, exécution
    champs.ts      fabriques de champs (montant, taux, date, choix, table…)
    registre.ts    liste des 13 moteurs, enregistrement et catalogue
    finance.ts     VAN, TRI, annuités, dichotomie
    maths.ts       statistiques, loi normale, systèmes linéaires, générateur pseudo-aléatoire
  calculs-base/ calculs-tva/ … calculs-sectoriels/   un dossier par moteur
  index.ts         enregistre toutes les formules et réexporte le noyau
```

### Une formule

Une formule est un objet déclaratif : métadonnées, champs d'entrée, exemples vérifiés et une fonction `calculer`.

```ts
export const variation = formule({
  id: 'variation',
  moteur: 'base',
  nom: 'Variation, écart et coefficient multiplicateur',
  categorie: 'Pourcentages',
  description: "Calcule l'écart absolu, la variation en pourcentage, …",
  expression: 'Variation = (Vf − Vi) / |Vi| ; CM = Vf / Vi ; réciproque = Vi / Vf − 1',
  references: [{ texte: 'Mathématiques financières — taux de variation' }],
  champs: [nombre('initiale', 'Valeur initiale', { defaut: '80000' }), nombre('finale', 'Valeur finale', { defaut: '92000' })],
  exemples: [
    { titre: 'Hausse de CA', entrees: {}, attendu: { ecart: '12000', variation: '15.00', coefficient: '1.150000', reciproque: '-13.04' } },
  ],
  calculer(e, c) {
    const vi: Decimal = e.initiale;
    const vf: Decimal = e.finale;
    c.calc('ecart', 'Écart absolu', `${fr(vf)} − ${fr(vi)}`, vf.minus(vi), 'nombre');
    if (vi.isZero()) return c.ctrl('erreur', 'BASE_NULLE', 'Valeur initiale nulle : variation non définie.');
    c.calc('variation', 'Variation relative', `(${fr(vf)} − ${fr(vi)}) / |${fr(vi)}|`, vf.minus(vi).div(vi.abs()), '%', { principal: true });
    // …
  },
});
```

`calculer` ne renvoie rien : il décrit le calcul au `Contexte`, qui produit le résultat traçable.

### Cycle d'exécution

`executerFormule(f, entreesBrutes)` ([formule.ts](../moteurs/src/noyau/formule.ts)) :

1. **Validation et conversion** (`parserEntrees`). Chaque champ est lu selon son type : montants et nombres en `Decimal` (la virgule française et les espaces sont acceptés), taux saisis en % convertis en fraction, dates contrôlées, listes et tables validées ligne par ligne. Les champs masqués par `visibleSi` sont ignorés. Toute anomalie lève une `ErreurEntree` qui porte le message **par champ** (renvoyée en 422 par l'API et affichée sous le champ concerné).
2. **Calcul** dans un `Contexte` neuf. Une `ErreurCalcul` signale une impossibilité métier (barème absent à la date, combinaison incohérente) ; toute autre exception est un bogue.
3. **Contrôle final** : si aucun contrôle n'est en erreur ou en avertissement, un contrôle `COHERENCE` positif est ajouté.
4. **Sérialisation** : les valeurs deviennent des chaînes décimales (2 décimales pour les euros, pourcentages ×100, 6 décimales par défaut), jamais des nombres JSON.

Le résultat (`ResultatCalcul`) contient : `formule` (id, version, expression), `entrees` normalisées, `resultats`, `etapes`, `controles`, `tableaux`, `ecritures`, `references`, `baremes` utilisés et `dureeMs`.

### Le Contexte

| Méthode | Effet |
|---|---|
| `calc(cle, libelle, formule, valeur, unite, opts)` | publie un résultat **et** l'étape qui l'explique (formule avec les valeurs réelles substituées) |
| `res(cle, libelle, valeur, unite, opts)` | publie un résultat sans étape (valeur reprise ou textuelle) |
| `etape(libelle, formule, valeur)` | étape intermédiaire non publiée comme résultat |
| `ctrl(niveau, code, message)` | contrôle `ok`, `info`, `avertissement` ou `erreur` |
| `verifier(condition, code, siOk, siKo)` | contrôle conditionnel, renvoie la condition |
| `tableau(t)` | tableau de détail (échéancier, plan d'amortissement…), exportable en CSV et tracé dans l'interface |
| `ecriture(libelle, lignes, journal)` | écriture comptable ; un montant négatif passe dans la colonne opposée et **l'équilibre débit/crédit est contrôlé automatiquement** (`ECRITURE_DESEQUILIBREE` au-delà de 0,01 €) |
| `bareme(code, date)` | résout le barème en vigueur à la date et l'inscrit dans la trace avec ses alertes |

### Précision numérique

- `Decimal` est un clone de `decimal.js` configuré à **28 chiffres significatifs** et `ROUND_HALF_UP`. Aucun `number` n'intervient dans un montant.
- Les arrondis sont explicites et nommés : `euros()` au centime, `arrondiFiscal()` à l'euro (CGI art. 1657), mode bancaire, troncature, excès, plafond, plancher.
- Les répartitions (`repartition-proportionnelle`, ventilations) utilisent la méthode du plus fort reste : la somme des parts arrondies égale toujours le total.
- **Exception unique : la simulation de Monte-Carlo.** Les tirages aléatoires n'ont pas de sens à 28 chiffres et coûteraient plusieurs secondes. La boucle travaille en virgule fixe sur `BigInt` (échelle 10¹⁵) avec une table de quantiles de la loi normale ; le générateur (Mulberry32) est initialisé par une graine saisie, donc le résultat reste reproductible. Les statistiques finales repassent en `Decimal`.

### Barèmes versionnés

Un barème ([baremes.ts](../moteurs/src/noyau/baremes.ts)) est une liste de versions `{ du, au?, valeurs, source, statut, note? }`, triées par date de début. `resoudreBareme(code, date)` choisit la dernière version commencée à la date de l'opération (et non à la date du jour) : un bulletin de juin 2024 recalculé en 2026 applique les taux de 2024.

Deux alertes sont produites dans les contrôles du calcul :

- `BAREME_A_VERIFIER` : la version appliquée a le statut `a_verifier` (valeur non confirmée par un texte publié) ;
- `BAREME_OBSOLETE` : l'opération est postérieure à l'année de la dernière version d'un barème **revalorisé chaque année** (PASS, SMIC, grilles…). Un barème qui ne change que par un texte nouveau (taux de TVA, taux d'IS) est déclaré `revision: 'sur-texte'` et n'est pas signalé pour simple ancienneté.

Chaque fichier `baremes.ts` d'un moteur enregistre ses barèmes à l'import ; il doit donc être importé pour son effet de bord (`import './baremes';`), pas seulement pour ses types.

### Registre et catalogue

`registre.ts` déclare les 13 moteurs (code, nom, icône, description). `index.ts` enregistre toutes les formules au chargement ; un identifiant en double fait échouer le démarrage. `catalogue()` renvoie la description sérialisable de chaque formule (champs, exemples, barèmes utilisés), consommée par le frontend et par les générateurs de documentation.

## Le backend

```
backend/src/
  config/        env.ts (validation Zod des variables), prisma.ts, logger.ts (pino)
  middlewares/   authentification (JWT), erreurs (mapping vers HTTP), limites (débit)
  modules/
    auth/        inscription, connexion, déconnexion, session, état du premier démarrage
    calc/        catalogue et exécution /api/calc/{moteur}/{formule}
    historique/  journal des calculs, statistiques, validation, suppression
    baremes/     consultation, saisie de versions, synchronisation au démarrage
    audit.ts     journal d'audit (inscriptions, validations, saisies de barèmes)
  utils/         erreurs API, validation, empreinte SHA-256
  app.ts         assemblage Express (helmet, CORS, JSON 6 Mo, cookies, routes)
  server.ts      démarrage : connexion, synchronisation des barèmes, écoute, arrêt propre
```

### Requête de calcul

`POST /api/calc/{moteur}/{formule}` avec `{ entrees, enregistrer?, valider?, libelle? }` :

1. authentification (cookie httpOnly `compta_session` ou `Authorization: Bearer`) ;
2. limitation à 600 calculs par minute ;
3. exécution par `executer()` du moteur ;
4. empreinte SHA-256 du JSON canonique (clés triées) de `{ formule, moteur, version, entrees normalisées, resultats }`, plus la monnaie si elle n'est pas l'euro : deux calculs identiques ont la même empreinte, sur n'importe quelle instance ;
5. si `enregistrer` : insertion dans `calculs` avec le résultat complet ; un `LECTEUR` ne peut pas enregistrer ; `valider` fige le calcul.

Les erreurs sont uniformes : `{ erreur: { code, message, details? } }`. `ErreurEntree` et `ErreurCalcul` → 422, violation d'unicité → 409, ressource absente → 404.

### Modèle de données

| Table | Contenu |
|---|---|
| `utilisateurs` | e-mail, nom, mot de passe (bcrypt), rôle `ADMIN` / `COMPTABLE` / `LECTEUR`, langue et monnaie préférées |
| `calculs` | journal : formule et version, libellé, entrées, résultat complet (JSON), résultat principal (libellé, valeur, unité), monnaie de saisie, empreinte, statut `BROUILLON` / `VALIDE`, nombre d'erreurs et d'avertissements |
| `versions_baremes` | historique de chaque version (unique par code et date de début), statut, origine `BIBLIOTHEQUE` ou `SAISIE`, auteur |
| `journal_audit` | inscriptions, validations de calculs depuis l'historique, saisies de barèmes |

Le résultat complet est conservé tel qu'il a été produit : réouvrir un calcul archivé montre les taux et la version de formule de l'époque, même si le moteur a évolué depuis.

### Synchronisation des barèmes

Au démarrage (`synchroniserBaremes`) :

1. les versions livrées avec le moteur absentes de la base y sont inscrites (`BIBLIOTHEQUE`) ;
2. les versions saisies par un administrateur (`SAISIE`) sont chargées dans le moteur et priment sur la bibliothèque à date de début égale.

Une saisie via `POST /api/baremes/{code}/versions` est appliquée immédiatement au processus courant et enregistrée en base. Les valeurs doivent reprendre exactement la structure de la version précédente, ce qui empêche une saisie de casser une formule.

> **Limite actuelle :** avec plusieurs instances du backend, une saisie n'est vue des autres instances qu'à leur redémarrage. Voir la feuille de route.

### Sécurité

- Mots de passe bcrypt ; session JWT signée (`JWT_SECRET` ≥ 32 caractères) dans un cookie httpOnly `SameSite=Lax`, `Secure` si `COOKIE_SECURE=true`.
- Le premier compte créé devient administrateur ; `ALLOW_REGISTRATION=false` ferme l'inscription libre.
- `helmet`, CORS restreint à `CORS_ORIGINS`, 20 tentatives d'authentification par quart d'heure, corps JSON limité à 6 Mo (taille d'un FEC).
- Toutes les entrées passent par Zod (API) puis par la validation typée du moteur.

## Le frontend

```
frontend/src/
  lib/          client API (cookie, événement de session expirée), formats, apparence des moteurs
  hooks/        session, catalogue, statistiques, thème, debounce
  components/
    ui/         boutons, cartes, champs, onglets, dialogues… (Tailwind, jetons CSS clair/sombre)
    layout/     gabarit (barre latérale, en-tête), palette de commandes Ctrl+K
    calc/       Formulaire (généré depuis les champs), Resultats (synthèse et onglets de détail)
  pages/        connexion, tableau de bord, moteur, formule, historique, barèmes
```

- **Formulaire généré** : chaque type de champ a son composant (montant avec suffixe €, taux avec suggestions, choix en boutons segmentés ou liste, tables éditables…). `visibleSi` masque les champs sans objet.
- **Calcul en direct** : chaque modification relance le calcul après 220 ms (TanStack Query, résultat précédent conservé pendant le recalcul). Il n'existe pas de bouton « Calculer ».
- **Résultats** : cartes des résultats principaux, puis onglets *Résultats*, *Formules et étapes*, *Tableaux* (graphique et export CSV), *Écritures*, *Contrôles*, *Références*.
- **Thème** : jetons HSL dans `index.css`, classe `dark` sur `<html>`, choix mémorisé.
- **Langue et monnaie** (`lib/i18n`, `lib/devises.ts`, `lib/format.ts`) :
  - les textes de l'interface sont dans `lib/i18n/dictionnaires.ts` ; le français fait référence et TypeScript impose que l'anglais définisse les mêmes clés. `useT()` donne `t(cle, variables)`, avec pluriels selon la langue ;
  - `PreferencesProvider` lit les préférences du compte (session) ou, avant connexion, celles du navigateur, et configure le module de format avant le rendu ;
  - la monnaie ne convertit rien : symbole, position et décimales viennent d'`Intl` ; l'arrondi d'affichage est fait sur la chaîne décimale (jamais en flottant). Le symbole « € » des textes du moteur (étapes, contrôles, libellés) est remplacé par celui de la monnaie choisie ;
  - les noms et descriptions des 13 moteurs sont traduits ; le contenu des 163 formules reste en français.

## Tests et qualité

| Suite | Ce qu'elle garantit |
|---|---|
| `tests/exemples.test.ts` | chaque exemple de chaque formule reproduit ses valeurs attendues (calculées à la main ou recoupées indépendamment) ; déterminisme ; aucune écriture déséquilibrée ; < 100 ms |
| `tests/noyau.test.ts` | arrondis, dates (Pâques, bissextiles, 30/360), finance, loi normale, barèmes, validation, catalogue |
| `tests/proprietes.test.ts` | propriétés sur entrées aléatoires (fast-check) : HT/TTC réversible, répartition exacte, capital restant dû nul en fin d'emprunt, plans d'amortissement complets, conservation des stocks, équilibre de toutes les écritures |
| `tests/variantes.test.ts` | chaque option de chaque champ `choix` et `booleen` de chaque formule : pas de plantage, écritures équilibrées, déterminisme |
| `backend/tests/api.test.ts` | authentification, rôles, exécution, enregistrement, validation, historique, barèmes (base `compta_test`) |

Seuils de couverture du moteur (anti-régression) : 94 % des lignes, 91 % des instructions, 96 % des fonctions, 73 % des branches.

`npm run bench` mesure chaque exemple (15 exécutions) et vérifie à nouveau les valeurs de référence ; `npm run captures` parcourt l'interface en clair, en sombre et sur mobile, et échoue sur une erreur de console ou un débordement horizontal.

## Ajouter une formule

1. Choisir le moteur (`moteurs/src/calculs-<moteur>/`) et déclarer la formule avec `formule({ … })` : identifiant unique dans le moteur, champs avec valeurs par défaut réalistes, expression lisible, références légales précises.
2. Si elle dépend de taux qui évoluent, créer ou enrichir un barème dans le `baremes.ts` du moteur et le lire avec `c.bareme(code, e.date)` ; marquer `a_verifier` toute valeur non confirmée par un texte publié.
3. Ajouter **au moins un exemple** avec ses valeurs attendues, calculées indépendamment du code. Les tests d'exemples, de variantes, la documentation et les benchmarks la prennent en compte automatiquement.
4. Ajouter la formule à l'export du moteur (tableau `formules<Moteur>`), puis `npm test`, `npm run docs`, `npm run build:moteurs`.

L'interface l'affiche sans modification du frontend.
