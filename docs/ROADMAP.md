# ROADMAP V1 STABLE (suggestion)

1) Geler le scope V1: aucune nouvelle feature tant que stabilisation non faite
2) Decouper app.js: store state + services (CRUD, persistence, export, gantt helpers) + vue/ui events
3) Fiabiliser le cycle edition -> preview -> save (dirty flag, preview isolee, validation champs)
4) Couvrir par tests: scenarios manuels (tests/scenarios.md) puis tests end-to-end legers
5) Aligner la feuille de style sur le nom cible `style.css` sans casser l'UI
6) Documenter API interne (fonctions publiques) avant toute evolution graphique
