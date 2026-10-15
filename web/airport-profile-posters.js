/* JEPPIRAN locked airport profile posters.
 * Owner-approved ICAO/IATA mapping, independent of data cycle. Image files
 * are decorative: NOT for taxi routes, aircraft positioning or navigation.
 * Only activate a poster once the matching static asset actually loads.
 */
(() => {
  "use strict";
  const airports = Object.freeze({"OIII":"THR","OIIE":"IKA","OIMM":"MHD","OICC":"KSH","OITR":"OMH","OISS":"SYZ","OIFM":"IFN","OIAW":"AWZ","OIKB":"BND","OIYY":"AZD","OITT":"TBZ","OIKK":"KER","OIGG":"RAS","OITL":"ADU","OIBK":"KIH","OIZC":"ZBR","OIBB":"BUZ","OIHH":"HDM","OIMB":"XBJ","OITZ":"JWN","OIAA":"ABD","OIBA":"AEU","OIBP":"PGU","OIMN":"BJB","OING":"GBT","OIHR":"AJK","OISL":"LRR","OIKQ":"GSM","OIZH":"ZAH","OICS":"SDG","OIIL":"IIL","OISR":"LFM","OINN":"NSH","OINR":"RZR","OINZ":"SRY","OISY":"YES","OIKY":"SYJ","OIAM":"MRX","OIAD":"DEF","OIMT":"TCX"});
  const root = document.getElementById("airportProfile");
  if (!root) return;
  const loading = new Map();
  let queued = false;
  let lastCode = "";
  const urlFor = (icao) => "./airport-profile-posters/" + icao + ".webp";
  function remove() {
    root.classList.remove("jp-airport-poster-loaded");
    root.style.removeProperty("--jp-airport-poster-image");
  }
  function use(icao) {
    if (root.querySelector(".profile-icao")?.textContent?.trim()?.toUpperCase() !== icao) return;
    root.style.setProperty("--jp-airport-poster-image", 'url("' + urlFor(icao) + '")');
    root.classList.add("jp-airport-poster-loaded");
  }
  function apply() {
    queued = false;
    const icao = (root.querySelector(".profile-icao")?.textContent || "").trim().toUpperCase();
    if (icao === lastCode) return;
    lastCode = icao;
    remove();
    if (!Object.prototype.hasOwnProperty.call(airports, icao)) return;
    const currentIata = (root.querySelector(".profile-code-row .profile-chip")?.textContent || "").trim().toUpperCase();
    if (currentIata && currentIata !== "—" && currentIata !== airports[icao]) {
      // Fail closed rather than show an image with mismatched airport identification.
      return;
    }
    if (loading.has(icao)) {
      if (loading.get(icao) === "ready") use(icao);
      return;
    }
    loading.set(icao, "pending");
    const img = new Image();
    img.onload = () => {
      loading.set(icao, "ready");
      if (lastCode === icao) use(icao);
    };
    img.onerror = () => {
      loading.set(icao, "missing");
      // Existing profile gradient remains visible until approved image is installed.
    };
    img.src = urlFor(icao);
  }
  function queue() {
    if (!queued) { queued = true; requestAnimationFrame(apply); }
  }
  new MutationObserver(queue).observe(root, {childList:true,subtree:true});
  queue();
  window.JEPPIRAN_APPROVED_PROFILE_POSTERS = Object.freeze({
    count:Object.keys(airports).length, mapping:airports, frozen:true, illustrativeOnly:true
  });
})();
