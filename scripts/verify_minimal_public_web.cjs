"use strict";
const assert=require("node:assert/strict");
const root=(process.env.JEPPIRAN_PAGE_URL||"https://mahmet737ng-gif.github.io/JeppIran/").replace(/\/?$/,"/");
const delay=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 let error;
 for(let attempt=0;attempt<45;attempt++){
  try{
   const html=await fetch(root+"?jeppiran-profile="+Date.now(),{cache:"no-store"}).then(r=>{if(!r.ok)throw Error("index HTTP "+r.status);return r.text()});
   const jsName="profile-minimal.js?v=2621-minimal-20261021-r1";
   const cssName="profile-minimal.css?v=2621-minimal-20261021-r1";
   assert.ok(html.includes(jsName)&&html.includes(cssName),"minimal profile release not active yet");
   assert.ok(html.includes("app.js?v=2621-minimal-profile-r1"));
   assert.ok(!html.includes('src="./airport-profile-posters.js'));
   const [js,css]=await Promise.all([jsName,cssName].map(name=>fetch(new URL("./"+name,root),{cache:"no-store"}).then(async r=>{if(!r.ok)throw Error(name+" HTTP "+r.status);return r.text()})));
   assert.match(js,/JEPPIRAN_MINIMAL_PROFILE/);
   assert.match(js,/getPdfBytes/);
   assert.match(css,/background-image:none!important/);
   console.log("PASS live deployed JEPPIRAN approved minimal profile",root);
   return;
  }catch(e){error=e;await delay(6000)}
 }
 throw error||Error("Web revision could not be verified");
})().catch(e=>{console.error(e);process.exitCode=1});
