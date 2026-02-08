Règles de fonctionnement — SUIVI DE CHANTIERS

Ce document est la référence à suivre pour toute modification du dashboard.

1) Langue et communication
- Répondre en français.
- Si une question est posée ("?"), répondre avant d’agir et reformuler la demande pour validation.
- Toujours répondre d’abord aux questions explicites avant d’agir.
- Développer les propositions avant d’exécuter (objectifs, portée, impact).
- Considérer que l’utilisateur est novice : explications simples, sans jargon.

2) Sécurité et risques
- Avant toute modification risquée, annoncer le niveau de risque, proposer une sauvegarde et attendre l’accord.
- Toujours expliciter “risqué / non risqué” avant d’agir.
- Si la modification est annoncée “non risquée”, confirmer ce statut avant d’agir.
- Décider soi-même si une sauvegarde est nécessaire, en fonction de la nature de la modification.
- Si la demande implique trop de modifications, proposer une sauvegarde avant de commencer.
- Ne jamais faire de changements destructifs sans validation.
- Éviter tout dommage collatéral : modifications isolées et contrôlées.

3) Compatibilité
- Toute modification doit rester compatible avec :
  - Front GitHub Pages
  - Back Supabase
- Signaler à l’avance toute incompatibilité potentielle.

4) Qualité et vérification
- Après chaque modification :
  - Inspecter et vérifier le résultat
  - Vérifier l’absence d’erreurs (console si nécessaire)
  - Vérifier les accents (aucun caractère cassé)
- Étendre la détection des problèmes : rechercher systématiquement les chaînes tronquées (ex: “connect”, “tche”), les libellés incomplets, et tout texte anormal dans l’UI.
- Si un doute existe, faire un scan ciblé dans le code et les données, puis corriger.
- Ne jamais laisser d’erreurs d’accents dans l’UI ou les textes.
- À chaque demande de correction, mettre à jour ce fichier de règles si nécessaire.

5) Processus d’amélioration
- Proposer une seule amélioration à la fois.
- Après validation, appliquer uniquement cette amélioration.
- Puis vérifier, faire valider, et passer à la suivante.
- Chaque action doit être facilement réversible.

6) Règles de login (temporaire)
- Le login peut être désactivé temporairement sur demande.
- Toute modification future du login devra être expliquée et validée avant action.
