/* =========================================================
   SUIVI DE CHANTIERS – APP.JS
   TEST TEMPORAIRE POUR GITHUB PAGES
========================================================= */

const el = (id)=>document.getElementById(id);

/* ===============================
   ETAT GLOBAL
================================ */
let state = defaultState();
let dirty = false;

/* ===============================
   LOAD (PATCH TEMPORAIRE)
================================ */
function load(){

  // ==================================================
  // ⚠️ TEST FORCÉ – À SUPPRIMER APRÈS VALIDATION
  // ==================================================
  state = normalizeState({
    projects: [{
      id: "TEST",
      name: "Projet test GitHub Pages",
      site: "Démo",
      subproject: ""
    }],
    tasks: [{
      id: "T1",
      projectId: "TEST",
      room: "Tâche test",
      status: "EN COURS",
      start: "2026-01-01",
      end: "2026-01-10",
      owner: "TEST"
    }],
    ui: { activeTab: "MASTER", filters: {} }
  });

  renderAll();
  clearDirty();
  return;
  // ==================================================
  // FIN TEST FORCÉ
  // ==================================================

  /* ====== CODE ORIGINAL (NE S’EXÉCUTE PAS POUR LE TEST) ======
  try{
    const raw = localStorage.getItem(STORAGE_KEY);
    if(raw){
      state = normalizeState(JSON.parse(raw));
    }else{
      state = normalizeState(defaultState());
    }
  }catch(e){
    state = normalizeState(defaultState());
  }
  renderAll();
  clearDirty();
  _scheduleSupabaseAutoLoad();
  =========================================================== */
}

/* ===============================
   BOOTSTRAP
================================ */
document.addEventListener("DOMContentLoaded", ()=>{
  load();
  bind();
});
