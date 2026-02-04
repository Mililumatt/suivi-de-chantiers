// SUiVI DE CHANTIERS - état embarqué forcé (pas de localStorage)
// Projet : Rénovation Bureau Pastorale + 1 tâche datée

const el = (id)=>document.getElementById(id);
const STORAGE_KEY = "suivi_chantiers_state_v1";

/* =========================================================
   SUPABASE GREFFE MINIMALE (NE TOUCHE PAS A L'UI)
   - Pas de module
   - Pas de refactor
   - Supabase est appele APRES saveState()
   - Chargement Supabase APRES premier rendu UI
   Fonctions autorisees (globals) :
     window.supabaseLogin(email, password)
     window.saveAppStateToSupabase(state)
     window.loadAppStateFromSupabase()
========================================================= */

// ---- CONFIG (TES VALEURS) ----
const SUPABASE_URL  = "https://uioqchhbakcvemknqikh.supabase.co";
const SUPABASE_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVpb3FjaGhiYWtjdmVta25xaWtoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3NjA4MTUsImV4cCI6MjA4NTMzNjgxNX0.W345e_uwKLGaFcP9KAZq0kNECBUSFluh2ErgHaHeO5w";
const SUPABASE_TABLE = "app_states";

// Auto-login (pour ne PAS utiliser la console)
const SUPABASE_AUTO_EMAIL = "sebastien_duc@outlook.fr";
const SUPABASE_AUTO_PASSWORD = "Mililum@tt45";

// ---- client ----
let _sb = null;
function _getSupabaseClient(){
  try{
    if(_sb) return _sb;
    if(!window.supabase || !window.supabase.createClient){
      console.warn("Supabase CDN non charge");
      return null;
    }
    _sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
    return _sb;
  }catch(e){
    console.warn("Supabase init failed", e);
    return null;
  }
}

// ---- helper : session ----
async function _ensureSession(){
  const sb = _getSupabaseClient();
  if(!sb) return null;

  try{
    const s = await sb.auth.getSession();
    if(s && s.data && s.data.session) return s.data.session;

    // pas de session -> auto login (si creds presentes)
    if(SUPABASE_AUTO_EMAIL && SUPABASE_AUTO_PASSWORD){
      const res = await sb.auth.signInWithPassword({
        email: SUPABASE_AUTO_EMAIL,
        password: SUPABASE_AUTO_PASSWORD
      });
      if(res && res.data && res.data.session) return res.data.session;
    }
  }catch(e){
    console.warn("Supabase session failed", e);
  }
  return null;
}

/* ===============================
   API GLOBALE AUTORISEE
================================ */
window.supabaseLogin = async function(email, password){
  const sb = _getSupabaseClient();
  if(!sb) return false;
  try{
    const res = await sb.auth.signInWithPassword({ email, password });
    return !!(res && res.data && res.data.session);
  }catch(e){
    console.warn("supabaseLogin failed", e);
    return false;
  }
};

window.saveAppStateToSupabase = async function(stateObj){
  const sb = _getSupabaseClient();
  if(!sb) return false;

  const session = await _ensureSession();
  if(!session || !session.user) return false;

  try{
    const payload = {
      user_id: session.user.id,
      state_json: stateObj,
      updated_at: new Date().toISOString()
    };
    const { error } = await sb.from(SUPABASE_TABLE).upsert(payload, { onConflict: "user_id" });
    if(error){ console.warn("Supabase upsert error", error); return false; }
    return true;
  }catch(e){
    console.warn("saveAppStateToSupabase failed", e);
    return false;
  }
};

window.loadAppStateFromSupabase = async function(){
  const sb = _getSupabaseClient();
  if(!sb) return false;

  const session = await _ensureSession();
  if(!session || !session.user) return false;

  try{
    const { data, error } = await sb
      .from(SUPABASE_TABLE)
      .select("state_json, updated_at")
      .eq("user_id", session.user.id)
      .maybeSingle();

    if(error){ console.warn("Supabase select error", error); return false; }
    if(!data || !data.state_json) return false;

    // IMPORTANT : on remplace UNIQUEMENT l'etat global, puis on rend
    state = normalizeState(data.state_json);
    renderAll();
    clearDirty();
    return true;
  }catch(e){
    console.warn("loadAppStateFromSupabase failed", e);
    return false;
  }
};

// ---- auto-load apres 1er rendu UI ----
let _supabaseAutoloadScheduled = false;
function _scheduleSupabaseAutoLoad(){
  if(_supabaseAutoloadScheduled) return;
  _supabaseAutoloadScheduled = true;

  // pas d'await au chargement initial : on laisse l'UI se rendre d'abord
  setTimeout(function(){
    try{
      window.loadAppStateFromSupabase();
    }catch(e){}
  }, 120);
}

const uid = ()=> Math.random().toString(16).slice(2,10) + Date.now().toString(16);
const normId = (v)=> (v===undefined || v===null) ? "" : String(v).trim();

let state = null;
let selectedProjectId = null;
let selectedTaskId = null;
let taskOrderMap = {};
let selectedStatusSet = new Set();
let sortMaster = {key:"project", dir:"asc"};
let sortProject = {key:"num", dir:"asc"};
let unsavedChanges = false;
let isLocked = true; // verrou lecture seule par défaut
let workloadMode = "week";

const STATUSES = [
  {v:"CHANTIER_COMPLET", label:"Chantier complet"},
  {v:"ELECTRICITE", label:"Électricité"},
  {v:"PEINTURE", label:"Peinture"},
  {v:"SOL", label:"Sol"},
  {v:"PLACO", label:"Placo / cloisons"},
  {v:"FAUX_PLAFOND", label:"Faux plafond"},
  {v:"AMENAGEMENTS", label:"Aménagements"},
  {v:"MOBILIER", label:"Mobilier"},
  {v:"PLOMBERIE", label:"Plomberie"},
  {v:"PREPARATION", label:"Préparation"},
  {v:"TDV",          label:"TDV"},
  {v:"MACONNERIE",   label:"Maçonnerie"},
  {v:"HUIS_SER",     label:"Huisseries"},
  {v:"RESEAUX",      label:"Réseaux"},
  {v:"TOITURE",      label:"Toiture / étanchéité"},
  {v:"ETUDE",        label:"Étude"},
];
const sortedStatuses = ()=> [...STATUSES].sort((a,b)=> a.label.localeCompare(b.label,"fr",{sensitivity:"base"}));

const STATUS_COLORS = {
  CHANTIER_COMPLET: "#1e3a8a",
  ELECTRICITE:      "#d97706",
  PEINTURE:         "#1d4ed8",
  SOL:              "#0f766e",
  PLACO:            "#7c3aed",
  FAUX_PLAFOND:     "#b45309",
  AMENAGEMENTS:     "#db2777",
  MOBILIER:         "#334155",
  PLOMBERIE:        "#15803d",
  PREPARATION:      "#475569",
  TDV:              "#f97316",
  MACONNERIE:       "#a16207",
  HUIS_SER:         "#4b5563",
  RESEAUX:          "#0ea5b0",
  TOITURE:          "#0d9488",
};

const statusColor = (v)=> STATUS_COLORS[(v||"").toUpperCase()] || "#1f2937";
const statusDot = (v)=> `<span class="icon-dot" style="background:${statusColor(v)};border-color:${statusColor(v)}"></span>`;
const parseStatuses = (s)=> (s||"").split(",").map(x=>x.trim()).filter(Boolean);
const deepClone = (obj)=> JSON.parse(JSON.stringify(obj));
const siteColor = (_site="")=>"transparent";
const attrEscape = (s="")=> s.replace(/&/g,"&amp;").replace(/"/g,"&quot;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
const ownerType = (o="")=>{
  const k=o.toLowerCase();
  const hasInt = k.includes("interne");
  const hasExt = k.includes("externe");
  // Plus de catégorie "mixte" : on priorise "interne" si exclusif, sinon "externe".
  if(hasInt && !hasExt) return "interne";
  if(hasExt) return "externe";
  return "inconnu";
};
const ownerBadge = (o="")=>{
  const k = o.toLowerCase();
  // Palette alignée avec le graphique de charge
  let color = "#0f172a"; // interne par défaut
  if(k.includes("interne") && k.includes("externe")) color = "#b45309"; // mix -> externe
  else if(k.includes("externe")) color = "#b45309"; // prestataire externe
  else if(k.includes("interne")) color = "#0f172a"; // équipe interne
  return `<span class="badge owner" style="background:${color};border-color:${color};color:#fff;">${o}</span>`;
};

function refreshVendorsList(){
  const list = el("vendorsList");
  if(!list) return;
  const vendors = Array.from(new Set(
    (state?.tasks||[])
      .map(t=>(t.vendor||"").trim())
      .filter(Boolean)
  )).sort((a,b)=>a.localeCompare(b,"fr",{sensitivity:"base"}));
  list.innerHTML = vendors.map(v=>`<option value="${v}"></option>`).join("");
}

function setupVendorPicker(){
  const input = el("t_vendor");
  if(!input) return;
  const openList = ()=>{
    if(typeof input.showPicker === "function"){
      try{ input.showPicker(); }catch(e){}
    }
  };
  input.addEventListener("focus", openList);
  input.addEventListener("click", ()=>{ if(!input.value) openList(); });
}

function normalizeState(raw){
  if(!raw) return defaultState();
  const normalizeStatus = (s)=> (s||"").split(",").filter(Boolean).map(v=>{
    if(v==="PREPA") return "PREPARATION";
    return v;
  }).join(",");
  const normProjects = (raw.projects||[]).map(p=>({...p, id:normId(p.id)}));
  const normTasks = (raw.tasks||[]).map(t=>({
    ...t,
    projectId:normId(t.projectId),
    status: normalizeStatus(t.status)
  }));
  return {projects:normProjects, tasks:normTasks, ui: raw.ui||{}};
}
const formatDate = (s)=>{
  if(!s) return "";
  const parts = s.split("-");
  if(parts.length!==3) return s;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};
const unformatDate = (fr)=>{
  if(!fr) return "";
  const parts = fr.split("/");
  if(parts.length!==3) return fr;
  const [jj,mm,aa] = parts;
  return `${aa}-${mm}-${jj}`;
};

// -------- Multisélection Statuts / Corps d'état --------
function buildStatusMenu(){
  const menu = el("t_status_menu");
  if(!menu) return;
  let h="";
  sortedStatuses().forEach(s=>{
    h+=`<div class="ms-item" data-v="${s.v}">
          <span class="ms-checkbox"></span>
          <span class="ms-label">${s.label}</span>
        </div>`;
  });
  menu.innerHTML=h;
  menu.querySelectorAll(".ms-item").forEach(item=>{
    item.onclick=(e)=>{
      e.stopPropagation(); // garder le menu ouvert pendant la multi-sélection
      const v=item.dataset.v;
      if(selectedStatusSet.has(v)) selectedStatusSet.delete(v);
      else selectedStatusSet.add(v);
      updateStatusDisplay();
    };
  });
}

function updateStatusDisplay(){
  const display = el("t_status_display");
  const menu = el("t_status_menu");
  if(!display || !menu) return;
  // visuels des coche
  menu.querySelectorAll(".ms-item").forEach(item=>{
    const v=item.dataset.v;
    if(selectedStatusSet.has(v)) item.classList.add("selected");
    else item.classList.remove("selected");
  });
  if(selectedStatusSet.size===0){
    display.textContent="Sélectionner…";
  }else{
    const labels = STATUSES.filter(s=>selectedStatusSet.has(s.v)).map(s=>s.label);
    display.textContent = labels.join(", ");
  }
}

function setStatusSelection(values){
  selectedStatusSet = new Set((values||"").split(",").filter(Boolean));
  updateStatusDisplay();
}

function toggleStatusMenu(show){
  const menu = el("t_status_menu");
  if(!menu) return;
  const shouldShow = show!==undefined ? show : menu.classList.contains("hidden");
  if(shouldShow) menu.classList.remove("hidden");
  else menu.classList.add("hidden");
}

const EMBEDDED_BACKUP = {
  projects: [
    { id:"3e86100919c04fb8456", name:"Bureau Pastorale", site:"CDM", constraints:"", subproject:"Rénovation" },
    { id:"0c644af019c05700845", name:"Internat Saint Gervais", site:"LGT", constraints:"", subproject:"Rénovation CH 011" }
  ],
  tasks: [
    { id:"c807465d19c05012673", projectId:"3e86100919c04fb8456", roomNumber:"Rénovation", status:"ELECTRICITE,PEINTURE,MOBILIER,AMENAGEMENTS", owner:"Équipe interne", start:"2026-02-02", end:"2026-02-27", notes:"" },
    { id:"f490f0e019c0571bee2", projectId:"0c644af019c05700845", roomNumber:"Rénovation CH 011", status:"PEINTURE,TDV,AMENAGEMENTS", owner:"Équipe interne", start:"2026-02-02", end:"2026-02-14", notes:"" },
    { id:"840b3cb519c05732884", projectId:"0c644af019c05700845", roomNumber:"Rénovation CH 010", status:"PEINTURE,AMENAGEMENTS,TDV", owner:"Équipe interne", start:"2026-02-16", end:"2026-02-28", notes:"" }
  ],
  ui: { activeTab:"3e86100919c04fb8456", filters:{} }
};

function defaultState(){
  return deepClone(EMBEDDED_BACKUP);
}

function load(){
  const skipFileFetch = (window.location && window.location.protocol === "file:");
  const backupPromise = skipFileFetch
    ? Promise.reject("skip-file-fetch")
    : fetch(`suivi_chantiers_backup.json?v=${Date.now()}`, {cache:"no-store"});
  // 1) tenter le fichier de backup du projet (persistant disque)
  backupPromise
    .then(resp=> resp.ok ? resp.json() : null)
    .then(data=>{
      if(data){
        state = normalizeState(data);
        renderAll();
        clearDirty();
        _scheduleSupabaseAutoLoad();
        return;
      }
      // 2) sinon tenter le localStorage
      try{
        const raw = localStorage.getItem(STORAGE_KEY);
        if(raw){
          state = normalizeState(JSON.parse(raw));
          renderAll();
          clearDirty();
          _scheduleSupabaseAutoLoad();
          return;
        }
      }catch(e){}
      // 3) fallback état embarqué
      state = normalizeState(defaultState());
      renderAll();
      clearDirty();
      _scheduleSupabaseAutoLoad();
    })
    .catch(()=>{
      // si fetch échoue, on tente localStorage puis default
      try{
        const raw = localStorage.getItem(STORAGE_KEY);
        if(raw){
          state = normalizeState(JSON.parse(raw));
          renderAll();
          clearDirty();
          _scheduleSupabaseAutoLoad();
          return;
        }
      }catch(e){}
      state = normalizeState(defaultState());
      renderAll();
      clearDirty();
      _scheduleSupabaseAutoLoad();
    });
}

function saveState(){
  try{
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    clearDirty();
    // Supabase greffe : APRES sauvegarde locale
    try{ if(window.saveAppStateToSupabase) window.saveAppStateToSupabase(state); }catch(e){}
  }catch(e){
    console.warn("save failed", e);
  }
}

function updateSaveButton(){
  const btn = el("btnSave");
  if(!btn) return;
  btn.classList.remove("btn-danger","btn-success");
  if(unsavedChanges){
    btn.classList.add("btn-danger");
  }else{
    btn.classList.add("btn-success");
  }
}
function markDirty(){ unsavedChanges = true; updateSaveButton(); }
function clearDirty(){ unsavedChanges = false; updateSaveButton(); }

function downloadBackup(){
  try{
    const data = JSON.stringify(state, null, 2);
    const blob = new Blob([data], {type:"application/json"});
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "suivi_chantiers_backup.json";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }catch(e){
    console.warn("download backup failed", e);
  }
}

function writeBackupToDisk(){
  try{
    const data = JSON.stringify(state, null, 2);
    if(window.showSaveFilePicker){
      (async ()=>{
        const handle = await window.showSaveFilePicker({
          suggestedName: "suivi_chantiers_backup.json",
          types:[{description:"JSON", accept:{"application/json":[".json"]}}]
        });
        const writable = await handle.createWritable();
        await writable.write(data);
        await writable.close();
      })();
    }
  }catch(e){
    console.warn("writeBackupToDisk failed", e);
  }
}

function flashSaved(){
  const btn = el("btnSave");
  if(!btn) return;
  const old = btn.textContent;
  btn.textContent = "✅ Sauvegardé";
  btn.classList.add("pulse");
  setTimeout(()=>{ btn.textContent = old; btn.classList.remove("pulse"); },1200);
}

function setLockState(flag){
  isLocked = !!flag;
  const lockClass = "is-disabled";
  const ids = [
    "btnSave","btnAddProject","btnAddTask",
    "btnSaveProject","btnDeleteProject",
    "btnSaveTask","btnNewTask","btnDeleteTask"
  ];
  ids.forEach(id=>{
    const n=el(id);
    if(!n) return;
    n.classList.toggle(lockClass, isLocked);
    if(isLocked) n.setAttribute("disabled","disabled");
    else n.removeAttribute("disabled");
  });
  // tab close (supprimer projet)
  const tabCloses = document.querySelectorAll(".tab-close");
  tabCloses.forEach(n=>{
    n.classList.toggle(lockClass, isLocked);
    if(isLocked) n.setAttribute("aria-disabled","true");
    else n.removeAttribute("aria-disabled");
  });
  // visuel live
  const live = el("masterLive");
  if(live){
    live.classList.toggle("is-disabled", isLocked);
  }
  const plive = el("projectLive");
  if(plive){
    plive.classList.toggle("is-disabled", isLocked);
  }
}

function statusLabels(values){
  return parseStatuses(values).map(v=> (STATUSES.find(s=>s.v===v)?.label || v)).join(", ");
}
function durationDays(start,end){
  if(!start || !end) return "";
  const s=new Date(start+"T00:00:00");
  const e=new Date(end+"T00:00:00");
  if(isNaN(s) || isNaN(e) || e<s) return "";
  const days=new Set();
  for(let d=new Date(s); d<=e; d.setDate(d.getDate()+1)){
    days.add(d.toISOString().slice(0,10));
  }
  return days.size>0 ? days.size : "";
}
function taskTitle(t){
  const p = state?.projects?.find(x=>x.id===t.projectId);
  const projectName = (p?.name||"Projet").trim();
  const sub = (p?.subproject||"").trim();
  const desc = (t.roomNumber||"").trim();
  if(sub && desc) return `${projectName} - ${sub} - ${desc}`;
  if(sub) return `${projectName} - ${sub}`;
  if(desc) return `${projectName} - ${desc}`;
  return projectName;
}

function ganttLaneTitle(t){
  const p = state?.projects?.find(x=>x.id===t.projectId);
  const projectName = (p?.name || "Sans projet").trim() || "Sans projet";
  const desc = (t.roomNumber || "").trim();
  return desc ? `${projectName} - ${desc}` : projectName;
}

function computeTaskOrderMap(){
  const map={};
  state.projects.forEach(p=>{
    const tasks=state.tasks.filter(t=>t.projectId===p.id);
    tasks.sort((a,b)=>{
      const sa = Date.parse(a.start||"9999-12-31");
      const sb = Date.parse(b.start||"9999-12-31");
      if(sa!==sb) return sa-sb;
      const ea = Date.parse(a.end||"9999-12-31");
      const eb = Date.parse(b.end||"9999-12-31");
      if(ea!==eb) return ea-eb;
      return (a.roomNumber||"").localeCompare(b.roomNumber||"");
    });
    tasks.forEach((t,i)=>{ map[t.id]=i+1; });
  });
  taskOrderMap=map;
}

// Gantt helpers
function startOfWeek(d){
  const x=new Date(d.getTime());
  const day=(x.getDay()+6)%7; // lundi=0
  x.setDate(x.getDate()-day);
  x.setHours(0,0,0,0);
  return x;
}
function endOfWorkWeek(d){
  const x=new Date(d.getTime());
  // vendredi = lundi + 4 jours
  x.setDate(x.getDate()+4);
  x.setHours(23,59,59,999);
  return x;
}
function addDays(d,n){ const x=new Date(d.getTime()); x.setDate(x.getDate()+n); return x; }
function overlapDays(aStart,aEnd,bStart,bEnd){
  const start = Math.max(aStart.getTime(), bStart.getTime());
  const end   = Math.min(aEnd.getTime(), bEnd.getTime());
  if(end < start) return 0;
  const diff = (end - start)/(1000*60*60*24);
  return Math.floor(diff)+1;
}
function barGeometry(taskStart, taskEnd, weekStart){
  const weekEnd = addDays(weekStart,6);
  const days = overlapDays(taskStart, taskEnd, weekStart, weekEnd);
  if(days<=0) return {days:0,width:0,offset:0};
  const offsetDays = Math.max(0, (taskStart.getTime() - weekStart.getTime())/(1000*60*60*24));
  const offsetPct  = Math.min(100, (offsetDays/7)*100);
  let widthPct = (days/7)*100;
  // éviter dépassement au-delà de la cellule
  if(offsetPct + widthPct > 100) widthPct = 100 - offsetPct;
  widthPct = Math.max(12, Math.min(100, widthPct));
  return {days, width:widthPct, offset:offsetPct};
}
function isoWeekInfo(d){
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(),0,1));
  const weekNo = Math.ceil(((date - yearStart)/86400000 +1)/7);
  return {week:weekNo, year:date.getUTCFullYear()};
}

function weekKey(d){
  const info=isoWeekInfo(d);
  return `${info.year}-S${String(info.week).padStart(2,"0")}`;
}
function keyToLabel(key, mode){
  if(mode==="day"){
    const [y,m,da]=key.split("-");
    return `${da}/${m}`;
  }
  // week
  const parts=key.split("-S");
  if(parts.length===2) return `S${parts[1]}/${String(parts[0]).slice(2)}`;
  return key;
}

function computeWorkloadData(tasks, mode="week"){
  const map = new Map(); // key -> {internal, external, total, anchor}
  tasks.filter(t=>t.start && t.end).forEach(t=>{
    const start=new Date(t.start+"T00:00:00");
    const end=new Date(t.end+"T00:00:00");
    if(isNaN(start)||isNaN(end)|| end<start) return;
    const typ = ownerType(t.owner);
    for(let d=new Date(start); d<=end; d.setDate(d.getDate()+1)){
      const key = mode==="day" ? d.toISOString().slice(0,10) : weekKey(d);
      const anchor = mode==="day" ? d.getTime() : startOfWeek(d).getTime();
      if(!map.has(key)) map.set(key,{internal:0,external:0,total:0,anchor});
      const slot = map.get(key);
      if(typ==="interne") slot.internal+=1;
      else slot.external+=1; // "externe" + inconnus
      slot.total = slot.internal + slot.external;
    }
  });
  const arr = Array.from(map.entries()).map(([key,val])=>({...val,key}));
  arr.sort((a,b)=> a.anchor - b.anchor);
  return arr;
}

function niceMax(v){
  if(v<=5) return 5;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const mul = Math.ceil(v / pow);
  if(mul<=2) return 2*pow;
  if(mul<=5) return 5*pow;
  return 10*pow;
}

function renderGantt(projectId){
  const wrap = el("gantt");
  const legend = el("legend");
  if(legend){
    legend.innerHTML = sortedStatuses().map(s=>{
      const c = STATUS_COLORS[s.v] || "#2563eb";
      return `<span class="legend-item"><span class="legend-dot" style="background:${c};border-color:${c}"></span><span style="color:#111827;font-weight:600;">${s.label}</span></span>`;
    }).join("");
  }
  if(!wrap) return;
  const tasks = state.tasks.filter(t=>t.projectId===projectId && t.start && t.end);
  if(tasks.length===0){
    wrap.innerHTML="<div class='gantt-empty'>Aucune tâche datée.</div>";
    return;
  }
  const minStart = tasks.map(t=>new Date(t.start+"T00:00:00")).reduce((a,b)=>a<b?a:b);
  const maxEnd   = tasks.map(t=>new Date(t.end+"T00:00:00")).reduce((a,b)=>a>b?a:b);
  const weeks=[];
  for(let w=startOfWeek(minStart); w<=addDays(startOfWeek(maxEnd),0); w=addDays(w,7)) weeks.push(new Date(w));

  // tri pour garder un ordre stable
  tasks.sort((a,b)=>{
    const oa=(taskOrderMap[a.id]||9999)-(taskOrderMap[b.id]||9999);
    if(oa!==0) return oa;
    const sa=Date.parse(a.start||"9999-12-31"), sb=Date.parse(b.start||"9999-12-31");
    if(sa!==sb) return sa-sb;
    return taskTitle(a).localeCompare(taskTitle(b));
  });

  let html="<div class='tablewrap gantt-table'><table class='table'>";
  html+="<thead><tr><th style='width:190px'>Tâche</th><th style='width:120px'>Prestataire</th><th style='width:70px'>Statut</th>";
  weeks.forEach(w=>{
    const info=isoWeekInfo(w);
    const wEnd=endOfWorkWeek(w);
    const range=`${w.toLocaleDateString("fr-FR",{day:"2-digit"})}-${wEnd.toLocaleDateString("fr-FR",{day:"2-digit"})}/${wEnd.toLocaleDateString("fr-FR",{month:"2-digit",year:"2-digit"})}`;
    const weekLabel = `S${String(info.week).padStart(2,"0")}`;
    html+=`<th class="week-cell" data-range="${range}" style='width:72px;color:#111827'>${weekLabel}</th>`;
  });
  html+="</tr></thead><tbody>";

  // Regrouper : même Nom de projet + même Description => même ligne
  const lanesMap = new Map();
  tasks.forEach(t=>{
    const title = ganttLaneTitle(t);
    const key = title.toLowerCase() || "no-title";
    if(!lanesMap.has(key)) lanesMap.set(key,{title, tasks:[]});
    lanesMap.get(key).tasks.push(t);
  });
  const lanes = Array.from(lanesMap.values());
  lanes.forEach(l=>{
    l.tasks.sort((a,b)=>{
      const sa=Date.parse(a.start||"9999-12-31"), sb=Date.parse(b.start||"9999-12-31");
      if(sa!==sb) return sa-sb;
      const ea=Date.parse(a.end||"9999-12-31"), eb=Date.parse(b.end||"9999-12-31");
      if(ea!==eb) return ea-eb;
      return (a.roomNumber||"").localeCompare(b.roomNumber||"");
    });
  });
  lanes.sort((a,b)=>{
    const ma = Math.min(...a.tasks.map(t=>Date.parse(t.start||"9999-12-31")));
    const mb = Math.min(...b.tasks.map(t=>Date.parse(t.start||"9999-12-31")));
    if(ma!==mb) return ma-mb;
    const oa = Math.min(...a.tasks.map(t=>taskOrderMap[t.id]||9999));
    const ob = Math.min(...b.tasks.map(t=>taskOrderMap[t.id]||9999));
    if(oa!==ob) return oa-ob;
    return a.title.localeCompare(b.title);
  });

  lanes.forEach(lane=>{
    const firstTask = lane.tasks[0];
    const firstStatus = parseStatuses(firstTask.status)[0]?.toUpperCase();
    const c = STATUS_COLORS[firstStatus] || "#1f2937";
    const owners = Array.from(new Set(lane.tasks.map(t=>t.owner).filter(Boolean)));
    const ownerBadgeHtml = owners.map(o=>ownerBadge(o)).join(" ");

    const statusSet = new Set();
    lane.tasks.forEach(t=> parseStatuses(t.status).forEach(v=> statusSet.add(v.toUpperCase())));
    const lineStatuses = Array.from(statusSet).sort((a,b)=>{
      const minA = Math.min(...lane.tasks.filter(t=>parseStatuses(t.status).map(x=>x.toUpperCase()).includes(a)).map(t=>Date.parse(t.start||"9999-12-31")));
      const minB = Math.min(...lane.tasks.filter(t=>parseStatuses(t.status).map(x=>x.toUpperCase()).includes(b)).map(t=>Date.parse(t.start||"9999-12-31")));
      if(minA!==minB) return minA-minB;
      const ia = STATUSES.findIndex(s=>s.v===a);
      const ib = STATUSES.findIndex(s=>s.v===b);
      return (ia<0?999:ia)-(ib<0?999:ib);
    });
    const statusText = lineStatuses
      .map(v=> STATUSES.find(s=>s.v===v)?.label || v)
      .map(txt=>`<div class="status-row"><span>${txt}</span></div>`)
      .join("");

    const vendors = Array.from(new Set(lane.tasks.map(t=>t.vendor||"").filter(Boolean))).sort((a,b)=>a.localeCompare(b,"fr",{sensitivity:"base"}));
    const vendorHtml = vendors.length ? vendors.map(v=>`<span class="badge owner" style="background:#4b5563;border-color:#4b5563;color:#fff;">${v}</span>`).join(" ") : "<span class='text-muted'>—</span>";

    html+=`<tr data-lane="${lane.title}">`;
    html+=`<td><b><span class="num-badge" style="--badge-color:${c};--badge-text:#fff;">${taskOrderMap[firstTask.id]||""}</span> <span class="icon-picto">📌</span> ${lane.title}</b><div class="gantt-meta">${ownerBadgeHtml}</div></td>`;
    html+=`<td class="gantt-vendor-cell"><div class="vendor-stack">${vendorHtml}</div></td>`;
    html+=`<td class="gantt-status-cell"><div class="gantt-status-stack">${statusText}</div></td>`;

    weeks.forEach(w=>{
      // une ligne fixe par statut pour garantir l'alignement vertical
      const cellRows = lineStatuses.map(st=>{
        // prendre toutes les barres de ce statut sur la semaine
        const bars = lane.tasks
          .filter(t=>parseStatuses(t.status).map(v=>v.toUpperCase()).includes(st))
          .map(t=>{
            const sDate=new Date(t.start+"T00:00:00");
            const eDate=new Date(t.end+"T00:00:00");
            const geo=barGeometry(sDate,eDate,w);
            const order=Date.parse(t.start||"9999-12-31");
            return {geo,taskId:t.id,order,vendor:t.vendor||""};
          })
          .filter(x=>x.geo.days>0)
          .sort((a,b)=>a.order-b.order);

        if(bars.length===0) return `<div class="gantt-row"><div class="gantt-spacer"></div></div>`;
        const color = STATUS_COLORS[st] || "#1f2937";
        const barHtml = bars.map(seg=>{
          const title = seg.vendor ? ` title="Prestataire : ${attrEscape(seg.vendor)}"` : "";
          return `<div class="bar-wrapper"><div class="gantt-bar bar-click" data-task="${seg.taskId}" data-status="${st}"${title} style="width:${seg.geo.width}%;margin-left:${seg.geo.offset}%;background:${color};border-color:${color}"><span class="gantt-days">${seg.geo.days} j</span></div></div>`;
        }).join("");
        return `<div class="gantt-row">${barHtml}</div>`;
      }).join("");

      html+=`<td class="gantt-cell"><div class="gantt-cell-inner">${cellRows || `<div class="gantt-spacer"></div>`}</div></td>`;
    });

    html+="</tr>";
  });

  html+="</tbody></table></div>";
  wrap.innerHTML=html;
  wrap.querySelectorAll(".bar-click")?.forEach(bar=>{
    bar.onclick=()=>{
      const taskId = bar.dataset.task;
      const task = state.tasks.find(x=>x.id===taskId);
      if(!task) return;
      selectedProjectId = task.projectId;
      selectedTaskId = taskId;
      renderProject();
    };
  });
}

function renderProjectTasks(projectId){
  const tbody = el("projectTasksTable")?.querySelector("tbody");
  if(!tbody) return;
  const tasks = state.tasks.filter(t=>t.projectId===projectId);
  const sorted = sortTasks(tasks, sortProject);
  if(sorted.length===0){
    tbody.innerHTML="<tr><td colspan='6' class='empty-row'>Aucune tâche</td></tr>";
    return;
  }
  let h="";
  sorted.forEach(t=>{
    const statuses = parseStatuses(t.status).map(v=>v.toUpperCase());
    const c = STATUS_COLORS[statuses[0]] || "#1f2937";
    const ownerBadgeHtml = t.owner ? ownerBadge(t.owner) : "";
    h+=`<tr data-task="${t.id}">
      <td><span class="num-badge" style="--badge-color:${c};--badge-text:#fff;">${taskOrderMap[t.id]||""}</span></td>
      <td><span class="icon-picto">📌</span> ${taskTitle(t)}</td>
      <td class="status-cell"><span class="status-left">${statusDot(statuses[0])}${statusLabels(t.status||"")}</span>${ownerBadgeHtml||""}</td>
      <td>${formatDate(t.start)||""}</td>
      <td>${formatDate(t.end)||""}</td>
      <td>${durationDays(t.start,t.end)}</td>
    </tr>`;
  });
  tbody.innerHTML=h;
  tbody.querySelectorAll("tr").forEach(row=>{
    row.onclick=()=>{
      if(!row.dataset.task) return;
      selectedTaskId=row.dataset.task;
      renderProject();
    };
  });
  updateSortIndicators("projectTasksTable", sortProject);
  const pf = el("projectFiltersBadge");
  if(pf){
    const active = (sortProject.key!=="num" || sortProject.dir!=="asc");
    updateBadge(pf, active, "Tri/filtre actif", "Tri par défaut");
  }
}

function renderMasterGantt(){
  const wrap = el("masterGantt");
  if(!wrap) return;
  const tasks = filteredTasks().filter(t=>t.start && t.end);
  if(tasks.length===0){
    wrap.innerHTML = "<div class='gantt-empty'>Aucune tâche datée.</div>";
    return;
  }

  const minStart = tasks.map(t=>new Date(t.start+"T00:00:00")).reduce((a,b)=>a<b?a:b);
  const maxEnd   = tasks.map(t=>new Date(t.end+"T00:00:00")).reduce((a,b)=>a>b?a:b);
  const weeks=[];
  for(let w=startOfWeek(minStart); w<=addDays(startOfWeek(maxEnd),0); w=addDays(w,7)) weeks.push(new Date(w));

  // tri pour conserver l'ordre visuel stable
  tasks.sort((a,b)=>{
    const oa=(taskOrderMap[a.id]||9999)-(taskOrderMap[b.id]||9999);
    if(oa!==0) return oa;
    const sa=Date.parse(a.start||"9999-12-31"), sb=Date.parse(b.start||"9999-12-31");
    if(sa!==sb) return sa-sb;
    return taskTitle(a).localeCompare(taskTitle(b));
  });

  let html="<div class='tablewrap gantt-table'><table class='table'>";
  html+="<thead><tr><th style='width:150px'>Tâche</th><th style='width:120px'>Prestataire</th><th style='width:24px'>Statut</th>";
  weeks.forEach(w=>{
    const info=isoWeekInfo(w);
    const wEnd=endOfWorkWeek(w);
    const range=`${w.toLocaleDateString("fr-FR",{day:"2-digit"})}-${wEnd.toLocaleDateString("fr-FR",{day:"2-digit"})}/${wEnd.toLocaleDateString("fr-FR",{month:"2-digit",year:"2-digit"})}`;
    const weekLabel = `S${String(info.week).padStart(2,"0")}`;
    html+=`<th class="week-cell" data-range="${range}" style='width:72px;color:#111827'>${weekLabel}</th>`;
  });
  html+="</tr></thead><tbody>";

  // Regrouper : même Nom de projet + même Description => même ligne
  const lanesMap = new Map();
  tasks.forEach(t=>{
    const title = ganttLaneTitle(t);
    const key = title.toLowerCase() || "no-title";
    if(!lanesMap.has(key)) lanesMap.set(key,{title, tasks:[]});
    lanesMap.get(key).tasks.push(t);
  });
  const lanes = Array.from(lanesMap.values());
  lanes.forEach(l=>{
    l.tasks.sort((a,b)=>{
      const sa=Date.parse(a.start||"9999-12-31"), sb=Date.parse(b.start||"9999-12-31");
      if(sa!==sb) return sa-sb;
      const ea=Date.parse(a.end||"9999-12-31"), eb=Date.parse(b.end||"9999-12-31");
      if(ea!==eb) return ea-eb;
      return (a.roomNumber||"").localeCompare(b.roomNumber||"");
    });
  });
  lanes.sort((a,b)=>{
    const ma = Math.min(...a.tasks.map(t=>Date.parse(t.start||"9999-12-31")));
    const mb = Math.min(...b.tasks.map(t=>Date.parse(t.start||"9999-12-31")));
    if(ma!==mb) return ma-mb;
    const oa = Math.min(...a.tasks.map(t=>taskOrderMap[t.id]||9999));
    const ob = Math.min(...b.tasks.map(t=>taskOrderMap[t.id]||9999));
    if(oa!==ob) return oa-ob;
    return a.title.localeCompare(b.title);
  });

  lanes.forEach(lane=>{
    const firstTask = lane.tasks[0];
    const firstStatus = parseStatuses(firstTask.status)[0]?.toUpperCase();
    const c = STATUS_COLORS[firstStatus] || "#1f2937";
    const owners = Array.from(new Set(lane.tasks.map(t=>t.owner).filter(Boolean)));
    const ownerBadgeHtml = owners.map(o=>ownerBadge(o)).join(" ");

    const statusSet=new Set();
    lane.tasks.forEach(t=> parseStatuses(t.status).forEach(v=>statusSet.add(v.toUpperCase())));
    const lineStatuses = STATUSES.map(s=>s.v).filter(v=>statusSet.has(v)).sort((a,b)=>{
      const minA = Math.min(...lane.tasks.filter(t=>parseStatuses(t.status).map(x=>x.toUpperCase()).includes(a)).map(t=>Date.parse(t.start||"9999-12-31")));
      const minB = Math.min(...lane.tasks.filter(t=>parseStatuses(t.status).map(x=>x.toUpperCase()).includes(b)).map(t=>Date.parse(t.start||"9999-12-31")));
      if(minA!==minB) return minA-minB;
      const ia = STATUSES.findIndex(s=>s.v===a);
      const ib = STATUSES.findIndex(s=>s.v===b);
      return (ia<0?999:ia)-(ib<0?999:ib);
    });
    const statusText = lineStatuses
      .map(v=> STATUSES.find(s=>s.v===v)?.label || v)
      .map(txt=>`<div class="status-row"><span>${txt}</span></div>`)
      .join("");

    const vendors = Array.from(new Set(lane.tasks.map(t=>t.vendor||"").filter(Boolean))).sort((a,b)=>a.localeCompare(b,"fr",{sensitivity:"base"}));
    const vendorHtml = vendors.length ? vendors.map(v=>`<span class="badge owner" style="background:#4b5563;border-color:#4b5563;color:#fff;">${v}</span>`).join(" ") : "<span class='text-muted'>—</span>";

    html+=`<tr data-lane="${lane.title}">`;
    html+=`<td><b><span class="num-badge" style="--badge-color:${c};--badge-text:#fff;">${taskOrderMap[firstTask.id]||""}</span> <span class="icon-picto">📌</span> ${lane.title}</b><div class="gantt-meta">${ownerBadgeHtml}</div></td>`;
    html+=`<td class="gantt-vendor-cell"><div class="vendor-stack">${vendorHtml}</div></td>`;
    html+=`<td class="gantt-status-cell"><div class="gantt-status-stack">${statusText}</div></td>`;

    weeks.forEach(w=>{
  const rows = lineStatuses.map(st=>{
        const bars = lane.tasks
          .filter(t=> parseStatuses(t.status).map(v=>v.toUpperCase()).includes(st))
          .map(t=>{
            const sDate=new Date(t.start+"T00:00:00");
            const eDate=new Date(t.end+"T00:00:00");
            const geo=barGeometry(sDate,eDate,w);
            const order=Date.parse(t.start||"9999-12-31");
            return {geo,taskId:t.id,order,vendor:t.vendor||""};
          })
          .filter(x=>x.geo.days>0)
          .sort((a,b)=>a.order-b.order);

        if(bars.length===0) return `<div class="gantt-row"><div class="gantt-spacer"></div></div>`;
        const color = STATUS_COLORS[st] || "#1f2937";
        const barHtml = bars.map(seg=>{
          const title = seg.vendor ? ` title="Prestataire : ${attrEscape(seg.vendor)}"` : "";
          return `<div class="bar-wrapper"><div class="gantt-bar bar-click" data-task="${seg.taskId}" data-status="${st}"${title} style="width:${seg.geo.width}%;margin-left:${seg.geo.offset}%;background:${color};border-color:${color}"><span class="gantt-days">${seg.geo.days} j</span></div></div>`;
        }).join("");
        return `<div class="gantt-row">${barHtml}</div>`;
      }).join("");

      html+=`<td class="gantt-cell"><div class="gantt-cell-inner">${rows || `<div class="gantt-spacer"></div>`}</div></td>`;
    });

    html+="</tr>";
  });

  html+="</tbody></table></div>";
  wrap.innerHTML=html;
  wrap.querySelectorAll(".bar-click")?.forEach(bar=>{
    bar.onclick=()=>{
      const taskId = bar.dataset.task;
      const task = state.tasks.find(x=>x.id===taskId);
      if(!task) return;
      selectedProjectId = task.projectId;
      selectedTaskId = taskId;
      renderProject();
    };
  });
}

function exportSvgToPdf(svgId, title="Export"){
  const svg = document.getElementById(svgId);
  if(!svg) return;

  // Cloner et injecter le style indispensable pour l'export (sinon le SVG perd ses classes).
  const clone = svg.cloneNode(true);
  const inlineStyle = `
    * { font-family: "Century Gothic", "Segoe UI", sans-serif; }
    .wl-axis text{font-size:11px;fill:#0f172a;}
    .wl-bg{fill:#ffffff;}
    .wl-bar-internal{fill:#0f172a;}
    .wl-bar-external{fill:#b45309;}
    .wl-grid{stroke:#e5e7eb;stroke-width:1;}
    .wl-grid-vert{stroke:#e5e7eb;stroke-width:1;stroke-dasharray:2 3;}
    .wl-value{font-size:10px;fill:#0f172a;}
  `;
  const styleEl = document.createElement("style");
  styleEl.textContent = inlineStyle;
  clone.insertBefore(styleEl, clone.firstChild);

  const serializer = new XMLSerializer();
  const str = serializer.serializeToString(clone);
  const blob = new Blob([str], {type:"image/svg+xml;charset=utf-8"});
  const url = URL.createObjectURL(blob);
  const img = new Image();
  const { width, height } = svg.getBoundingClientRect();
  const fallbackWidth = svg.viewBox?.baseVal?.width || svg.clientWidth || 900;
  const fallbackHeight = svg.viewBox?.baseVal?.height || svg.clientHeight || 260;
  img.onload = function(){
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.floor(width || fallbackWidth));
    canvas.height = Math.max(1, Math.floor(height || fallbackHeight));
    const ctx = canvas.getContext("2d");
    ctx.fillStyle="#fff";
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.drawImage(img,0,0,canvas.width,canvas.height);
    const data = canvas.toDataURL("image/png");
    const w = window.open("","_blank");
    if(!w) return;
    // Mise en page A4 paysage + centrage
    w.document.write(`
      <title>${title}</title>
      <style>
        @page { size: A4 landscape; margin: 10mm; }
        body{margin:0;padding:0;display:flex;flex-direction:column;align-items:center;font-family:"Century Gothic","Segoe UI",sans-serif;background:#fff;}
        h1{font-size:16px;margin:12px 0;text-align:center;}
        .img-wrap{width:100%;display:flex;justify-content:center;padding:10mm 12mm 12mm;}
        img{max-width:100%;height:auto;}
      </style>
      <h1>${title} (jours)</h1>
      <div class="img-wrap"><img id="__print_img" src="${data}" aria-label="${title}"></div>
    `);
    w.document.close();
    const targetImg = w.document.getElementById("__print_img");
    let printed=false;
    const launchPrint = ()=>{
      if(printed) return;
      printed=true;
      w.focus();
      w.print();
      // refermer la fenêtre d'export après l'impression (ou après un court délai si pas de callback)
      setTimeout(()=>{ try{ w.close(); }catch(e){} }, 800);
    };
    if(targetImg){
      if(targetImg.complete){
        launchPrint();
      }else{
        targetImg.addEventListener("load", ()=>launchPrint(), { once:true });
        // filet de secours en cas d'absence d'événement load
        setTimeout(()=>launchPrint(),500);
      }
    }else{
      launchPrint();
    }
  };
  img.src = url;
}

function renderWorkloadChart(tasks){
  const select = el("workloadGranularity");
  const mode = select?.value || workloadMode || "week";
  workloadMode = mode;
  const data = computeWorkloadData(tasks, mode);
  const svg = el("workloadChart");
  if(!svg) return;
  const w=900, h=260, m={l:60,r:24,t:30,b:54};
  const fontFamily = `"Century Gothic","Segoe UI",sans-serif`;
  svg.setAttribute("viewBox",`0 0 ${w} ${h}`);
  svg.style.fontFamily = fontFamily;
  svg.setAttribute("font-family", fontFamily);
  svg.innerHTML="";
  if(data.length===0){
    svg.innerHTML = `<text x="${w/2}" y="${h/2}" text-anchor="middle" fill="#6b7280" font-size="12">Aucune tâche datée</text>`;
    return;
  }
  const maxVal = niceMax(Math.max(...data.map(d=>d.total),1));
  const chartW = w - m.l - m.r;
  const chartH = h - m.t - m.b;
  const barGap = 6;
  const barW = Math.max(8, Math.min(60, (chartW / data.length) - barGap));
  const xStart = m.l;
  let grid="";
  const ticks=4;
  for(let i=0;i<=ticks;i++){
    const y = m.t + chartH - (i/ticks)*chartH;
    const val = Math.round((i/ticks)*maxVal);
    grid+=`<line class="wl-grid" x1="${m.l}" y1="${y}" x2="${w-m.r}" y2="${y}"></line>`;
    grid+=`<text class="wl-axis" x="${m.l-10}" y="${y+4}" text-anchor="end">${val} j</text>`;
  }
  // vertical guides
  data.forEach((d,idx)=>{
    const x = xStart + idx*(barW+barGap) + barW/2;
    grid+=`<line class="wl-grid-vert" x1="${x}" y1="${m.t}" x2="${x}" y2="${m.t+chartH}"></line>`;
  });

  let bars="";
  data.forEach((d,idx)=>{
    const x = xStart + idx*(barW+barGap);
    let y = m.t + chartH;
    const hInt = (d.internal/maxVal)*chartH;
    const hExt = (d.external/maxVal)*chartH;
    y -= hInt;
    bars+=`<rect class="wl-bar-internal" fill="url(#grad-int)" x="${x}" y="${y}" width="${barW}" height="${hInt}" rx="4" ry="4"></rect>`;
    y -= hExt;
    bars+=`<rect class="wl-bar-external" fill="url(#grad-ext)" x="${x}" y="${y}" width="${barW}" height="${hExt}" rx="4" ry="4"></rect>`;
    const lbl = keyToLabel(d.key, mode);
    const lx = x + barW/2;
    const ly = h - m.b + 14;
    bars+=`<text class="wl-axis" x="${lx}" y="${ly}" text-anchor="middle">${lbl}</text>`;
    bars+=`<text class="wl-value" x="${lx}" y="${m.t + chartH - (d.total/maxVal)*chartH - 6}" text-anchor="middle">${d.total} j</text>`;
  });
  const legend=`<g transform="translate(${w-170},${m.t})">
    <rect class="wl-bar-internal" x="0" y="0" width="12" height="12" rx="3"></rect><text class="wl-axis" x="18" y="11">Interne</text>
    <rect class="wl-bar-external" x="0" y="20" width="12" height="12" rx="3"></rect><text class="wl-axis" x="18" y="31">Externe</text>
  </g>`;
  const defs = `
    <defs>
      <linearGradient id="grad-int" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="#0f172a" stop-opacity="0.95"/>
        <stop offset="100%" stop-color="#1f2937" stop-opacity="0.85"/>
      </linearGradient>
      <linearGradient id="grad-ext" x1="0" x2="0" y1="0" y2="1">
        <stop offset="0%" stop-color="#ca8a04" stop-opacity="0.95"/>
        <stop offset="100%" stop-color="#b45309" stop-opacity="0.85"/>
      </linearGradient>
    </defs>
  `;
  svg.innerHTML = `<rect class="wl-bg" x="0" y="0" width="${w}" height="${h}"></rect>${defs}<g>${grid}</g><g>${bars}</g>${legend}`;
}

function renderFilters(){
  const sel = el("filterProject");
  if(sel){
    let h=`<option value="">Tous</option>`;
    state.projects.forEach(p=>{ h+=`<option value="${p.id}">${p.name||"Sans nom"}</option>`; });
    sel.innerHTML=h;
  }
  const ss = el("filterStatus");
  if(ss){
    let h=`<option value="">Tous</option>`;
    sortedStatuses().forEach(s=>{ h+=`<option value="${s.v}">${s.label}</option>`; });
    ss.innerHTML=h;
  }
}

function renderTabs(){
  const tabs = el("tabs");
  if(!tabs) return;
  const projectIcon = (name="")=>{
    const n=name.toLowerCase();
    if(n.includes("pastorale")) return "⛪";
    return "🏗️";
  };
  let h=`<button class="tab ${selectedProjectId?"":"active"}" data-tab="MASTER"><span class="tab-icon">📊</span> Tableau maître</button>`;
  const projectsSorted = [...state.projects].sort((a,b)=>{
    // date de début minimale des tâches de chaque projet
    const aDates = state.tasks.filter(t=>t.projectId===a.id && t.start).map(t=>Date.parse(t.start));
    const bDates = state.tasks.filter(t=>t.projectId===b.id && t.start).map(t=>Date.parse(t.start));
    const aMin = aDates.length ? Math.min(...aDates) : Infinity;
    const bMin = bDates.length ? Math.min(...bDates) : Infinity;
    if(aMin!==bMin) return aMin - bMin; // plus récent (valeur numérique plus petite) en haut
    return (a.name||"").localeCompare(b.name||"");
  });
  projectsSorted.forEach(p=>{
    h+=`<button class="tab ${selectedProjectId===p.id?"active":""}" data-tab="${p.id}"><span>${p.name||"Projet"}</span><span class="tab-close" data-close="${p.id}" aria-label="Supprimer le projet">✕</span></button>`;
  });
  tabs.innerHTML=h;
  tabs.querySelectorAll("button").forEach(btn=>{
    btn.onclick=()=>{
      const tab=btn.dataset.tab;
      if(tab==="MASTER"){ selectedProjectId=null; selectedTaskId=null; renderAll(); }
      else { selectedProjectId=tab; selectedTaskId=null; renderProject(); }
    };
  });
  tabs.querySelectorAll(".tab-close").forEach(close=>{
    close.onclick=(e)=>{
      e.stopPropagation();
      if(isLocked) return;
      const pid = close.dataset.close;
      if(!pid) return;
      const name = state.projects.find(p=>p.id===pid)?.name || "ce projet";
      if(!confirm(`Supprimer définitivement ${name} et toutes ses tâches ?`)) return;
      state.projects = state.projects.filter(p=>p.id!==pid);
      state.tasks    = state.tasks.filter(t=>t.projectId!==pid);
      if(selectedProjectId===pid) { selectedProjectId=null; selectedTaskId=null; }
      saveState();
      renderAll();
      el("btnNewTask")?.classList.remove("btn-armed");
    };
  });
}

function renderKPIs(tasks){
  const box = el("kpis");
  if(!box) return;
  const total=tasks.length;
  const byStatus={};
  tasks.forEach(t=>{ byStatus[t.status]= (byStatus[t.status]||0)+1; });
  let h=`<div class="kpi">Total: <b>${total}</b></div>`;
  STATUSES.forEach(s=>{
    h+=`<div class="kpi">${s.label}: <b>${byStatus[s.v]||0}</b></div>`;
  });
  box.innerHTML=h;
}

// Tri générique pour tableaux (master & projet)
function sortTasks(list, cfg){
  if(!cfg) return [...list];
  const dir = cfg.dir==="desc" ? -1 : 1;
  const get = (t)=>{
    switch(cfg.key){
      case "site": {
        const p = state.projects.find(x=>x.id===t.projectId);
        return (p?.site||"").toLowerCase();
      }
      case "project": {
        const p = state.projects.find(x=>x.id===t.projectId);
        return (p?.name||"").toLowerCase();
      }
      case "task": return (taskTitle(t)||"").toLowerCase();
      case "status": return (parseStatuses(t.status)[0]||"").toLowerCase();
      case "start": return Date.parse(t.start||"9999-12-31");
      case "end": return Date.parse(t.end||"9999-12-31");
      case "owner": return (t.owner||"").toLowerCase();
      case "duration": return durationDays(t.start,t.end);
      case "num": return taskOrderMap[t.id]||9999;
      default: return 0;
    }
  };
  return [...list].sort((a,b)=>{
    const va=get(a), vb=get(b);
    if(va<vb) return -1*dir;
    if(va>vb) return 1*dir;
    return 0;
  });
}

function updateSortIndicators(tableId, cfg){
  const table = el(tableId);
  if(!table) return;
  table.querySelectorAll("th[data-sort]").forEach(th=>{
    th.classList.remove("sorted-asc","sorted-desc");
    if(th.dataset.sort === cfg.key){
      th.classList.add(cfg.dir==="desc" ? "sorted-desc" : "sorted-asc");
    }
  });
}

function renderMasterMetrics(tasks){
  const metrics = el("masterMetrics");
  if(!metrics) return;
  const dated = tasks.filter(t=>t.start && t.end);
  if(dated.length===0){
    metrics.innerHTML="";
    return;
  }
  const allDays = new Set();
  const internalDays = new Set();
  const externalDays = new Set();
  dated.forEach(t=>{
    const s=new Date(t.start+"T00:00:00");
    const e=new Date(t.end+"T00:00:00");
    if(isNaN(s)||isNaN(e)||e<s) return;
    const ownsInternal = (t.owner||"").toLowerCase().includes("interne");
    const ownsExternal = (t.owner||"").toLowerCase().includes("externe");
    for(let d=new Date(s); d<=e; d.setDate(d.getDate()+1)){
      const key=d.toISOString().slice(0,10);
      allDays.add(key);
      if(ownsInternal) internalDays.add(key);
      if(ownsExternal) externalDays.add(key);
    }
  });
  const totalDays = allDays.size;
  const totalHours = totalDays * 4;
  const internalHours = internalDays.size * 4;
  const externalHours = externalDays.size * 4;
  metrics.innerHTML = `
    <span class="panel-chip">Durée totale : <strong>${totalDays||0} j</strong></span>
    <span class="panel-chip">Éq. heures (4h/j) : <strong>${totalHours||0} h</strong></span>
    <span class="panel-chip" style="background:#0f172a;color:#fff;border-color:#0f172a;">Interne : <strong>${internalDays.size||0} j</strong> • <strong>${internalHours||0} h</strong></span>
    <span class="panel-chip" style="background:#b45309;color:#fff;border-color:#b45309;">Externe : <strong>${externalDays.size||0} j</strong> • <strong>${externalHours||0} h</strong></span>
  `;
}

function filteredTasks(){
  const fp = el("filterProject")?.value || "";
  const fs = el("filterStatus")?.value || "";
  const q  = (el("filterSearch")?.value || "").toLowerCase().trim();
  const startAfter = el("filterStartAfter")?.value || "";
  const endBefore  = el("filterEndBefore")?.value || "";
  const result = state.tasks.filter(t=>{
    if(fp && t.projectId!==fp) return false;
    if(fs && !parseStatuses(t.status).includes(fs)) return false;
    const p = state.projects.find(x=>x.id===t.projectId);
    if(q){
      const hay=(taskTitle(t)+" "+(p?.name||"")+" "+(p?.site||"")+" "+(t.owner||"")+" "+parseStatuses(t.status).join(" ")).toLowerCase();
      if(!hay.includes(q)) return false;
    }
    if(startAfter && (!t.start || t.start < startAfter)) return false;
    if(endBefore && (!t.end || t.end > endBefore)) return false;
    return true;
  });
  // Filet de secours : si les filtres vident tout alors qu'on a des données, on retourne toutes les tâches
  if(result.length===0 && state.tasks.length>0) return state.tasks;
  return result;
}

function updateBadge(node, active, textActive="Tri/filtre actif", textInactive="Tri par défaut"){
  if(!node) return;
  node.textContent = active ? textActive : textInactive;
  node.classList.toggle("inactive", !active);
}

function filtersActive(){
  const fp = el("filterProject")?.value || "";
  const fs = el("filterStatus")?.value || "";
  const q  = (el("filterSearch")?.value || "").trim();
  const startAfter = el("filterStartAfter")?.value || "";
  const endBefore  = el("filterEndBefore")?.value || "";
  return !!(fp || fs || q || startAfter || endBefore);
}

function renderMaster(){
  computeTaskOrderMap();
  renderTabs();
  el("viewMaster")?.classList.remove("hidden");
  el("viewProject")?.classList.add("hidden");
  const tbody = el("masterTable")?.querySelector("tbody");
  if(!tbody) return;
  const tasks = filteredTasks();
  renderKPIs(tasks);
  renderMasterMetrics(tasks);
  // Charge de travail
  const wlSel = el("workloadGranularity");
  if(wlSel && workloadMode) wlSel.value = workloadMode;
  renderWorkloadChart(filteredTasks());
  // Bandeau live global (toutes tâches en cours aujourd'hui)
  const masterLive = el("masterLive");
  if(masterLive){
    const todayKey = new Date().toISOString().slice(0,10);
    const inProgress = tasks
      .filter(t=>t.start && t.end && t.start<=todayKey && t.end>=todayKey)
      .sort((a,b)=> (taskOrderMap[a.id]||999)-(taskOrderMap[b.id]||999));
    if(inProgress.length===0){
      masterLive.innerHTML = `<span class="live-title">Projet non démarré</span>`;
    }else{
      const badges = inProgress.map(t=>{
        const num = taskOrderMap[t.id]||"";
        const status = parseStatuses(t.status)[0] || "";
        const color = STATUS_COLORS[(status||"").toUpperCase()] || "#475569";
        const label = STATUSES.find(s=>s.v===status)?.label || status || "En cours";
        const proj = state.projects.find(x=>x.id===t.projectId);
        const projName = proj?.name || "Projet";
        return `<span class="live-item"><span class="num-badge" style="--badge-color:${color};--badge-text:#fff;">${num}</span> ${projName} — ${label}</span>`;
      }).join(" ");
      masterLive.innerHTML = `<span class="live-title">Projet démarré • Tâches en cours :</span> ${badges}`;
    }
  }
  const sorted = sortTasks(tasks, sortMaster);
  if(sorted.length===0){
    tbody.innerHTML="<tr><td colspan='8' class='empty-row'>Aucune tâche.</td></tr>";
    return;
  }
  let h="";
  sorted.forEach(t=>{
    const p = state.projects.find(x=>x.id===t.projectId);
    const statuses = parseStatuses(t.status).map(v=>v.toUpperCase());
    const c = STATUS_COLORS[statuses[0]] || "#1f2937";
    const rowBg = siteColor(p?.site);
    h+=`<tr data-project="${t.projectId}" data-task="${t.id}" style="--site-bg:${rowBg};background:var(--site-bg);">
      <td>${p?.site||""}</td>
      <td>${p?.name||"Sans projet"}</td>
      <td><span class="num-badge" style="--badge-color:${c};--badge-text:#fff;">${taskOrderMap[t.id]||""}</span> <span class="icon-picto">📌</span> ${taskTitle(t)}</td>
      <td class="status-cell"><span class="status-left">${statusDot(statuses[0])}${statusLabels(t.status||"")}</span>${t.owner?ownerBadge(t.owner):""}</td>
      <td>${formatDate(t.start)||""}</td>
      <td>${formatDate(t.end)||""}</td>
      <td>${t.owner||""}</td>
      <td>${durationDays(t.start,t.end)}</td>
    </tr>`;
  });
  tbody.innerHTML=h;

  // Gantt global sous le tableau maître
  renderMasterGantt();
  updateSortIndicators("masterTable", sortMaster);
  const fb = el("filtersBadge");
  if(fb){
    const active = filtersActive() || sortMaster.key!=="project" || sortMaster.dir!=="asc";
    updateBadge(fb, active, "Tri/filtre actif", "Tri par défaut");
  }
}

function renderProject(){
  computeTaskOrderMap();
  renderTabs();
  const p=state.projects.find(x=>x.id===selectedProjectId);
  if(!p){ selectedProjectId=null; renderMaster(); return; }
  el("viewMaster")?.classList.add("hidden");
  el("viewProject")?.classList.remove("hidden");
  el("projectTitle").textContent = `Projet : ${p.name||"Sans nom"}`;
  el("projectSub").textContent = p.site || "Détails • Gantt";
  // métriques projet : durée totale + équivalent heures (6h/j)
  const projTasks = state.tasks.filter(t=>t.projectId===p.id && t.start && t.end);
  const allDays = new Set();
  const internalDays = new Set();
  const externalDays = new Set();
  projTasks.forEach(t=>{
    const s=new Date(t.start+"T00:00:00");
    const e=new Date(t.end+"T00:00:00");
    if(isNaN(s)||isNaN(e) || e<s) return;
    const ownsInternal = (t.owner||"").toLowerCase().includes("interne");
    const ownsExternal = (t.owner||"").toLowerCase().includes("externe");
    for(let d=new Date(s); d<=e; d.setDate(d.getDate()+1)){
      const key=d.toISOString().slice(0,10);
      allDays.add(key);
      if(ownsInternal) internalDays.add(key);
      if(ownsExternal) externalDays.add(key);
    }
  });
  const totalDays = allDays.size;
  const totalHours = totalDays * 4;
  const internalHours = internalDays.size * 4;
  const externalHours = externalDays.size * 4;
  const metrics = el("projectMetrics");
  if(metrics){
    metrics.innerHTML = `
      <span class="panel-chip">Durée totale : <strong>${totalDays || 0} j</strong></span>
      <span class="panel-chip">Éq. heures (4h/j) : <strong>${totalHours || 0} h</strong></span>
      <span class="panel-chip" style="background:#0f172a;color:#fff;border-color:#0f172a;">Interne : <strong>${internalDays.size||0} j</strong> • <strong>${internalHours||0} h</strong></span>
      <span class="panel-chip" style="background:#b45309;color:#fff;border-color:#b45309;">Externe : <strong>${externalDays.size||0} j</strong> • <strong>${externalHours||0} h</strong></span>
    `;
  }

  // Bandeau live : tâches en cours à la date du jour
  const live = el("projectLive");
  if(live){
    const todayKey = new Date().toISOString().slice(0,10);
    const inProgress = state.tasks
      .filter(t=>t.projectId===p.id && t.start && t.end && t.start<=todayKey && t.end>=todayKey)
      .sort((a,b)=> (taskOrderMap[a.id]||999)-(taskOrderMap[b.id]||999));
    if(inProgress.length===0){
      live.innerHTML = `<span class="live-title">Projet non démarré</span>`;
    }else{
      const badges = inProgress.map(t=>{
        const num = taskOrderMap[t.id]||"";
        const status = parseStatuses(t.status)[0] || "";
        const color = STATUS_COLORS[(status||"").toUpperCase()] || "#475569";
        const label = STATUSES.find(s=>s.v===status)?.label || status || "En cours";
        const projName = p.name || "Projet";
        return `<span class="live-item"><span class="num-badge" style="--badge-color:${color};--badge-text:#fff;">${num}</span> ${projName} — ${label}</span>`;
      }).join(" ");
      live.innerHTML = `<span class="live-title">Projet démarré • Tâches en cours :</span> ${badges}`;
    }
  }
  el("p_name").value=p.name||"";
  el("p_subproject").value=p.subproject||"";
  el("p_site").value=p.site||"";
  el("p_constraints").value=p.constraints||"";

  let t=null;
  if(selectedTaskId){
    t = state.tasks.find(x=>x.id===selectedTaskId && x.projectId===p.id) || null;
  }
  if(!t){
    t = state.tasks.find(x=>x.projectId===p.id) || null;
  }
  selectedTaskId = t?.id || null;
  const badge = el("t_num_badge");
  if(badge){
    const num = selectedTaskId ? (taskOrderMap[selectedTaskId] || "") : "";
    badge.textContent = num;
    badge.style.display = num ? "inline-flex" : "none";
  }
  if(!selectedTaskId){
    el("btnNewTask")?.classList.add("btn-armed");
  }else{
    el("btnNewTask")?.classList.remove("btn-armed");
  }

  if(t){
    const desc = (t.roomNumber && t.roomNumber.trim()) || p.subproject || "";
    el("t_room").value=desc;
    el("t_owner").value=t.owner||"";
    el("t_vendor").value=t.vendor||"";
    el("t_start").value=formatDate(t.start)||"";
    el("t_end").value=formatDate(t.end)||"";
    setStatusSelection(t.status||"");
  }else{
    el("t_room").value=""; el("t_owner").value=""; el("t_vendor").value=""; el("t_start").value=""; el("t_end").value="";
    setStatusSelection("");
  }

  renderGantt(p.id);
  renderProjectTasks(p.id);
  refreshVendorsList();
}

function renderAll(){
  // filet de sécurité : si localStorage est vide (ex : fichier ouvert en navigation privée), on recharge l'état par défaut
  if(!state || !Array.isArray(state.projects) || state.projects.length===0){
    state = defaultState();
  }
  refreshVendorsList();
  // réinitialiser les filtres visibles pour éviter un filtrage bloquant
  ["filterProject","filterStatus","filterSearch","filterStartAfter","filterEndBefore"].forEach(id=>{
    const n=el(id);
    if(n) n.value="";
  });
  renderFilters();
  renderTabs();
  if(selectedProjectId) renderProject();
  else renderMaster();
}

function bind(){
  buildStatusMenu();
  setStatusSelection("");
  el("t_status_display")?.addEventListener("click",(e)=>{ e.stopPropagation(); toggleStatusMenu(true); });
  document.addEventListener("click",(e)=>{
    const wrap = el("t_status_wrap");
    if(wrap && !wrap.contains(e.target)){ toggleStatusMenu(false); }
  });

  el("btnSave")?.addEventListener("click", ()=>{
    if(isLocked) return;
    saveState();
    // Flux simple : téléchargement d'un JSON à écraser manuellement dans le dossier projet.
    downloadBackup();
    flashSaved();
    renderAll();
    el("btnNewTask")?.classList.remove("btn-armed");
  });
  // bouton impression PDF (utilise print.css)
  el("btnBack")?.addEventListener("click", ()=>{
    selectedProjectId=null; selectedTaskId=null;
    renderAll();
  });
  el("btnProjectExport")?.addEventListener("click", ()=>{
    preparePrint();
    window.print();
  });
  el("btnExportMaster")?.addEventListener("click", ()=>{
    selectedProjectId = null;
    preparePrint();
    window.print();
  });
  el("workloadGranularity")?.addEventListener("change", ()=>{
    workloadMode = el("workloadGranularity")?.value || "week";
    renderWorkloadChart(filteredTasks());
  });
  el("btnExportWorkload")?.addEventListener("click", ()=>{
    exportSvgToPdf("workloadChart","Charge de travail");
  });
  el("btnAddProject")?.addEventListener("click", ()=>{
    if(isLocked) return;
    const id = uid();
    const name = "Nouveau projet";
    state.projects.push({id,name,site:"",constraints:"",subproject:""});
    selectedProjectId = id;
    selectedTaskId = null;
    markDirty();
    renderAll();
  });
  el("btnSaveProject")?.addEventListener("click", ()=>{
    if(isLocked) return;
    if(!selectedProjectId) return;
    const p = state.projects.find(x=>x.id===selectedProjectId);
    if(!p) return;
    p.name        = el("p_name").value.trim();
    p.subproject  = el("p_subproject").value.trim();
    p.site        = el("p_site").value.trim();
    p.constraints = el("p_constraints").value.trim();
    renderTabs();
    markDirty();
    renderProject();
  });
  el("btnDeleteProject")?.addEventListener("click", ()=>{
    if(isLocked) return;
    if(!selectedProjectId) return;
    if(!confirm("Supprimer ce projet et toutes ses tâches ? Cette action est définitive.")) return;
    state.projects = state.projects.filter(p=>p.id!==selectedProjectId);
    state.tasks    = state.tasks.filter(t=>t.projectId!==selectedProjectId);
    selectedProjectId=null;
    selectedTaskId=null;
    markDirty();
    renderAll();
  });
  el("btnAddTask")?.addEventListener("click", ()=>{
    if(isLocked) return;
    if(!selectedProjectId) return;
    const id=uid();
    state.tasks.push({id,projectId:selectedProjectId,roomNumber:"",status:"",owner:"",start:"",end:"",notes:""});
    selectedTaskId=id;
    markDirty();
    renderProject();
  });
  el("btnNewTask")?.addEventListener("click", ()=>{
    if(isLocked) return;
    // Dupliquer les valeurs affichées pour faciliter la création en série
    selectedTaskId=null;
    el("btnNewTask")?.classList.add("btn-armed");
  });
  el("btnDeleteTask")?.addEventListener("click", ()=>{
    if(isLocked) return;
    if(!selectedProjectId || !selectedTaskId) return;
    if(!confirm("Supprimer cette tâche ?")) return;
    state.tasks = state.tasks.filter(t=> !(t.id===selectedTaskId && t.projectId===selectedProjectId));
    selectedTaskId = null;
    markDirty();
    renderProject();
    el("btnNewTask")?.classList.remove("btn-armed");
  });
  el("btnSaveTask")?.addEventListener("click", ()=>{
    if(isLocked) return;
    if(!selectedProjectId) return;
    let t = state.tasks.find(x=>x.id===selectedTaskId && x.projectId===selectedProjectId);
    if(!t){
      const id=uid();
      t={id,projectId:selectedProjectId}; state.tasks.push(t); selectedTaskId=id;
    }
    t.roomNumber = el("t_room").value.trim();
    t.owner      = el("t_owner").value;
    t.vendor     = el("t_vendor").value.trim();
    t.start      = unformatDate(el("t_start").value);
    t.end        = unformatDate(el("t_end").value);
    if(t.end && t.start && t.end < t.start){
      t.end = t.start;
      el("t_end").value = formatDate(t.start);
      console.warn("Date de fin ajustée à la date de début pour éviter une fin antérieure.");
    }
    t.status     = Array.from(selectedStatusSet).join(",");
    markDirty();
    renderProject();
    refreshVendorsList();
  });
  ["filterProject","filterStatus","filterSearch","filterStartAfter","filterEndBefore"].forEach(id=>{
    const n=el(id); 
    if(n) n.addEventListener("input", ()=>{ renderMaster(); saveUIState(); markDirty(); });
  });
  setupVendorPicker();
  // Affichage date du jour + copyright
  const brandSub = el("brandSub");
  if(brandSub){
    const today = new Date();
    const fmt = today.toLocaleDateString("fr-FR",{weekday:"long", day:"2-digit", month:"long", year:"numeric"});
    brandSub.innerHTML = `Tableau maître • Projets • Gantt • Exports locaux • <span class="brand-date">${fmt}</span>`;
  }
  const brandTitle = el("brandTitle");
  if(brandTitle){
    brandTitle.innerHTML = `Suivi de Chantiers <span class="copyright">© Sébastien DUC</span>`;
  }
  // flatpickr sur les dates, week-ends interdits
  const fpOpts = {
    dateFormat:"Y-m-d",
    altInput:true,
    altFormat:"d/m/Y",
    allowInput:true,
    locale:"fr",
    disable:[ function(date){ const d=date.getDay(); return d===0 || d===6; } ]
  };
  let fpStart=null, fpEnd=null;
  if(window.flatpickr){
    const startNode = el("t_start");
    const endNode   = el("t_end");
    const todayIso = new Date().toISOString().slice(0,10);
    const startIso = startNode?.value ? unformatDate(startNode.value) : "";
    const endIso   = endNode?.value ? unformatDate(endNode.value) : "";
    if(startNode){
      fpStart = window.flatpickr(startNode, {...fpOpts,
        defaultDate: startIso || todayIso,
        onOpen: (_s,_d,inst)=>{ inst.jumpToDate(startIso || todayIso); },
        onChange:(selectedDates, dateStr)=>{
          if(fpEnd) fpEnd.set("minDate", dateStr || null);
          if(endNode && dateStr){
            const startVal = startNode.value;
            const endVal = endNode.value;
            if(startVal && (!endVal || unformatDate(endVal) < unformatDate(startVal))){
              endNode.value = startVal;
            }
          }
        }
      });
    }
    if(endNode){
      fpEnd = window.flatpickr(endNode, {...fpOpts,
        defaultDate: endIso || startIso || todayIso,
        minDate: startIso || null,
        onOpen: (_s,_d,inst)=>{ const target = startIso || endIso || todayIso; inst.jumpToDate(target); }
      });
    }
    ["filterStartAfter","filterEndBefore"].forEach(id=>{
      const node=el(id);
      if(node) window.flatpickr(node, fpOpts);
    });
  }

  // Repositionnement du menu multiselect en fixed (pour qu'il reste au-dessus)
  const statusMenu = el("t_status_menu");
  const statusDisplay = el("t_status_display");
  if(statusMenu && statusDisplay){
    let portal = null;
    const ensurePortal = ()=>{
      if(portal) return portal;
      portal = document.createElement("div");
      portal.style.position="fixed";
      portal.style.zIndex="200000";
      portal.style.left="0";
      portal.style.top="0";
      document.body.appendChild(portal);
      return portal;
    };
    const placeMenu = ()=>{
      const rect = statusDisplay.getBoundingClientRect();
      const p = ensurePortal();
      p.style.width = `${rect.width}px`;
      p.style.left = `${rect.left}px`;
      p.style.top = `${rect.bottom + 4}px`;
      statusMenu.style.width = `${rect.width}px`;
    };
    const openMenu = ()=>{
      placeMenu();
      const p = ensurePortal();
      p.appendChild(statusMenu);
      statusMenu.classList.remove("hidden");
      statusDisplay.classList.add("focus");
    };
    const closeMenu = ()=>{
      statusMenu.classList.add("hidden");
      statusDisplay.appendChild(statusMenu);
      statusDisplay.classList.remove("focus");
    };
    statusDisplay.addEventListener("click",(e)=>{ e.stopPropagation(); openMenu(); });
    document.addEventListener("click",(e)=>{
      if(!statusDisplay.contains(e.target) && !statusMenu.contains(e.target)){
        closeMenu();
      }
    });
    window.addEventListener("resize", placeMenu);
    window.addEventListener("scroll", placeMenu, true);
  }
  el("masterTable")?.addEventListener("click",(e)=>{
    const row=e.target.closest("tr[data-project]");
    if(!row) return;
    selectedProjectId=row.dataset.project;
    selectedTaskId=row.dataset.task;
    renderProject();
  });
  el("masterTable")?.querySelectorAll("thead th[data-sort]")?.forEach(th=>{
    th.addEventListener("click", ()=>{
      const key = th.dataset.sort;
      if(sortMaster.key===key) sortMaster.dir = sortMaster.dir==="asc"?"desc":"asc";
      else { sortMaster.key=key; sortMaster.dir="asc"; }
      renderMaster();
      updateSortIndicators("masterTable", sortMaster);
      markDirty();
    });
  });
  el("btnResetSortMaster")?.addEventListener("click", ()=>{
    sortMaster = {key:"project", dir:"asc"};
    renderMaster();
    updateSortIndicators("masterTable", sortMaster);
    const fb = el("filtersBadge");
    if(fb) updateBadge(fb, false, "Tri/filtre actif", "Tri par défaut");
    markDirty();
  });
  el("projectTasksTable")?.addEventListener("click",(e)=>{
    const row=e.target.closest("tr[data-task]");
    if(!row) return;
    selectedTaskId=row.dataset.task;
    renderProject();
  });
  el("projectTasksTable")?.querySelectorAll("thead th[data-sort]")?.forEach(th=>{
    th.addEventListener("click", ()=>{
      const key = th.dataset.sort;
      if(sortProject.key===key) sortProject.dir = sortProject.dir==="asc"?"desc":"asc";
      else { sortProject.key=key; sortProject.dir="asc"; }
      renderProjectTasks(selectedProjectId);
      updateSortIndicators("projectTasksTable", sortProject);
      markDirty();
    });
  });
  el("btnResetSortProject")?.addEventListener("click", ()=>{
    sortProject = {key:"num", dir:"asc"};
    renderProjectTasks(selectedProjectId);
    updateSortIndicators("projectTasksTable", sortProject);
    markDirty();
  });

  // Alerte fermeture si modifications non sauvegardées
  window.addEventListener("beforeunload",(e)=>{
    if(unsavedChanges){
      e.preventDefault();
      e.returnValue="";
    }
  });

  // état visuel du bouton Sauvegarder au démarrage
  updateSaveButton();
}

load();
bind();
renderAll();

// Préparation impression : cartouche + légende
function preparePrint(){
  document.body.classList.add("print-mode");
  const tpl = document.getElementById("printTemplate");
  if(!tpl) return;
  let container = document.getElementById("printInjection");
  if(!container){
    container = document.createElement("div");
    container.id="printInjection";
    document.body.prepend(container);
  }
  container.innerHTML = tpl.innerHTML;
  const header = container.querySelector("#printHeader");
  const meta = container.querySelector("#printMeta");
  const legend = container.querySelector("#printLegend");

  const today = new Date().toLocaleDateString("fr-FR",{day:"2-digit",month:"short",year:"numeric"});
  const currentProject = selectedProjectId ? state.projects.find(p=>p.id===selectedProjectId) : null;

  header.querySelector("h1").textContent = currentProject ? `Projet : ${currentProject.name||"Sans nom"}` : "Tableau maître";
  const metaRows = [
    ["Sous-projet", currentProject?.subproject || "-"],
    ["Site / Zone", currentProject?.site || "-"],
    ["Date export", today],
    ["Nombre de tâches", currentProject ? state.tasks.filter(t=>t.projectId===currentProject.id).length : state.tasks.length]
  ];
  meta.innerHTML = metaRows.map(([k,v])=>`<div><strong>${k}</strong><br>${v}</div>`).join("");

  if(legend){
    legend.innerHTML = STATUSES.map(s=>{
      const c = STATUS_COLORS[s.v] || "#2563eb";
      return `<span class="legend-item"><span class="legend-dot" style="background:${c};border-color:${c}"></span><span>${s.label}</span></span>`;
    }).join("");
  }

  // Contenu imprimé : selon qu'on est sur le maître ou un projet
  container.querySelectorAll(".print-dynamic").forEach(n=>n.remove());
  if(!selectedProjectId){
    const wrap = document.createElement("div"); wrap.className="print-dynamic";
    const tableWrap = document.querySelector("#masterTable")?.closest(".tablewrap");
    if(tableWrap) wrap.appendChild(tableWrap.cloneNode(true));
    const ganttCard = document.querySelector("#masterGantt")?.closest(".card");
    if(ganttCard) wrap.appendChild(ganttCard.cloneNode(true));
    container.querySelector(".print-order")?.appendChild(wrap);
  }else{
    // Projet : réutiliser l'affichage courant (table tâches + gantt projet)
    const wrap = document.createElement("div"); wrap.className="print-dynamic";
    const projTable = document.querySelector("#projectTasksTable")?.closest(".card");
    if(projTable) wrap.appendChild(projTable.cloneNode(true));
    const projGantt = document.querySelector("#gantt")?.closest(".card");
    if(projGantt){
      const clone = projGantt.cloneNode(true);
      // éviter la double légende : on garde celle du cartouche principal
      clone.querySelectorAll("#legend").forEach(n=>n.remove());
      wrap.appendChild(clone);
    }
    container.querySelector(".print-order")?.appendChild(wrap);
  }
}

function cleanupPrint(){
  document.body.classList.remove("print-mode");
  const container = document.getElementById("printInjection");
  if(container) container.innerHTML = "";
}

if(typeof window !== "undefined"){
  window.onafterprint = cleanupPrint;
}


