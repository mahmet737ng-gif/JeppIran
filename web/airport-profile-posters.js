/* JEPPIRAN locked airport profile posters.
 * Owner-approved ICAO/IATA mapping, independent of data cycle. Image files
 * are decorative: NOT for taxi routes, aircraft positioning or navigation.
 * Only activate a poster once the matching static asset actually loads.
 */
(() => {
  "use strict";
  const airports = Object.freeze({"OIII":"THR","OIIE":"IKA","OIMM":"MHD","OICC":"KSH","OITR":"OMH","OISS":"SYZ","OIFM":"IFN","OIAW":"AWZ","OIKB":"BND","OIYY":"AZD","OITT":"TBZ","OIKK":"KER","OIGG":"RAS","OITL":"ADU","OIBK":"KIH","OIZC":"ZBR","OIBB":"BUZ","OIHH":"HDM","OIMB":"XBJ","OITZ":"JWN","OIAA":"ABD","OIBA":"AEU","OIBP":"PGU","OIMN":"BJB","OING":"GBT","OIHR":"AJK","OISL":"LRR","OIKQ":"GSM","OIZH":"ZAH","OICS":"SDG","OIIL":"IIL","OISR":"LFM","OINN":"NSH","OINR":"RZR","OINZ":"SRY","OISY":"YES","OIKY":"SYJ","OIAM":"MRX","OIAD":"DEF","OIMT":"TCX","OIIP":"PYK","OIKM":"BXR","OIMS":"AFZ","OISJ":"JAR","OITK":"KHY","OITP":"PFQ","OIBQ":"KHK","OITM":"IMQ","OICK":"KHD","OIFS":"CQD"});
  const additionalPosterAssignments = Object.freeze({"OIBL":"new20_05","OIBS":"new20_12","OIBV":"new20_13","OICI":"new20_15","OICZ":"new20_04","OIFE":"new20_16","OIFP":"new20_17","OIKJ":"new20_10","OIKR":"new20_19","OIMJ":"new20_08","OINE":"new20_03","OISF":"new20_09","OITU":"new20_14","OIZB":"new20_20","OIZI":"new20_18","OIZS":"new20_06","OTHH":"new20_01","UGSB":"new20_02","OOMS":"new20_07","OPKC":"new20_11"});
  const v3AirportCodes = Object.freeze(["LTAC","LTFM","OIAA","OIAM","OIAW","OIBA","OIBB","OIBK","OIBL","OIBP","OIBQ","OIII","OIMM"]);
  const v3AirportSet = new Set(v3AirportCodes);
  const allAirports = Object.freeze({...airports,...Object.fromEntries(Object.keys(additionalPosterAssignments).map(icao=>[icao,true])),...Object.fromEntries(v3AirportCodes.map(icao=>[icao,true]))});
  const root = document.getElementById("airportProfile");
  if (!root) return;
  const loading = new Map();
  const dimensions = new Map();
  let queued = false;
  let lastCode = "";
  const urlFor = (icao) => {
    const cached = window.JEPPIRAN_POSTER_CACHE_URLS?.[icao];
    // An older offline registry can still point eleven of these airports at
    // their previous artwork. Never let it override the approved V3 set.
    if (v3AirportSet.has(icao)) {
      const current = "./airport-profile-posters-v3/" + icao + ".webp";
      return cached?.startsWith(current + "?v=") ? cached : current + "?v=2621-poster-v3-13";
    }
    return cached || (additionalPosterAssignments[icao] ? "./airport-profile-posters-new20/" + additionalPosterAssignments[icao] + ".webp" : "./airport-profile-posters-textfree/" + icao + ".webp?v=2621-letter-repair-r2");
  };

  // The poster is a fixed, fully contained image with its HTML caption anchored
  // INSIDE the same image rectangle, never to scrolling profile content.
  // There is no new or re-encoded artwork in this change.
  function ensureFrame() {
    let frame = root.querySelector(".jp-poster-frame");
    if (!frame) {
      frame = document.createElement("div");
      frame.className = "jp-poster-frame";
      frame.setAttribute("aria-hidden", "true");
      root.prepend(frame);
    }
    return frame;
  }
  // One live, accessible header per airport. The old poster-bottom label is
  // not rendered; the source of the city/name/elevation remains the profile.
  function ensureCaption(frame) {
    const shell = root.querySelector(".profile-shell");
    const icao = (root.querySelector(".profile-icao")?.textContent || "").trim().toUpperCase();
    if (!shell || !frame || !allAirports[icao] || frame.querySelector(".jp-poster-caption")) return;
    const iata = airports[icao] || (root.querySelector(".profile-code-row .profile-chip")?.textContent || "").trim().toUpperCase() || "—";
    const airportName = (root.querySelector(".profile-heading h2")?.textContent || "Airport").trim();
    const cityLine = root.querySelector(".profile-heading p")?.firstChild?.textContent || "";
    const city = cityLine.split(",")[0].trim();
    // Coordinates remain only in the top-right clock/status panel.
    const rightSideCoordinates = root.querySelector(".profile-coordinates")?.textContent || "";
    const elevation = (root.querySelector(".profile-elev-inline")?.textContent || "Elevation —").trim();
    const normalize = s => s.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase()
      .replace(/[^a-z0-9 ]/g," ").replace(/\s+/g," ").trim();
    const cityKey=normalize(city), nameKey=normalize(airportName);
    const airportSuffix=/^(?:(?:international|regional|domestic|municipal|city|civil|military|commercial) )*(?:airport|aerodrome|airfield|air base)$/;
    const sameName = cityKey && (cityKey === nameKey ||
      (nameKey.startsWith(cityKey+" ") && airportSuffix.test(nameKey.slice(cityKey.length+1))));
    const displayName = !cityKey || sameName ? airportName : city+" / "+airportName;
    const caption = document.createElement("section");
    caption.className = "jp-poster-caption";
    caption.setAttribute("aria-label", "Airport profile heading");
    const display = (parent, tag, className, value) => {
      const element = document.createElement(tag);
      element.className = className;
      element.textContent = value;
      parent.appendChild(element);
      return element;
    };
    const codes = document.createElement("div");
    codes.className = "jp-caption-codes";
    display(codes,"strong","jp-caption-title",icao+" / "+iata);
    // Preserve the original clickable Favorites button and its event handler.
    const favorite = root.querySelector("#profileFavBtn");
    if (favorite) {
      favorite.classList.add("jp-header-favorite");
      // Keep it in the foreground profile shell so a decorative background
      // layer can never intercept or cover its clicks.
      root.querySelector(".profile-heading")?.appendChild(favorite);
    }
    caption.appendChild(codes);
    display(caption,"span","jp-caption-city",displayName);
    display(caption,"span","jp-caption-elevation",elevation);
    const divider = document.createElement("div");
    divider.className = "jp-caption-divider";
    divider.setAttribute("aria-hidden","true");
    divider.textContent = "✈";
    caption.appendChild(divider);
    frame.removeAttribute("aria-hidden");
    frame.appendChild(caption);
  }
  function fitCards() {
    const shell = root.querySelector(".profile-shell");
    if (!shell || !root.classList.contains("jp-airport-poster-loaded")) return;
    // Reset before measurement so switching airports / runway counts never
    // accumulates fractional zoom from a previous profile.
    shell.style.maxHeight = "";
    shell.style.overflowY = "";
    shell.style.zoom = "1";
    // Preserve a bottom scenic strip for the airport's own landmark.
    // Without this reserve long runway listings cover the approved lower-
    // right skyline on shorter laptop and tablet screens.
    const compact = root.clientWidth < 780;
    const scenicReserve = compact
      ? Math.max(92, Math.min(145, root.clientHeight * .17))
      : Math.max(145, Math.min(215, root.clientHeight * .24));
    root.style.setProperty("--jp-scenic-reserve", scenicReserve + "px");
    const available = Math.max(180, root.clientHeight - scenicReserve - 16);
    const natural = Math.max(1,shell.scrollHeight);
    const scale = Math.min(1,available/natural);
    const chosen = Math.max(0.64,scale);
    shell.style.zoom = String(chosen);
    shell.style.maxHeight = (available/chosen)+"px";
    shell.style.overflowY = scale < 0.64 ? "auto" : "hidden";
  }
  function positionFrame(icao) {
    if (!root.classList.contains("jp-airport-poster-loaded")) return;
    if ((root.querySelector(".profile-icao")?.textContent || "").trim().toUpperCase() !== icao) return;
    const frame = ensureFrame();
    // Fit the foreground cards first: zoom can change the available layout width.
    // Measure and size the backdrop only AFTER the final profile layout settles.
    fitCards();
    const size = dimensions.get(icao) || {width:4,height:3};
    // The CSS profile panel may have a fractional transformed width. Use
    // whichever is smaller: layout pixels or actually visible bounds, so no
    // part of the photo can extend past the right/bottom edge.
    const rect = root.getBoundingClientRect();
    const w = Math.max(1,Math.min(root.clientWidth,rect.width));
    const h = Math.max(1,Math.min(root.clientHeight,rect.height));
    const scale = Math.min(w/size.width,h/size.height);
    const posterW = Math.min(w,size.width*scale), posterH = Math.min(h,size.height*scale);
    frame.style.width = posterW+"px";
    frame.style.height = posterH+"px";
    frame.style.left = (w-posterW)/2+"px";
    frame.style.top = (h-posterH)/2+"px";
    frame.style.backgroundImage = 'url("' + urlFor(icao) + '")';
    ensureCaption(frame);
    // Repaint ONLY the bottom landmark strip in a foreground scenic layer.
    // This is the SAME image, at the SAME position/scale as the full poster,
    // so scenery is not moved, duplicated or invented. It prevents cards
    // from obscuring the city symbol after runway rows are populated.
    let scene = root.querySelector(".jp-poster-scenic-foreground");
    if (!scene) {
      scene = document.createElement("div");
      scene.className = "jp-poster-scenic-foreground";
      scene.setAttribute("aria-hidden", "true");
      root.appendChild(scene);
    }
    const cover = Math.max(w/size.width,h/size.height);
    scene.style.backgroundImage = 'url("' + urlFor(icao) + '")';
    scene.style.backgroundSize = (size.width*cover)+"px "+(size.height*cover)+"px";
    // Precisely align the live Favorites control immediately after the
    // metallic ICAO / IATA label, including responsive zoom adjustments.
    const button = root.querySelector("#profileFavBtn");
    const title = frame.querySelector(".jp-caption-title");
    const heading = root.querySelector(".profile-heading");
    const shell = root.querySelector(".profile-shell");
    if (button && title && heading && shell) {
      const tr = title.getBoundingClientRect(), hr = heading.getBoundingClientRect();
      const z = Math.max(.01, Number(shell.style.zoom) || 1);
      button.style.left = Math.max(4,Math.min((hr.width / z) - 42,
        (tr.right - hr.left + 11) / z)) + "px";
      button.style.top = Math.max(2,(tr.top - hr.top + 3) / z) + "px";
    }
  }
  function remove() {
    root.classList.remove("jp-airport-poster-loaded");
    root.style.removeProperty("--jp-airport-poster-image");
    root.style.removeProperty("--jp-scenic-reserve");
    root.querySelector(".jp-poster-frame")?.remove();
    root.querySelector(".jp-poster-scenic-foreground")?.remove();
    const shell = root.querySelector(".profile-shell");
    if (shell) {shell.style.zoom = "";shell.style.maxHeight = "";shell.style.overflowY = "";}
  }
  function use(icao) {
    if (root.querySelector(".profile-icao")?.textContent?.trim()?.toUpperCase() !== icao) return;
    root.classList.add("jp-airport-poster-loaded");
    positionFrame(icao);
  }
  function apply() {
    queued = false;
    const icao = (root.querySelector(".profile-icao")?.textContent || "").trim().toUpperCase();
    if (icao === lastCode && root.classList.contains("jp-airport-poster-loaded")) {
      positionFrame(icao);
      return;
    }
    if (icao === lastCode && loading.get(icao) === "pending") return;
    lastCode = icao;
    remove();
    if (!Object.prototype.hasOwnProperty.call(allAirports, icao)) return;
    const currentIata = (root.querySelector(".profile-code-row .profile-chip")?.textContent || "").trim().toUpperCase();
    if (airports[icao] && currentIata && currentIata !== "—" && currentIata !== airports[icao]) {
      // A mismatched ICAO/IATA pair must never display another airport's art.
      return;
    }
    if (loading.get(icao) === "ready") {use(icao);return;}
    if (loading.get(icao) === "missing") return;
    if (loading.get(icao) === "pending") return;
    loading.set(icao, "pending");
    const img = new Image();
    img.onload = () => {
      loading.set(icao, "ready");
      dimensions.set(icao, {width:img.naturalWidth,height:img.naturalHeight});
      if (lastCode === icao) use(icao);
    };
    img.onerror = () => {loading.set(icao, "missing");};
    img.src = urlFor(icao);
  }
  function queue() {
    if (!queued) {queued = true; requestAnimationFrame(apply);}
  }
  new MutationObserver(queue).observe(root, {childList:true,subtree:true});
  if (typeof ResizeObserver !== "undefined") {
    new ResizeObserver(() => {
      if (lastCode && root.classList.contains("jp-airport-poster-loaded")) positionFrame(lastCode);
    }).observe(root);
  } else {
    window.addEventListener("resize",queue,{passive:true});
  }
  queue();
  window.addEventListener("jeppiran:poster-assets-ready",()=>{
    // Keep the current frame; future selections take the correct hash URL.
    // If we previously marked an image missing, retry once cache is ready.
    for(const [code,status] of loading)if(status==="missing")loading.delete(code);
    if(lastCode && !root.classList.contains("jp-airport-poster-loaded")){
      lastCode="";queue();
    }
  });
  window.JEPPIRAN_NEW20_PROFILE_POSTERS = Object.freeze({count:20, airportToDesign:additionalPosterAssignments, illustrativeOnly:true});
  window.JEPPIRAN_APPROVED_PROFILE_POSTERS = Object.freeze({
    count:Object.keys(airports).length, mapping:airports, frozen:true, illustrativeOnly:true
  });
})();

