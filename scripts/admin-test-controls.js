/* JEPPIRAN ADMIN TEST: local-browser-only subscription simulator.
   No privileged server API exists here; all users are synthetic QA records. */
(function(){
  "use strict";
  if(window.JEPPIRAN_TEST_ADMIN!==true||!location.pathname.includes("/admin-console/"))return;
  const STORE="jeppiran-admin-qa-users-v2",ROLE="jeppiran-admin-qa-view-v2";
  function future(days){const d=new Date();d.setDate(d.getDate()+days);return d.toISOString().slice(0,10)}
  function seeds(){return [
    {user:"qa-demo",plan:"demo",expiry:"",enabled:true},
    {user:"qa-premium",plan:"monthly",expiry:future(30),enabled:true},
    {user:"qa-annual",plan:"annual",expiry:future(365),enabled:true},
    {user:"qa-expired",plan:"monthly",expiry:"2025-01-01",enabled:true}
  ]}
  let users=seeds(),chosen="qa-demo",view="admin";
  try{const old=JSON.parse(localStorage.getItem(STORE));if(Array.isArray(old))users=old;
      const v=sessionStorage.getItem(ROLE);if(["admin","premium","demo"].includes(v))view=v}catch(_){}
  const style=document.createElement("style");style.textContent=[
    "#jpAdminTestBtn{position:fixed;z-index:2147483000;left:12px;bottom:12px;min-height:46px;padding:10px 15px;background:#0b4764;border:1px solid #7de6ff;border-radius:11px;color:#fff;font:800 13px system-ui;box-shadow:0 4px 18px #0009}",
    "#jpAdminTestBackdrop{position:fixed;inset:0;z-index:2147483001;background:#0009;backdrop-filter:blur(3px)}",
    "#jpAdminTestPanel{position:fixed;z-index:2147483002;right:0;top:0;bottom:0;overflow:auto;overscroll-behavior:contain;width:min(520px,100vw);background:#0a2032;color:#effaff;border-left:1px solid #6a93ae;padding:18px;box-shadow:-8px 0 25px #0009;text-align:left;font:13px/1.5 system-ui}",
    "#jpAdminTestBackdrop[hidden],#jpAdminTestPanel[hidden]{display:none!important}",
    "#jpAdminTestPanel h2{font-size:20px;margin:0;color:#fff}",
    "#jpAdminTestPanel h3{font-size:15px;margin:0 0 8px;color:#9de7ff}",
    "#jpAdminTestPanel p{margin:6px 0;color:#b6d3e4}",
    "#jpAdminTestPanel section{padding:12px;margin:12px 0;border:1px solid #385d76;border-radius:12px;background:#102b40}",
    "#jpAdminTestPanel .qa-flex{display:flex;flex-wrap:wrap;gap:7px;align-items:center}",
    "#jpAdminTestPanel .qa-columns{display:grid;grid-template-columns:1fr 1fr;gap:8px}",
    "#jpAdminTestPanel .qa-note{padding:10px;background:#493820;border:1px solid #ac8e53;border-radius:9px;color:#ffeccc;font-size:12px}",
    "#jpAdminTestPanel .qa-metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:10px 0}",
    "#jpAdminTestPanel .qa-metrics div{text-align:center;border-radius:9px;padding:10px 3px;background:#143c56;border:1px solid #396e8c}",
    "#jpAdminTestPanel .qa-metrics b{display:block;font-size:23px;font-variant-numeric:tabular-nums}",
    "#jpAdminTestPanel .qa-metrics small{font-size:10px;color:#b9d7ea}",
    "#jpAdminTestPanel label{display:block;font-size:12px;font-weight:700;color:#dcf0fa}",
    "#jpAdminTestPanel input,#jpAdminTestPanel select{display:block;width:100%;min-height:43px;box-sizing:border-box;padding:9px;background:#061b2c;color:#fff;border:1px solid #6c91aa;border-radius:8px;margin-top:4px;font-size:16px}",
    "#jpAdminTestPanel button{cursor:pointer;min-height:42px;border-radius:8px;padding:9px 12px;border:1px solid #5d92ad;background:#174b68;color:#fff;font:750 12px system-ui}",
    "#jpAdminTestPanel button:disabled{opacity:.4;cursor:not-allowed}",
    "#jpAdminTestPanel .qa-users{display:flex;flex-direction:column;gap:6px;max-height:200px;overflow:auto;margin:10px 0}",
    "#jpAdminTestPanel .qa-users button{display:flex;justify-content:space-between;gap:7px;width:100%;text-align:left}",
    "#jpAdminTestPanel .qa-users button[aria-pressed=true]{background:#146087;border-color:#9be8ff}",
    "#jpAdminTestPanel .qa-users small{color:#a9d9ee}",
    "#jpAdminTestPanel pre{background:#061625;padding:10px;white-space:pre-wrap;overflow-wrap:anywhere;max-height:185px;overflow:auto;border-radius:8px;font-size:11px}",
    "#jpAdminToast{position:fixed;z-index:2147483003;top:75px;left:50%;transform:translateX(-50%);max-width:90vw;border:1px solid #f3a6aa;background:#653c43;color:#fff;border-radius:10px;padding:10px;font:700 12px system-ui;text-align:center}",
    "#jpAdminToast[hidden]{display:none!important}",
    ".offline-settings-section,#offlinePdfBtn{display:none!important}",
    "@media(max-width:520px){#jpAdminTestPanel{padding:12px}#jpAdminTestPanel .qa-columns{grid-template-columns:1fr}}"
  ].join("\n");document.head.appendChild(style);

  const open=document.createElement("button");open.type="button";open.id="jpAdminTestBtn";
  open.textContent="ADMIN · TEST";open.setAttribute("aria-controls","jpAdminTestPanel");
  const backdrop=document.createElement("div");backdrop.id="jpAdminTestBackdrop";backdrop.hidden=true;
  const panel=document.createElement("aside");panel.id="jpAdminTestPanel";panel.hidden=true;
  panel.setAttribute("role","dialog");panel.setAttribute("aria-modal","true");
  panel.setAttribute("aria-label","JEPPIRAN test administrator");
  panel.innerHTML=
    '<div class="qa-flex" style="justify-content:space-between"><div><strong style="font-size:11px;color:#ffd08b">LOCAL QA · NOT REAL ADMIN ACCESS</strong><h2>JEPPIRAN ADMIN</h2></div><button id="qaClose" type="button">✕ Close</button></div>'+
    '<div class="qa-note">Public preview: everyone can access these local test tools. Changes are saved only in this browser, and do NOT authorize server charts, change actual users, or collect payments. Do not enter real credentials.</div>'+
    '<div class="qa-metrics"><div><b id="qaTotal">0</b><small>Test users</small></div><div><b id="qaActive">0</b><small>Active Premium</small></div><div><b id="qaExpired">0</b><small>Expired/blocked</small></div></div>'+
    '<section><h3>View JEPPIRAN as</h3><label>UI preview role<select id="qaRole"><option value="admin">Admin (all demo controls)</option><option value="premium">Premium</option><option value="demo">Demo (lock chart actions)</option></select></label><p id="qaRoleStatus" aria-live="polite"></p><small>This is visual UI testing only. A real entitlement backend is required for PDF security.</small></section>'+
    '<section><h3>Test user management</h3><div id="qaUsers" class="qa-users"></div><div class="qa-columns"><label>Username<input id="qaSelected" readonly></label><label>Subscription<select id="qaPlan"><option value="demo">Demo</option><option value="monthly">Monthly · 30 days</option><option value="quarterly">Quarterly · 90 days</option><option value="annual">Annual · 365 days</option></select></label><label>Expires<input id="qaExpiry" type="date"></label><label>Status<select id="qaEnabled"><option value="true">Enabled</option><option value="false">Suspended</option></select></label></div>'+
    '<div class="qa-flex" style="margin-top:10px"><button id="qaSave">Save</button><button id="qaRenew">Renew</button><button id="qaDelete">Delete</button></div>'+
    '<label style="margin-top:13px">New test username<input id="qaNew" placeholder="e.g. qa-pilot" maxlength="32" autocomplete="off"></label><div class="qa-flex" style="margin-top:7px"><button id="qaAdd">Create user</button><button id="qaReset">Reset test data</button></div></section>'+
    '<section><h3>Online chart diagnostics</h3><div class="qa-flex"><button id="qaInspect">Check charts</button><button id="qaExport">Export test data</button><a href="../" target="_blank" rel="noopener" style="color:#9de7ff">Main app ↗</a></div><pre id="qaOutput">Click “Check charts” to inspect the current cycle.</pre></section>'+
    '<p>ONLINE-ONLY QA · No offline chart sync is included in this panel.</p>';
  const toast=document.createElement("div");toast.id="jpAdminToast";toast.hidden=true;
  toast.setAttribute("role","status");document.body.append(open,backdrop,panel,toast);
  const $=id=>document.getElementById(id);
  const today=()=>new Date().toISOString().slice(0,10);
  const active=u=>u.enabled && u.plan!=="demo" && Boolean(u.expiry&&u.expiry>=today());
  function note(msg){toast.textContent=msg;toast.hidden=false;clearTimeout(note.timer);note.timer=setTimeout(()=>toast.hidden=true,3300)}
  function save(){try{localStorage.setItem(STORE,JSON.stringify(users))}catch(_){note("Local storage unavailable")}}
  function render(){
    $("qaTotal").textContent=users.length;
    $("qaActive").textContent=users.filter(active).length;
    $("qaExpired").textContent=users.filter(u=>!u.enabled||(u.plan!=="demo"&&!active(u))).length;
    $("qaRole").value=view;
    $("qaRoleStatus").textContent=view==="admin"?"Admin test controls active":view==="demo"?"Demo chart lock preview":"Premium access preview";
    document.body.dataset.jeppiranTestRole=view;
    const host=$("qaUsers");host.replaceChildren();
    users.forEach(u=>{
      const b=document.createElement("button");b.type="button";
      b.setAttribute("aria-pressed",String(u.user===chosen));
      const name=document.createElement("span");name.textContent=u.user;
      const status=document.createElement("small");
      status.textContent=!u.enabled?"SUSPENDED":u.plan==="demo"?"DEMO":active(u)?u.plan.toUpperCase():"EXPIRED";
      b.append(name,status);b.addEventListener("click",()=>{chosen=u.user;render()});host.append(b);
    });
    const u=users.find(x=>x.user===chosen);
    $("qaSelected").value=u?.user||"";
    $("qaPlan").value=u?.plan||"demo";
    $("qaExpiry").value=u?.expiry||"";
    $("qaEnabled").value=String(u?.enabled??true);
    for(const id of ["qaSave","qaRenew","qaDelete"])$(id).disabled=!u;
  }
  function show(yes){panel.hidden=!yes;backdrop.hidden=!yes;open.setAttribute("aria-expanded",String(yes));if(yes){render();$("qaClose").focus()}else open.focus()}
  open.addEventListener("click",()=>show(panel.hidden));
  backdrop.addEventListener("click",()=>show(false));
  $("qaClose").addEventListener("click",()=>show(false));
  document.addEventListener("keydown",e=>{if(e.key==="Escape"&&!panel.hidden){e.stopImmediatePropagation();show(false)}});
  $("qaRole").addEventListener("change",e=>{view=e.target.value;try{sessionStorage.setItem(ROLE,view)}catch(_){}render();note("Test view: "+view.toUpperCase())});
  $("qaSave").addEventListener("click",()=>{const u=users.find(x=>x.user===chosen);if(!u)return;u.plan=$("qaPlan").value;u.expiry=$("qaExpiry").value;u.enabled=$("qaEnabled").value==="true";save();render();note("Test account saved locally")});
  $("qaRenew").addEventListener("click",()=>{const u=users.find(x=>x.user===chosen);if(!u)return;const days={demo:0,monthly:30,quarterly:90,annual:365}[$("qaPlan").value];if(!days){note("Select a Premium plan");return}u.plan=$("qaPlan").value;u.enabled=true;u.expiry=future(days);save();render();note("Test account renewed")});
  $("qaDelete").addEventListener("click",()=>{users=users.filter(x=>x.user!==chosen);chosen=users[0]?.user||"";save();render();note("Test account deleted")});
  $("qaAdd").addEventListener("click",()=>{const user=$("qaNew").value.trim().toLowerCase();if(!/^[a-z0-9_.-]{3,32}$/.test(user)){note("Use 3-32 Latin letters, digits, dots, dashes, underscores");return}if(users.some(x=>x.user===user)){note("Username exists");return}users.push({user,plan:"demo",expiry:"",enabled:true});chosen=user;$("qaNew").value="";save();render();note("Test account created")});
  $("qaReset").addEventListener("click",()=>{if(!confirm("Reset all browser-only test accounts?"))return;users=seeds();chosen=users[0].user;save();render();note("Reset complete")});
  $("qaInspect").addEventListener("click",async()=>{
    const diag={type:"static-web-admin-test",permissions:"qa-only",online:navigator.onLine,previewRole:view,checked:new Date().toISOString()};
    try{const r=await fetch("./data/charts-manifest.json",{cache:"no-store"});if(!r.ok)throw Error("HTTP "+r.status);const m=await r.json();diag.cycle=m.version;diag.airports=Object.keys(m.airports||{}).length}catch(e){diag.error=String(e.message||e)}
    $("qaOutput").textContent=JSON.stringify(diag,null,2);
  });
  $("qaExport").addEventListener("click",()=>{
    const data={type:"qa-only",users,role:view,exported:new Date().toISOString()};
    const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:"application/json"}));
    const a=document.createElement("a");a.href=url;a.download="JEPPIRAN-admin-test.json";a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
  });
  // The demo switch is deliberately UI-only; PDFs remain public until a real backend.
  document.addEventListener("click",e=>{
    if(view!=="demo"||!panel.hidden)return;
    if(e.target.closest("#chartsView .tree-item,#jpChartDrawer .jp-drawer-chart,#chartsView .profile-proc-list button")){
      e.preventDefault();e.stopImmediatePropagation();note("DEMO TEST · Upgrade required to open charts");
    }
  },true);
  render();
})();