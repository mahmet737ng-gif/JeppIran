/* JEPPIRAN ADMIN HOME QA
 * Works ONLY in /admin-test/, preserves production Home, and REUSES existing
 * local QA subscription controls. This is NOT real admin authentication.
 */
(function(){
  "use strict";
  if(window.JEPPIRAN_TEST_ADMIN!==true || !location.pathname.includes("/admin-test/"))return;

  const byId=id=>document.getElementById(id);
  const legacyButton=byId("jpAdminTestBtn");
  const legacyPanel=byId("jpAdminTestPanel");
  const legacyBackdrop=byId("jpAdminTestBackdrop");
  const home=byId("homeView");
  const tiles=home?.querySelector(".home-tiles");
  const app=byId("app");
  const topActions=document.querySelector(".top-actions");
  if(!legacyButton||!legacyPanel||!legacyBackdrop||!tiles||!app||!topActions)return;

  const SESSION_KEY="jeppiran-admin-qa-signed-in-v1";
  const ROLE_KEY="jeppiran-admin-qa-view-v2";
  const VALID=new Set(["admin","premium","demo"]);
  let role=null;
  try {
    const stored=sessionStorage.getItem(SESSION_KEY);
    if(VALID.has(stored))role=stored;
  }catch(_){}
  // A QA role is never a real authorization claim.
  window.JEPPIRAN_QA_AUTHENTICATED=false;
  const isAdmin=()=>role==="admin";

  // Move existing working browser-local subscriber panel into a full-page
  // workspace, preserving the existing Save/Renew/Delete handlers.
  const adminView=document.createElement("main");
  adminView.id="adminQaView";
  adminView.className="view";
  adminView.setAttribute("aria-label","JEPPIRAN Admin QA dashboard");
  adminView.innerHTML=
    '<div class="qa-dashboard-inner">'+
      '<header class="qa-dashboard-header">'+
        '<div><span class="qa-env">QA ENVIRONMENT · LOCAL TEST DATA ONLY</span>'+
        '<h1>Admin Dashboard</h1>'+
        '<p>Manage test accounts, plans and subscription validity.</p></div>'+
        '<div class="qa-dashboard-actions">'+
          '<button type="button" id="qaDashboardSignOut">Sign out</button>'+
          '<button type="button" id="qaDashboardHome">← Home</button>'+
        '</div>'+
      '</header>'+
      '<div id="qaDashboardContent"></div>'+
    '</div>';
  const dialog=document.createElement("dialog");
  dialog.id="qaSigninDialog";
  dialog.setAttribute("aria-labelledby","qaSigninTitle");
  dialog.innerHTML=
    '<div class="qa-signin-content">'+
      '<h2 id="qaSigninTitle">JEPPIRAN · Test Sign In</h2>'+
      '<p>This is a public UI demonstration. It does not check real passwords or grant real administrator permissions.</p>'+
      '<div class="qa-identity-grid">'+
        '<button type="button" data-qa-signin="admin"><b>Admin QA</b><small>Show Admin tile and test user controls</small></button>'+
        '<button type="button" data-qa-signin="premium"><b>Premium QA</b><small>Standard six Home features</small></button>'+
        '<button type="button" data-qa-signin="demo"><b>Demo QA</b><small>Preview restricted chart actions</small></button>'+
      '</div>'+
      '<button type="button" id="qaSigninCancel">Cancel</button>'+
    '</div>';
  const signInButton=document.createElement("button");
  signInButton.id="qaAccountButton";
  signInButton.className="icon-btn";
  signInButton.type="button";
  signInButton.textContent="Sign in · QA";
  signInButton.setAttribute("aria-haspopup","dialog");
  signInButton.setAttribute("aria-controls","qaSigninDialog");

  const tile=document.createElement("button");
  tile.id="adminQaHomeBtn";
  tile.className="home-card qa-admin-home-tile";
  tile.type="button";
  tile.hidden=true;
  tile.innerHTML='<span class="card-icon" aria-hidden="true">⚿</span>'+
    '<span><b>ADMIN</b><small>Users · Subscriptions · Access control</small></span>';

  tiles.appendChild(tile);
  app.appendChild(adminView);
  document.body.appendChild(dialog);
  // Home deliberately hides the global topbar; keep QA sign-in visible outside it.
  document.body.appendChild(signInButton);
  const dashboardContent=byId("qaDashboardContent");
  dashboardContent.appendChild(legacyPanel);
  legacyPanel.setAttribute("role","region");
  legacyPanel.setAttribute("aria-modal","false");
  legacyPanel.setAttribute("aria-label","QA users and subscriptions");
  // The previous bottom-left floating Admin panel is superseded by the Home tile.
  legacyButton.hidden=true;
  legacyButton.style.setProperty("display","none","important");
  legacyBackdrop.hidden=true;
  legacyBackdrop.style.setProperty("display","none","important");

  function syncTile(){
    tile.hidden=!isAdmin();
    signInButton.textContent=role?("QA · "+role.toUpperCase()):"Sign in · QA";
    signInButton.setAttribute("aria-label",role?"Change QA test identity":"Choose QA test identity");
    byId("qaDashboardSignOut").hidden=!role;
  }
  function hideLegacy(){
    if(!legacyPanel.hidden){
      // Reuses original listener to keep internal state consistent.
      legacyButton.click();
    }
    legacyBackdrop.hidden=true;
  }
  function goHome(replace=false){
    hideLegacy();
    adminView.classList.remove("active");
    const routeButton=home.querySelector('[data-route="home"]')||document.querySelector('.brand[data-route="home"]');
    if(routeButton && window.JEPPIRAN_NAV_READY)routeButton.click();
    else {
      document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
      home.classList.add("active");
      const fn=replace?"replaceState":"pushState";
      if(location.hash!=="#home")history[fn]({route:"home"},"","#home");
    }
    syncTile();
  }
  function showDashboard(push=true){
    if(!isAdmin()){goHome(true);return}
    // Built-in app router does not know about the QA dashboard, so this page
    // is displayed locally without altering the production router.
    document.querySelectorAll(".view").forEach(v=>v.classList.remove("active"));
    document.body.classList.remove("viewer-fullscreen");
    adminView.classList.add("active");
    if(legacyPanel.hidden) legacyButton.click();
    legacyBackdrop.hidden=true;
    if(push && location.hash!=="#admin-qa")history.pushState({route:"admin-qa"},"","#admin-qa");
    window.scrollTo(0,0);
  }
  function setRole(next){
    if(!VALID.has(next))return;
    role=next;
    try{sessionStorage.setItem(SESSION_KEY,next)}catch(_){}
    // The existing QA preview uses this role to gate synthetic chart clicks.
    const originalRole=byId("qaRole");
    if(originalRole){
      originalRole.value=next;
      originalRole.dispatchEvent(new Event("change",{bubbles:true}));
    }else{
      try{sessionStorage.setItem(ROLE_KEY,next)}catch(_){}
      document.body.dataset.jeppiranTestRole=next;
    }
    syncTile();
    dialog.close();
    goHome();
    if(next==="admin")showDashboard();
  }
  function signOut(){
    role=null;
    try{sessionStorage.removeItem(SESSION_KEY);sessionStorage.removeItem(ROLE_KEY)}catch(_){}
    // Reset QA preview to Demo to avoid leaving local chart-controls in Admin.
    const originalRole=byId("qaRole");
    if(originalRole){
      originalRole.value="demo";
      originalRole.dispatchEvent(new Event("change",{bubbles:true}));
    }
    syncTile();
    goHome();
  }
  signInButton.addEventListener("click",()=>dialog.showModal());
  dialog.querySelectorAll("[data-qa-signin]").forEach(b=>
    b.addEventListener("click",()=>setRole(b.dataset.qaSignin)));
  byId("qaSigninCancel").addEventListener("click",()=>dialog.close());
  tile.addEventListener("click",()=>showDashboard());
  byId("qaDashboardHome").addEventListener("click",()=>goHome());
  byId("qaDashboardSignOut").addEventListener("click",signOut);
  // Also keep the old role selector in sync if the owner changes it in Admin.
  const roleSelect=byId("qaRole");
  roleSelect?.addEventListener("change",()=>{
    if(!role)return;
    const next=roleSelect.value;
    if(!VALID.has(next))return;
    role=next;
    try{sessionStorage.setItem(SESSION_KEY,next)}catch(_){}
    syncTile();
    if(!isAdmin() && adminView.classList.contains("active"))goHome();
  });
  // Real app nav routes remain native, but Home tile must never be visible
  // outside the QA Admin session. Browser back/forward supports our QA route.
  window.addEventListener("popstate",()=>{
    if(location.hash==="#admin-qa"){
      queueMicrotask(()=>{if(isAdmin())showDashboard(false);else goHome(true)});
    }else if(adminView.classList.contains("active")){
      hideLegacy();
      adminView.classList.remove("active");
      syncTile();
    }
  });
  syncTile();
  // Anonymous QA visitors start in Demo; no Admin UI appears until test sign-in.
  if(roleSelect){
    roleSelect.value=role||"demo";
    roleSelect.dispatchEvent(new Event("change",{bubbles:true}));
  }
  if(location.hash==="#admin-qa" && isAdmin()) queueMicrotask(()=>showDashboard(false));
  else if(location.hash==="#admin-qa")goHome(true);
  // The test entry opens on Home rather than in a floating admin overlay.
})();