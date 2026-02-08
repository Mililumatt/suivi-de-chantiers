# MODELE DE DONNEES

```js
state = {
  projects: [
    {
      id,
      name,
      site,
      constraints,
      notes,
      noOpenAfter,
      hardStop
    }
  ],
  tasks: [
    {
      id,
      projectId,
      roomNumber,
      status,     // enum chantier
      owner,      // interne / externe
      start,      // YYYY-MM-DD
      end,        // YYYY-MM-DD
      notes
    }
  ],
  ui: {
    activeTab,
    filters
  }
}
```

Statuts officiels (enum `status`)
- A_PLANIFIER
- PREPA
- EN_COURS
- SECHAGE
- RECEPTION
- TERMINE
- BLOQUE
- REPORTE

Remarques
- Les dates sont des previs hebdomadaires (utilisees pour le Gantt)
- `owner` distingue interne / externe
- La sauvegarde localStorage + export fait foi; eviter les divergences entre preview et etat enregistre
