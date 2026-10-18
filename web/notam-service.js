/* JEPPIRAN NOTAM relay — only fresh FAA search responses are displayed. */
(function(){
"use strict";
const URL="https://raw.githubusercontent.com/mahmet737ng-gif/JeppIran/notam-cache/notams-current.json", MAX_AGE=45*60000;
const SEARCH="https://notams.aim.faa.gov/notamSearch/nsapp.html";
const states=new Map(), requests=new Map();
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
function parseDate(s){if(!s)return NaN;let v=String(s).trim();const d=v.match(/^(\d\d)\/(\d\d)\/(\d{4})\s+(\d\d)(\d\d)(?:EST)?$/i);if(d)return Date.UTC(+d[3],+d[1]-1,+d[2],+d[4],+d[5]);const icao=v.match(/^(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)(?:EST)?$/i);if(icao)return Date.UTC(2000 + +icao[1],+icao[2]-1,+icao[3],+icao[4],+icao[5]);if(/^\d{4}-\d\d-\d\d \d\d:\d\d/.test(v))v=v.replace(" ","T")+"Z";return Date.parse(v)}
function utc(s){const t=parseDate(s);return Number.isFinite(t)?new Date(t).toISOString().replace("T"," ").replace(/\.\d{3}Z$/," UTC"):String(s||"—")}
function link(icao){return SEARCH+"?ACTIONTYPE=NOTAMRETRIEVALBYICAOS&FORMATTYPE=ICAO&METHOD=DISPLAYBYICAOS&REPORTTYPE=REPORT&RETRIEVELOCID="+encodeURIComponent(icao)}
function render(icao,el){
 if(!el)return;
 const st=states.get(icao)||{status:"loading",message:"Checking FAA NOTAM relay…"};
 const fresh=st.status==="available"&&Date.now()-parseDate(st.updated)<MAX_AGE;
 const open=Boolean(el.querySelector("details")?.open);
 const items=fresh?st.items.filter(n=>{
   const a=parseDate(n.begin),b=parseDate(n.end),now=Date.now();
   return (!Number.isFinite(a)||a<=now)&&(!Number.isFinite(b)||b>now)&&!/^(CANCELLED|CANCELED|EXPIRED|INACTIVE)$/i.test(n.status||"");
 }):[];
 const body=items.length?items.map(n=>'<article class="jp-notam-item"><b>'+esc(n.id||"NOTAM")+'</b><p>'+esc(n.text)+'</p><small>UTC '+esc(utc(n.begin))+' → '+esc(utc(n.end))+'</small></article>').join(""):(fresh?"<p>No current notices returned by the relay; verify with AIS/NOF.</p>":"<p>No verified live feed. Do not interpret this as no NOTAMs.</p>");
 el.innerHTML='<header><span>NOTAM • '+esc(icao)+'</span><small class="jp-notam-state'+(fresh?' jp-notam-fresh':'')+'">'+(fresh?esc(items.length+" reported • "+utc(st.updated)):"Unavailable / unverified")+'</small></header>'+
 '<details class="profile-notam-details"'+(open?' open':'')+'><summary>NOTAM status & details</summary>'+
 '<div class="jp-notam-scroll">'+body+'</div></details>';
}
function notify(icao){let el=document.getElementById("profileNotam");if(el&&el.querySelector("header")?.textContent.includes(icao))render(icao,el)}
async function refresh(icao,force=false){
 icao=String(icao||"").trim().toUpperCase();if(!/^[A-Z0-9]{4}$/.test(icao))return;
 if(requests.has(icao))return requests.get(icao);
 const old=states.get(icao);if(!force&&old&&Date.now()-(old.checked||0)<300000)return;
 states.set(icao,{status:"loading",message:"Checking FAA NOTAM relay…",checked:Date.now()});notify(icao);
 const job=(async()=>{
  try{
   const res=await fetch(URL+"?v="+Math.floor(Date.now()/300000),{cache:"no-store"});
   if(!res.ok)throw Error("NOTAM relay HTTP "+res.status);
   const data=await res.json(),row=data?.stations?.[icao];
   if(row?.status!=="available"||!Array.isArray(row.notams))throw Error("FAA data currently unavailable for "+icao);
   const fetched=String(row.fetched_at||"");
   if(!Number.isFinite(parseDate(fetched))||Date.now()-parseDate(fetched)>=MAX_AGE||parseDate(fetched)>Date.now()+120000)throw Error("Outdated or invalid FAA retrieval time");
   const seen=new Set(),items=[];
   for(const n of row.notams.slice(0,500)){
    if(!n||typeof n!=="object")continue;const text=String(n.text||"").slice(0,5000),id=String(n.id||"").slice(0,80);if(!text.trim()||seen.has(id+"|"+text))continue;
    seen.add(id+"|"+text);items.push({id,text,begin:String(n.begin||""),end:String(n.end||""),status:String(n.status||"")});
   }
   states.set(icao,{status:"available",items,updated:fetched,checked:Date.now()});
  }catch(err){states.set(icao,{status:"unavailable",message:String(err.message||err),checked:Date.now()})}
  finally{requests.delete(icao);notify(icao)}
 })();requests.set(icao,job);return job;
}
window.JEPPIRAN_NOTAM={render,refresh,officialSearchUrl:link};
})();