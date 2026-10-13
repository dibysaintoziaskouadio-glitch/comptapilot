# Benchmarks du moteur de calcul

> Généré par `npm run bench` — 205 cas, 15 exécutions chacun, Node v18.19.1.

- Médiane globale : 0.23 ms
- Cas ≥ 100 ms (médiane) : 0
- Valeurs de référence non reproduites : 0

| Cas | Médiane (ms) | Max (ms) | Référence reproduite | Origine de la référence |
|---|---:|---:|:---:|---|
| base/arrondi — Centime | 0.25 | 0.81 | ✅ | calcul manuel recoupé |
| base/arrondi — Fiscal | 0.09 | 0.74 | ✅ | calcul manuel recoupé |
| base/arrondi — Bancaire | 0.15 | 0.81 | ✅ | calcul manuel recoupé |
| base/equilibre-debit-credit — Facture équilibrée | 0.23 | 0.49 | ✅ | calcul manuel recoupé |
| base/equilibre-debit-credit — Écart de 1 centime | 0.15 | 0.22 | ✅ | calcul manuel recoupé |
| base/variation — Hausse de CA | 0.27 | 0.34 | ✅ | calcul manuel recoupé |
| base/appliquer-pourcentage — Hausse de 12 % | 0.17 | 0.42 | ✅ | calcul manuel recoupé |
| base/appliquer-pourcentage — Remise de 20 % | 0.15 | 0.23 | ✅ | calcul manuel recoupé |
| base/appliquer-pourcentage — Prix avant hausse | 0.15 | 0.18 | ✅ | calcul manuel recoupé |
| base/part-total — Mix produits | 0.44 | 0.58 | ✅ | calcul manuel recoupé |
| base/regle-de-trois — 3 kg → 45 € ; 7 kg ? | 0.10 | 0.35 | ✅ | calcul manuel recoupé |
| base/regle-de-trois — 4 ouvriers 15 j ; 6 ouvriers ? | 0.09 | 0.21 | ✅ | calcul manuel recoupé |
| base/repartition-proportionnelle — 1 000 € en trois tiers | 0.43 | 0.64 | ✅ | calcul manuel recoupé |
| base/moyenne-simple — CA mensuel | 0.66 | 1.77 | ✅ | calcul manuel recoupé |
| base/moyenne-ponderee — Prix moyen pondéré | 0.19 | 0.30 | ✅ | calcul manuel recoupé |
| base/moyenne-mobile — MM3 | 0.19 | 0.41 | ✅ | calcul manuel recoupé |
| base/conversion-devise — 15 000 USD en euros | 0.14 | 0.32 | ✅ | calcul manuel recoupé |
| base/conversion-devise — Cours moyen | 0.21 | 0.38 | ✅ | calcul manuel recoupé |
| base/ecart-de-change — Créance — gain | 0.23 | 0.44 | ✅ | calcul manuel recoupé |
| base/ecart-de-change — Dette — perte | 0.15 | 0.24 | ✅ | calcul manuel recoupé |
| base/echeance-paiement — 45 jours fin de mois | 0.11 | 0.44 | ✅ | calcul manuel recoupé |
| base/echeance-paiement — Net 30 | 0.08 | 0.19 | ✅ | calcul manuel recoupé |
| base/echeance-paiement — FDM + 45 | 0.09 | 0.11 | ✅ | calcul manuel recoupé |
| base/jours-ouvres — Mai 2025 | 1.76 | 3.97 | ✅ | calcul manuel recoupé |
| base/prorata-temporis — Loyer 15/04 → 31/12 | 0.22 | 0.52 | ✅ | calcul manuel recoupé |
| base/prorata-temporis — 30/360 | 0.16 | 0.20 | ✅ | calcul manuel recoupé |
| base/conversion-taux-periode — 6 % annuel → mensuel | 1.62 | 3.98 | ✅ | calcul manuel recoupé |
| base/penalites-retard — 45 jours de retard | 0.28 | 0.49 | ✅ | calcul manuel recoupé |
| base/detection-doublons — Deux doublons | 0.31 | 0.57 | ✅ | calcul manuel recoupé |
| tva/ht-ttc — HT → TTC à 20 % | 0.23 | 0.39 | ✅ | calcul manuel recoupé |
| tva/ht-ttc — TTC → HT à 5,5 % | 0.22 | 0.47 | ✅ | calcul manuel recoupé |
| tva/ht-ttc — TTC non rond à 20 % | 0.23 | 0.59 | ✅ | calcul manuel recoupé |
| tva/ht-ttc — TVA → HT à 10 % | 0.14 | 0.20 | ✅ | calcul manuel recoupé |
| tva/facture-multi-taux — Facture trois taux | 1.54 | 2.89 | ✅ | calcul manuel recoupé |
| tva/tva-a-payer — TVA due | 0.54 | 0.73 | ✅ | calcul manuel recoupé |
| tva/tva-a-payer — Crédit remboursable | 0.25 | 0.99 | ✅ | calcul manuel recoupé |
| tva/ca3 — Mois type | 0.66 | 3.94 | ✅ | calcul manuel recoupé |
| tva/ca12 — Exercice 2024 | 0.20 | 0.40 | ✅ | calcul manuel recoupé |
| tva/exigibilite — Encaissements | 0.32 | 0.46 | ✅ | calcul manuel recoupé |
| tva/exigibilite — Option débits | 0.27 | 0.39 | ✅ | calcul manuel recoupé |
| tva/intracommunautaire — Acquisition 12 000 € HT | 0.48 | 1.06 | ✅ | calcul manuel recoupé |
| tva/intracommunautaire — Livraison | 0.20 | 0.54 | ✅ | calcul manuel recoupé |
| tva/intracommunautaire — Acquisition, coefficient 80 % | 0.43 | 1.36 | ✅ | calcul manuel recoupé |
| tva/autoliquidation — Sous-traitance BTP | 0.41 | 0.63 | ✅ | calcul manuel recoupé |
| tva/autoliquidation — Coefficient 50 % | 0.20 | 0.93 | ✅ | calcul manuel recoupé |
| tva/tva-sur-marge — Véhicule d’occasion | 0.20 | 0.42 | ✅ | calcul manuel recoupé |
| tva/tva-sur-marge — Marge négative | 0.08 | 0.10 | ✅ | calcul manuel recoupé |
| tva/coefficient-deduction — Banque-assurance partielle | 0.24 | 0.41 | ✅ | calcul manuel recoupé |
| tva/regularisation-immobilisation — Baisse de 25 points | 0.38 | 0.61 | ✅ | calcul manuel recoupé |
| tva/regularisation-immobilisation — Cession exonérée année 3 | 0.27 | 0.67 | ✅ | calcul manuel recoupé |
| tva/regularisation-immobilisation — Cession taxée année 3 | 0.30 | 1.30 | ✅ | calcul manuel recoupé |
| tva/fnp-fae — Clôture | 0.80 | 2.85 | ✅ | calcul manuel recoupé |
| tva/obligations-echanges-ue — PME exportatrice | 0.15 | 0.95 | ✅ | calcul manuel recoupé |
| tva/tva-importation — Import 30 000 € | 0.52 | 1.07 | ✅ | calcul manuel recoupé |
| amortissements/lineaire — 24 000 € sur 5 ans, 15/04 | 1.01 | 3.83 | ✅ | calcul manuel recoupé |
| amortissements/lineaire — Année pleine | 0.70 | 0.86 | ✅ | calcul manuel recoupé |
| amortissements/degressif — Manuel BOFiP-type : 10 000 €, 5 ans, 01/04 | 0.77 | 2.20 | ✅ | Calcul manuel conforme BOI-BIC-AMT-20-20-20-20 |
| amortissements/unites-oeuvre — Machine 400 000 pièces | 0.37 | 2.53 | ✅ | calcul manuel recoupé |
| amortissements/composants — Immeuble de bureaux | 3.61 | 7.61 | ✅ | calcul manuel recoupé |
| amortissements/derogatoire — Linéaire 8 ans / dégressif 5 ans | 0.53 | 0.93 | ✅ | calcul manuel recoupé |
| amortissements/cession — Cession après 2 ans 9 mois | 0.55 | 2.50 | ✅ | calcul manuel recoupé |
| amortissements/vehicule-tourisme — Berline 128 g | 0.38 | 0.81 | ✅ | calcul manuel recoupé |
| amortissements/fonds-commercial — Option 10 ans, acquis 2024 | 0.36 | 0.50 | ✅ | calcul manuel recoupé |
| amortissements/fonds-commercial — Non amorti | 0.03 | 0.04 | ✅ | calcul manuel recoupé |
| amortissements/incorporels — Logiciel 3 ans / 12 mois fiscal | 0.39 | 0.75 | ✅ | calcul manuel recoupé |
| amortissements/credit-bail — Machine 60 000 € — 20 trimestres | 5.09 | 13.05 | ✅ | calcul manuel recoupé |
| provisions/creance-douteuse — Client en redressement | 0.21 | 0.40 | ✅ | calcul manuel recoupé |
| provisions/creance-douteuse — Ajustement à la baisse | 0.17 | 0.31 | ✅ | calcul manuel recoupé |
| provisions/provision-statistique — Balance âgée | 0.33 | 0.48 | ✅ | calcul manuel recoupé |
| provisions/depreciation-stocks — Trois articles | 0.27 | 0.75 | ✅ | calcul manuel recoupé |
| provisions/depreciation-titres — Participation dépréciée | 0.23 | 1.02 | ✅ | calcul manuel recoupé |
| provisions/ajustement-provision — Litige partiellement dénoué | 0.18 | 0.61 | ✅ | calcul manuel recoupé |
| provisions/provision-risques — Litige prud’homal | 0.30 | 1.08 | ✅ | calcul manuel recoupé |
| provisions/provision-risques — Espérance actualisée | 0.30 | 0.51 | ✅ | calcul manuel recoupé |
| provisions/provision-garantie — Électroménager | 0.19 | 0.28 | ✅ | calcul manuel recoupé |
| provisions/indemnites-retraite — Cadre de 45 ans | 0.46 | 2.00 | ✅ | calcul manuel recoupé |
| provisions/gros-entretien — Ravalement à 8 ans | 0.42 | 1.55 | ✅ | calcul manuel recoupé |
| provisions/test-depreciation — UGT industrielle | 0.67 | 2.79 | ✅ | calcul manuel recoupé |
| provisions/provision-hausse-prix — Hausse de 21 % | 0.18 | 0.27 | ✅ | calcul manuel recoupé |
| provisions/ecarts-conversion — Portefeuille trois devises | 0.21 | 0.60 | ✅ | calcul manuel recoupé |
| paie/bulletin — Non-cadre 3 200 €, juin 2024 | 2.02 | 6.06 | ✅ | calcul manuel recoupé |
| paie/bulletin — Salarié au SMIC, 2024 (réduction générale) | 1.31 | 3.79 | ✅ | Coefficient maximal T = 0,3191 (FNAL 0,10 %) au niveau du SMIC |
| paie/net-vers-brut — Net 2 500 € | 9.85 | 16.87 | ✅ | calcul manuel recoupé |
| paie/conversion-salaire — 2 400 € mensuels | 0.23 | 0.60 | ✅ | calcul manuel recoupé |
| paie/heures-supplementaires — Mois de juin | 0.48 | 0.87 | ✅ | calcul manuel recoupé |
| paie/heures-complementaires — Contrat 24 h | 0.12 | 0.19 | ✅ | calcul manuel recoupé |
| paie/avantage-vehicule — Achat 38 000 €, juin 2024 | 0.09 | 0.65 | ✅ | calcul manuel recoupé |
| paie/avantage-repas — 20 repas 2025 | 0.10 | 0.27 | ✅ | calcul manuel recoupé |
| paie/conges-payes — 12 jours pris | 0.16 | 0.34 | ✅ | calcul manuel recoupé |
| paie/indemnite-licenciement — 12 ans 9 mois 27 jours | 0.43 | 2.10 | ✅ | calcul manuel recoupé |
| paie/rupture-conventionnelle — 9 ans 2 mois 29 jours | 0.46 | 1.47 | ✅ | calcul manuel recoupé |
| paie/indemnite-precarite — CDD 6 mois | 0.28 | 0.56 | ✅ | calcul manuel recoupé |
| paie/ijss-maladie — Arrêt de 15 jours | 0.19 | 0.40 | ✅ | calcul manuel recoupé |
| paie/maintien-salaire — 60 jours, 7 ans | 0.17 | 0.34 | ✅ | calcul manuel recoupé |
| paie/activite-partielle — 42 heures | 0.23 | 0.33 | ✅ | calcul manuel recoupé |
| paie/solde-tout-compte — Départ mi-mois | 0.25 | 0.53 | ✅ | calcul manuel recoupé |
| paie/pas — Grille 2025 | 0.19 | 0.26 | ✅ | calcul manuel recoupé |
| paie/masse-salariale — TPE | 0.50 | 0.82 | ✅ | calcul manuel recoupé |
| fiscal/impot-societes — PME 186 000 € | 0.43 | 1.04 | ✅ | calcul manuel recoupé |
| fiscal/impot-societes — Grande entreprise | 0.38 | 0.44 | ✅ | calcul manuel recoupé |
| fiscal/acomptes-is — Exercice civil 2025 | 0.12 | 0.50 | ✅ | calcul manuel recoupé |
| fiscal/solde-is — Solde 2024 | 0.07 | 0.72 | ✅ | calcul manuel recoupé |
| fiscal/resultat-fiscal — PME | 0.38 | 1.84 | ✅ | calcul manuel recoupé |
| fiscal/deficits-reportables — Gros bénéfice | 0.21 | 0.28 | ✅ | calcul manuel recoupé |
| fiscal/carry-back — Déficit 450 k€ | 0.16 | 0.53 | ✅ | calcul manuel recoupé |
| fiscal/regime-mere-fille — Filiale à 35 % | 0.14 | 0.31 | ✅ | calcul manuel recoupé |
| fiscal/regime-mere-fille — Groupe intégré | 0.12 | 0.25 | ✅ | calcul manuel recoupé |
| fiscal/integration-fiscale — Groupe de 4 sociétés | 0.29 | 0.54 | ✅ | calcul manuel recoupé |
| fiscal/plus-values-is — Cession de participation | 0.12 | 0.29 | ✅ | calcul manuel recoupé |
| fiscal/plus-values-is — Brevet | 0.09 | 0.16 | ✅ | calcul manuel recoupé |
| fiscal/cfe — Commerce | 0.15 | 0.50 | ✅ | calcul manuel recoupé |
| fiscal/cvae — CA 6,5 M€ — 2024 | 0.15 | 0.30 | ✅ | calcul manuel recoupé |
| fiscal/plafonnement-cet — Dégrèvement | 0.10 | 0.27 | ✅ | calcul manuel recoupé |
| fiscal/taxe-salaires — Cabinet médical 2024 | 0.23 | 0.51 | ✅ | calcul manuel recoupé |
| fiscal/taxes-vehicules — Berline 128 g toute l’année | 0.17 | 0.45 | ✅ | calcul manuel recoupé |
| fiscal/contributions-formation — PME 18 salariés | 0.14 | 0.29 | ✅ | calcul manuel recoupé |
| fiscal/c3s — CA 42 M€ | 0.08 | 0.22 | ✅ | calcul manuel recoupé |
| fiscal/taxe-bureaux-idf — Siège social | 0.15 | 0.37 | ✅ | calcul manuel recoupé |
| fiscal/tlpe — Enseigne de 18 m² | 0.07 | 0.24 | ✅ | calcul manuel recoupé |
| fiscal/tascom — Supermarché 1 800 m² | 0.13 | 0.72 | ✅ | calcul manuel recoupé |
| fiscal/taxe-spectacles — Concert | 0.05 | 0.07 | ✅ | calcul manuel recoupé |
| fiscal/controle-fec — FEC conforme | 0.26 | 0.87 | ✅ | calcul manuel recoupé |
| fiscal/controle-fec — Écriture déséquilibrée | 0.28 | 0.42 | ✅ | calcul manuel recoupé |
| fiscal/das2 — Quatre versements | 0.11 | 0.44 | ✅ | calcul manuel recoupé |
| fiscal/ifu-dividendes — Deux associés | 0.19 | 0.42 | ✅ | calcul manuel recoupé |
| financier/etats-depuis-balance — Balance de clôture | 1.61 | 3.40 | ✅ | calcul manuel recoupé |
| financier/sig — PME industrielle et commerciale | 0.33 | 0.51 | ✅ | calcul manuel recoupé |
| financier/caf — Concordance | 0.27 | 0.48 | ✅ | calcul manuel recoupé |
| financier/bilan-fonctionnel — PME | 0.48 | 0.77 | ✅ | calcul manuel recoupé |
| financier/ratios-rentabilite — PME | 0.37 | 0.55 | ✅ | calcul manuel recoupé |
| financier/ratios-structure — PME | 0.25 | 0.40 | ✅ | calcul manuel recoupé |
| financier/ratios-liquidite — PME | 0.16 | 0.22 | ✅ | calcul manuel recoupé |
| financier/ratios-activite — PME | 0.32 | 0.67 | ✅ | calcul manuel recoupé |
| financier/ratios-boursiers — Société cotée | 0.28 | 0.45 | ✅ | calcul manuel recoupé |
| financier/leviers — PME | 0.35 | 0.93 | ✅ | calcul manuel recoupé |
| tresorerie/emprunt — 100 000 € à 4 % sur 5 ans | 6.78 | 11.56 | ✅ | Formule de l’annuité constante, vérifiable sur tout simulateur bancaire |
| tresorerie/emprunt — Amortissement constant | 6.89 | 13.04 | ✅ | calcul manuel recoupé |
| tresorerie/emprunt — Avec frais et assurance | 6.08 | 13.50 | ✅ | calcul manuel recoupé |
| tresorerie/emprunt-taux-variable — Trois paliers | 1.68 | 5.42 | ✅ | calcul manuel recoupé |
| tresorerie/agios-decouvert — Mars 2025 | 0.82 | 1.32 | ✅ | calcul manuel recoupé |
| tresorerie/escompte-dailly — Bordereau de 3 LCR | 0.65 | 1.08 | ✅ | calcul manuel recoupé |
| tresorerie/affacturage — CA cédé 1,8 M€ | 0.41 | 0.62 | ✅ | calcul manuel recoupé |
| tresorerie/budget-tresorerie — Semestre | 1.02 | 1.67 | ✅ | calcul manuel recoupé |
| tresorerie/plan-13-semaines — 13 semaines | 0.36 | 0.52 | ✅ | calcul manuel recoupé |
| tresorerie/interets-placement — Composés annuels | 0.17 | 0.42 | ✅ | calcul manuel recoupé |
| tresorerie/interets-placement — Simples | 0.07 | 0.09 | ✅ | calcul manuel recoupé |
| tresorerie/interets-placement — Valeur actuelle | 0.15 | 0.17 | ✅ | calcul manuel recoupé |
| tresorerie/rendement-obligation — Obligation 3 % à 6 ans | 1.48 | 4.61 | ✅ | calcul manuel recoupé |
| tresorerie/annuites — 500 €/mois pendant 10 ans à 0,25 %/mois | 0.22 | 0.39 | ✅ | calcul manuel recoupé |
| tresorerie/loyer-credit-bail — Matériel 60 000 € | 0.21 | 0.39 | ✅ | calcul manuel recoupé |
| analytique/cout-complet — Fabrication | 0.29 | 0.59 | ✅ | calcul manuel recoupé |
| analytique/repartition-centres — Deux auxiliaires réciproques | 0.61 | 1.16 | ✅ | calcul manuel recoupé |
| analytique/abc — Deux gammes | 0.30 | 0.73 | ✅ | calcul manuel recoupé |
| analytique/imputation-rationnelle — Sous-activité | 0.15 | 0.38 | ✅ | calcul manuel recoupé |
| analytique/seuil-rentabilite — PME | 0.29 | 0.71 | ✅ | calcul manuel recoupé |
| analytique/ecarts-matieres-mod — Matières | 0.16 | 0.34 | ✅ | calcul manuel recoupé |
| analytique/ecarts-centre — Atelier | 0.19 | 0.35 | ✅ | calcul manuel recoupé |
| analytique/ecarts-ca — Deux gammes | 0.21 | 0.88 | ✅ | calcul manuel recoupé |
| analytique/prix-cession-interne — Comparaison | 0.19 | 0.43 | ✅ | calcul manuel recoupé |
| analytique/cout-cible — Nouveau produit | 0.23 | 0.39 | ✅ | calcul manuel recoupé |
| investissement/van-tri — Projet industriel | 3.71 | 5.78 | ✅ | calcul manuel recoupé |
| investissement/flux-investissement — Nouvelle ligne de production | 1.51 | 3.60 | ✅ | calcul manuel recoupé |
| investissement/cmpc — ETI | 0.20 | 0.36 | ✅ | calcul manuel recoupé |
| investissement/medaf — PME non cotée | 0.19 | 0.42 | ✅ | calcul manuel recoupé |
| investissement/beta — 12 mois | 0.82 | 1.20 | ✅ | calcul manuel recoupé |
| investissement/scenarios — Trois scénarios | 0.65 | 1.18 | ✅ | calcul manuel recoupé |
| investissement/monte-carlo — 1 000 tirages, graine 42 | 11.76 | 20.99 | ✅ | calcul manuel recoupé |
| investissement/arbre-decision — Capacité de production | 0.30 | 1.10 | ✅ | calcul manuel recoupé |
| investissement/choix-financement — Machine 200 000 € | 0.77 | 2.14 | ✅ | calcul manuel recoupé |
| stocks/valorisation-stock — CMP | 0.64 | 1.30 | ✅ | calcul manuel recoupé |
| stocks/valorisation-stock — FIFO | 0.56 | 1.78 | ✅ | calcul manuel recoupé |
| stocks/valorisation-stock — LIFO | 0.53 | 3.08 | ✅ | calcul manuel recoupé |
| stocks/valeur-nette-realisation — Produits en cours | 0.13 | 0.29 | ✅ | calcul manuel recoupé |
| stocks/wilson — Composant | 0.52 | 0.93 | ✅ | calcul manuel recoupé |
| stocks/stock-securite — Statistique 95 % | 0.12 | 0.16 | ✅ | calcul manuel recoupé |
| stocks/stock-securite — Forfaitaire | 0.10 | 0.13 | ✅ | calcul manuel recoupé |
| stocks/rotation-stocks — Négoce | 0.16 | 0.35 | ✅ | calcul manuel recoupé |
| stocks/ecarts-inventaire — Inventaire de clôture | 0.25 | 0.41 | ✅ | calcul manuel recoupé |
| stocks/variation-stocks — Clôture | 0.23 | 0.37 | ✅ | calcul manuel recoupé |
| consolidation/perimetre — Groupe à 5 filiales | 1.23 | 2.21 | ✅ | calcul manuel recoupé |
| consolidation/ecart-acquisition — Partiel | 0.13 | 0.29 | ✅ | calcul manuel recoupé |
| consolidation/ecart-acquisition — Complet | 0.13 | 0.27 | ✅ | calcul manuel recoupé |
| consolidation/partage-capitaux-propres — Filiale à 75 % | 0.22 | 0.36 | ✅ | calcul manuel recoupé |
| consolidation/marges-internes — Filiale vendeuse à 80 % | 0.18 | 0.30 | ✅ | calcul manuel recoupé |
| consolidation/comptes-reciproques — Rapprochement annuel | 0.20 | 0.58 | ✅ | calcul manuel recoupé |
| consolidation/conversion-comptes — Filiale américaine | 0.16 | 0.35 | ✅ | calcul manuel recoupé |
| consolidation/impots-differes — Retraitements | 0.16 | 0.79 | ✅ | calcul manuel recoupé |
| consolidation/couverture-terme — Export USD 90 j | 0.23 | 0.44 | ✅ | calcul manuel recoupé |
| consolidation/option-change — Put 3 mois | 1.75 | 4.64 | ✅ | calcul manuel recoupé |
| sectoriels/avancement-chantier — Chantier bénéficiaire | 0.17 | 0.33 | ✅ | calcul manuel recoupé |
| sectoriels/avancement-chantier — Chantier déficitaire | 0.19 | 0.31 | ✅ | calcul manuel recoupé |
| sectoriels/situation-travaux — Situation n° 4 | 0.15 | 0.60 | ✅ | calcul manuel recoupé |
| sectoriels/compte-prorata — Quatre lots | 0.30 | 0.60 | ✅ | calcul manuel recoupé |
| sectoriels/vefa — Hors d’eau | 0.18 | 0.34 | ✅ | calcul manuel recoupé |
| sectoriels/promotion-immobiliere — Résidence de 40 lots | 0.16 | 0.31 | ✅ | calcul manuel recoupé |
| sectoriels/remboursement-forfaitaire-agricole — Polyculture-élevage | 0.06 | 0.09 | ✅ | calcul manuel recoupé |
| sectoriels/subvention-investissement — Bâtiment d’élevage | 0.17 | 0.39 | ✅ | calcul manuel recoupé |
| sectoriels/fonds-dedies — Projet sous-consommé | 0.11 | 0.32 | ✅ | calcul manuel recoupé |
| sectoriels/fonds-dedies — Utilisation des fonds antérieurs | 0.09 | 0.11 | ✅ | calcul manuel recoupé |
| sectoriels/reduction-dons — Entreprise | 0.16 | 0.31 | ✅ | calcul manuel recoupé |
| sectoriels/reduction-dons — Particulier | 0.11 | 0.16 | ✅ | calcul manuel recoupé |
| sectoriels/bnc-2035 — Cabinet libéral | 0.13 | 0.19 | ✅ | calcul manuel recoupé |
| sectoriels/micro-entreprise — Services BIC 2024 | 0.12 | 0.34 | ✅ | calcul manuel recoupé |
| sectoriels/chain-ladder — Triangle 5 × 5 | 0.27 | 0.61 | ✅ | calcul manuel recoupé |
| sectoriels/ratios-prudentiels — Banque régionale | 0.23 | 0.42 | ✅ | calcul manuel recoupé |
