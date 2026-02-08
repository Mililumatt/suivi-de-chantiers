PATCH V3.6.1 – FIX ENREGISTRER TÂCHE

PROBLÈME
- En V3.6, "Enregistrer tâche" ne persistait plus correctement

CORRECTION
- Le bouton "Enregistrer tâche" écrit à nouveau TOUS les champs dans state.tasks
- Puis déclenche la sauvegarde + exports
- Gantt réactif conservé

INSTALLATION
1) Fermer l’onglet
2) Remplacer app.js
3) Rouvrir index.html
