README TECH - Suivi de chantiers
Date: 2026-01-28

Contexte
- Version actuelle: patch V3.6.1 (fix bouton Enregistrer tache)
- Front statique: ouvrir `index.html` dans le navigateur (pas de build ni dep)
- Storage: localStorage cle "suivi_chantiers_multi_v3" + exports auto CSV/JSON a chaque save()

Architecture actuelle
- index.html : structure UI, formulaires, onglets, conteneur Gantt
- styles.css : styles existants (referencee aujourd'hui en tant que styles.css dans index.html)
- app.js : logique metier + UI (monolithique) : state in-memory, CRUD projets/taches, Gantt hebdo, sauvegarde/export, alertes fermeture
- backups/ : export JSON (etat reel)
- docs/ : (ce dossier) pour passation
- tests/ : scenarios manuels

Ce qui fonctionne
- CRUD projets et taches (apres correctifs 3.6.1)
- Sauvegarde locale + protection fermeture si dirty
- Export CSV/JSON declenche par save()
- Gantt hebdomadaire (projection)

Ce qui est fragile / a reprendre
- Empilement de patches (app.js monolithique)
- Couplage fort UI <-> logique (handlers inline, pas de separation state/services/ui)
- Cycle edition -> preview Gantt -> sauvegarde encore fragile
- Aucun test automatise

Message a transmettre tel quel aux futurs devs (VS Code):
"L'application est fonctionnelle mais issue de patches successifs.
Objectif : stabiliser app.js, decoupler la logique (state, CRUD, Gantt) de l'UI, et fiabiliser le cycle edition → preview → save.
Merci de repartir du modele de donnees fourni, de conserver les regles metier, et de figer une V1 stable avant toute graphicalisation avancee."

Notes rapides pour prise en main
- Le Gantt affiche uniquement les taches ayant start/end; base hebdomadaire
- Statuts officiels figes (voir MODEL_DONNEES.md)
- Exports: `suivi_chantiers.csv` (preuve hierarchie) et `suivi_chantiers_backup.json` (trace officielle)
- Nom du fichier CSS cible dans l'arborescence souhaitee: style.css (actuellement styles.css). A aligner lors du refactor sans casser la page.
