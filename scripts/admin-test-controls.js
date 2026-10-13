/* JEPPIRAN isolated web admin QA diagnostics (no production admin rights). */
(function(){
  "use strict";
  if(!window.JEPPIRAN_TEST_ADMIN || !location.pathname.includes("/admin-test/"))return;
  const css=document.createElement("style");
  css.textContent=[
    "#jpAdminTestBtn{position:fixed;z-index:2147483000;left:max(12px,env(safe-area-inset-left));bottom:max(12px,env(safe-area-inset-bottom));border:1px solid #8be5e8;background:#103b52;color:white;border-radius:12px;padding:10px 15px;box-shadow:0 2px 14px #0006;font:700 13px system-ui;cursor:pointer}",
    "#jpAdminTestPanel{position:fixed;z-index:2147483001;left:max(12px,env(safe-area-inset-left));bottom:65px;width:min(375px,calc(100vw - 24px));max-height:min(70vh,520px);overflow:auto;background:#0d2031;color:#f3faff;border:1px solid #4c879d;border-radius:15px;padding:16px;box-shadow:0 10px 40px #0009;font:13px/1.55 system-ui;text-align:left}",
    "#jpAdminTestPanel[hidden]{display:none!important}",
    "#jpAdminTestPanel h2{font-size:16px;margin:0 0 8px;color:#e2fdff}",
    "#jpAdminTestPanel p{margin:7px 0;color:#bfd4df}",
    "#jpAdminTestPanel button,#jpAdminTestPanel a{display:inline-block;margin:4px 4px 4px 0;padding:9px 12px;color:#fff;background:#174761;border:1px solid #7295a5;border-radius:8px;font:600 12px system-ui;text-decoration:none}",
    "#jpAdminTestPanel pre{white-space:pre-wrap;overflow-wrap:anywhere;background:#071420;color:#eaf7ff;padding:10px;border-radius:8px;font:11px/1.5 ui-monospace,monospace}"
  ].join("\n");
  document.head.appendChild(css);
  const open=document.createElement("button");
  open.id="jpAdminTestBtn";open.type="button";open.textContent="Admin QA · TEST";open.setAttribute("aria-controls","jpAdminTestPanel");
  const panel=document.createElement("section");
  panel.id="jpAdminTestPanel";panel.hidden=true;panel.setAttribute("aria-label","JEPPIRAN Admin QA controls");
  panel.innerHTML='<h2>JEPPIRAN · Admin Test</h2>'+
    '<p>Isolated testing and diagnostics only. This is NOT a server-authorized administrator session. No account/subscription writes.</p>'+
    '<div><button id="jpAdminTestCheck" type="button">Check data</button>'+
    '<button id="jpAdminTestOffline" type="button">Sync offline</button>'+
    '<button id="jpAdminTestReport" type="button">Export report</button>'+
    '<a href="../" target="_blank" rel="noopener">Main app</a></div>'+
    '<pre id="jpAdminTestOutput">Ready. Open Check data for status.</pre>';
  document.body.appendChild(open);document.body.appendChild(panel);
  const find=id=>document.getElementById(id);
  let report={mode:"admin-test",permissions:"qa-only",time:null};
  const output=find("jpAdminTestOutput");
  function show(data){report=data;output.textContent=JSON.stringify(data,null,2);}
  async function inspect(){
    const s={mode:"admin-test",permissions:"qa-only",time:new Date().toISOString(),
      route:location.pathname,online:navigator.onLine,serviceWorker:!!navigator.serviceWorker?.controller};
    try{
      const response=await fetch("./data/charts-manifest.json",{cache:"no-store"});
      if(!response.ok)throw Error("HTTP "+response.status);
      const m=await response.json();
      s.cycle=m.version||"unknown";s.airports=Object.keys(m.airports||{}).length;
    }catch(e){s.chartsError=String(e.message||e);}
    try{
      const p=await caches.open("jeppiran-test-offline-meta-v2");
      const response=await p.match("./__jeppiran_active_offline_v2__");
      if(response){
        const m=await response.json();
        s.offline={cycle:m.cycle,files:Object.keys(m.entries||{}).length,lastSync:m.completedAt};
      }else{s.offline="No verified offline snapshot yet";}
      if(navigator.storage?.estimate){
        const e=await navigator.storage.estimate();
        s.storage={usedMiB:Math.round((e.usage||0)/1048576),quotaMiB:Math.round((e.quota||0)/1048576)};
      }
    }catch(e){s.storageError=String(e.message||e);}
    show(s);
  }
  open.addEventListener("click",()=>{panel.hidden=!panel.hidden;if(!panel.hidden)inspect();});
  find("jpAdminTestCheck").addEventListener("click",inspect);
  find("jpAdminTestOffline").addEventListener("click",async()=>{
    if(!window.JeppIranOffline?.sync){output.textContent="Offline manager not ready";return;}
    output.textContent="Starting verified offline synchronization (watch Settings for progress)…";
    await window.JeppIranOffline.sync();await inspect();
  });
  find("jpAdminTestReport").addEventListener("click",()=>{
    const file=new Blob([JSON.stringify(report,null,2)],{type:"application/json"});
    const url=URL.createObjectURL(file);
    const a=document.createElement("a");a.href=url;a.download="JEPPIRAN-admin-qa-report.json";a.click();
    setTimeout(()=>URL.revokeObjectURL(url),2500);
  });
})();