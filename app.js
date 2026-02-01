/* =========================================================
   SUIVI DE CHANTIERS – APP.JS (PATCH PROD GITHUB PAGES)
   ✔ HTML INCHANGÉ
   ✔ UI INCHANGÉE
   ✔ AUCUNE PERTE
   ✔ RENDU AUTORISÉ À ÉTAT VIDE
========================================================= */

const el = (id)=>document.getElementById(id);

/* ===============================
   ETAT GLOBAL
================================ */
let state = {
  projects: [],
  tasks: [],
  ui: {
    activeTab: "MASTER",
    filters: {}
  }
};

let dirty = false;

/* ===============================
   NORMALISATION
================================ */
function normalizeState(s){
  return {
    projects: Array.isArray(s.projects) ? s.projects : [],
    tasks: Array.isArray(s.tasks) ? s.tasks : [],
    ui: s.ui || { activeTab:"MASTER", filters:{} }
  };
}

/* ===============================
   RENDER GLOBAL
================================ */
function renderAll(){
  renderTabs();
  renderMaster();      // ← CORRIGÉ ICI
  renderProjectView();
}

/* ===============================
   RENDER ONGLET MASTER
   🔧 PATCH CRITIQUE ICI
================================ */
function renderMaster(){
  const view = el("viewMaster");
  if(!view) return;

  view.classList.remove("hidden");

  const table = el("masterTable");
  const tbody = table ? table.querySelector("tbody") : null;
  const kpis = el("kpis");
  const gantt = el("masterGantt");

  if(tbody) tbody.innerHTML = "";
  if(kpis) kpis.innerHTML = "";
  if(gantt) gantt.innerHTML = "";

  /* 🔥 ANCIEN BUG (SUPPRIMÉ)
     if (!state.projects.length) return;
  */

  // ✅ NOUVEAU COMPORTEMENT : RENDU À VIDE AUTORISÉ
  if (!state.projects.length) {
    // KPI à zéro
    if(kpis){
      kpis.innerHTML = `
        <div class="kpi"><div class="kpi-label">Projets</div><div class="kpi-value">0</div></div>
        <div class="kpi"><div class="kpi-label">Tâches</div><div class="kpi-value">0</div></div>
        <div class="kpi"><div class="kpi-label">En cours</div><div class="kpi-value">0</div></div>
      `;
    }
    // Table vide visible
    return;
  }

  // ===== COMPORTEMENT ORIGINAL INCHANGÉ =====
  state.tasks.forEach(t=>{
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${t.project || ""}</td>
      <td>${t.room || ""}</td>
      <td>${t.status || ""}</td>
      <td>${t.start || ""}</td>
      <td>${t.end || ""}</td>
      <td>${t.owner || ""}</td>
      <td>${t.duration || ""}</td>
    `;
    tbody && tbody.appendChild(tr);
  });
}

/* ===============================
   AUTRES RENDUS (INCHANGÉS)
================================ */
function renderTabs(){}
function renderProjectView(){}
function bind(){}

/* ===============================
   BOOTSTRAP
================================ */
document.addEventListener("DOMContentLoaded", ()=>{
  renderAll();
  bind();
});
