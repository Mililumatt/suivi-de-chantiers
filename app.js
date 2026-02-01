/* =========================================================
   SUIVI DE CHANTIERS – VERSION PROD GITHUB PAGES
   - AUCUN JSON LOCAL
   - SUPABASE = source unique
   - RENDU UI GARANTI
========================================================= */

const el = (id)=>document.getElementById(id);

/* ===============================
   ETAT GLOBAL (INITIAL)
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
   SUPABASE CONFIG
================================ */
const SUPABASE_URL  = "https://uioqchhbakcvemknqikh.supabase.co";
const SUPABASE_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVpb3FjaGhiYWtjdmVta25xaWtoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3NjA4MTUsImV4cCI6MjA4NTMzNjgxNX0.W345e_uwKLGaFcP9KAZq0kNECBUSFluh2ErgHaHeO5w";
const SUPABASE_TABLE = "app_states";

const AUTO_EMAIL = "sebastien_duc@outlook.fr";
const AUTO_PASSWORD = "Mililum@tt45";

let sb = null;

/* ===============================
   SUPABASE CLIENT
================================ */
function getSB(){
  if(sb) return sb;
  if(!window.supabase) return null;
  sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
  return sb;
}

async function ensureSession(){
  const s = getSB();
  if(!s) return null;

  const sess = await s.auth.getSession();
  if(sess.data.session) return sess.data.session;

  if(AUTO_EMAIL && AUTO_PASSWORD){
    const res = await s.auth.signInWithPassword({
      email: AUTO_EMAIL,
      password: AUTO_PASSWORD
    });
    return res.data.session || null;
  }
  return null;
}

/* ===============================
   SUPABASE LOAD / SAVE
================================ */
async function loadFromSupabase(){
  const s = getSB();
  if(!s) return;

  const session = await ensureSession();
  if(!session) return;

  const { data } = await s
    .from(SUPABASE_TABLE)
    .select("state_json")
    .eq("user_id", session.user.id)
    .maybeSingle();

  if(data && data.state_json){
    state = normalizeState(data.state_json);
    renderAll();
    dirty = false;
  }
}

async function saveToSupabase(){
  const s = getSB();
  if(!s) return;

  const session = await ensureSession();
  if(!session) return;

  await s.from(SUPABASE_TABLE).upsert({
    user_id: session.user.id,
    state_json: state,
    updated_at: new Date().toISOString()
  }, { onConflict: "user_id" });

  dirty = false;
}

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
   PLACEHOLDERS RENDU
   (tes fonctions EXISTENT déjà
    dans ton fichier original)
================================ */
// renderAll()
// renderMaster()
// renderProject()
// bind()
// etc.

/* ===============================
   BOOTSTRAP (CRITIQUE)
================================ */
document.addEventListener("DOMContentLoaded", () => {
  // RENDU IMMEDIAT (UI visible)
  try {
    renderAll();
  } catch(e){
    console.error("Render initial failed", e);
  }

  // BIND EVENTS
  try {
    bind();
  } catch(e){
    console.error("Bind failed", e);
  }

  // SUPABASE EN ARRIERE-PLAN
  loadFromSupabase();

  // SAVE
  const btnSave = el("btnSave");
  if(btnSave){
    btnSave.onclick = ()=>saveToSupabase();
  }
});
