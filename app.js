/* =========================================================
   SUIVI DE CHANTIERS – APP.JS
   TEST TEMPORAIRE POUR GITHUB PAGES
========================================================= */

const el = (id)=>document.getElementById(id);

/* ===============================
   ETAT GLOBAL
================================ */
window.state = defaultState();
let state = window.state;
let dirty = false;
/* ===============================
   LOAD (PRODUCTION FINALE)
================================ */
function load(){

  // 1️⃣ État initial local (UI visible immédiatement)
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      state = normalizeState(JSON.parse(raw));
    } else {
      state = normalizeState(defaultState());
    }
  } catch (e) {
    state = normalizeState(defaultState());
  }

  // 2️⃣ Rendu immédiat (même si état vide)
  renderAll();
  clearDirty();

  // 3️⃣ Supabase recharge ensuite l'état réel
  _scheduleSupabaseAutoLoad();
}




/* ===============================
   BOOTSTRAP
================================ */
document.addEventListener("DOMContentLoaded", ()=>{
  load();
  bind();
});
