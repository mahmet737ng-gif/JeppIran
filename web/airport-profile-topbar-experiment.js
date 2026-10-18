/* Reversible OIII-only TOP INFORMATION BAR experiment (Design 2).
 * Actual app profile nodes/data are reused; approved image, charts, GPS,
 * georeferences, other airports and source weather feeds are unchanged.
 */
(() => {
  "use strict";
  const root = document.getElementById("airportProfile");
  if (!root) return;
  let installedShell = null;
  let queued = false;
  const titles = Object.freeze({
    profileWeather: "METAR",
    profileWind: "WIND COMPONENTS",
    profileRunways: "RUNWAYS",
    profileNotam: "NOTAM",
    profileTaf: "TAF"
  });
  const code = () => (root.querySelector(".profile-icao")?.textContent || "").trim().toUpperCase();
  const make = (tag, className, text) => {
    const el = document.createElement(tag);
    el.className = className;
    if (text != null) el.textContent = text;
    return el;
  };
  function reveal(id) {
    const drawer = root.querySelector(":scope > .jp-o3-details");
    if (!drawer) return;
    drawer.hidden = false;
    root.classList.add("jp-o3-details-open");
    const heading = drawer.querySelector(".jp-o3-drawer-heading");
    if (heading) heading.textContent = titles[id] || "AIRPORT INFORMATION";
    root.querySelectorAll(".jp-o3-control").forEach(button =>
      button.setAttribute("aria-expanded", "true"));
    const card = drawer.querySelector("#" + id);
    if (card) drawer.scrollTop = Math.max(0, card.offsetTop - 50);
  }
  function close() {
    const drawer = root.querySelector(":scope > .jp-o3-details");
    if (!drawer) return;
    drawer.hidden = true;
    root.classList.remove("jp-o3-details-open");
    root.querySelectorAll(".jp-o3-control").forEach(button =>
      button.setAttribute("aria-expanded", "false"));
  }
  function action(className, label, detail, target) {
    const button = make("button", "jp-o3-control " + className);
    button.type = "button";
    button.dataset.target = target;
    button.setAttribute("aria-controls", "jp-o3-details");
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-label", "Open " + label + " airport information");
    button.append(make("b", "jp-o3-action-label", label));
    if (detail) button.append(make("span", "jp-o3-action-detail", detail));
    button.addEventListener("click", () => reveal(target));
    return button;
  }
  function install(shell) {
    const cols = shell.querySelector(":scope > .profile-cols");
    if (!cols) return;
    installedShell = shell;
    // Preserve the original five live cards and runway handlers in an accessible drawer.
    const drawer = make("aside", "jp-o3-details");
    drawer.id = "jp-o3-details";
    drawer.hidden = true;
    drawer.setAttribute("aria-label", "Mehrabad airport information");
    const drawerTop = make("div", "jp-o3-drawer-top");
    const heading = make("strong", "jp-o3-drawer-heading", "AIRPORT INFORMATION");
    const closeButton = make("button", "jp-o3-close", "×");
    closeButton.type = "button";
    closeButton.setAttribute("aria-label", "Close airport information");
    closeButton.addEventListener("click", close);
    drawerTop.append(heading, closeButton);
    drawer.append(drawerTop, cols);
    root.append(drawer);
    const metar = root.querySelector("#profileWeather");
    const raw = (metar?.querySelector("#profileMetarRaw")?.textContent || "METAR unavailable").trim();
    const wx = metar?.querySelector(".weather-facts");
    const facts = wx ? Array.from(wx.querySelectorAll("span")).map(x => (x.textContent || "").trim()) : [];
    const temp = (metar?.querySelector(".weather-brief strong")?.textContent || "—").trim();
    const cloud = (metar?.querySelector(".weather-brief small:last-child")?.textContent || "—").trim();
    const badge = (metar?.querySelector(".jp-metar-heading")?.textContent || "").replace(/METAR\s*•\s*OIII/i, "").trim();
    const topbar = make("section", "jp-o3-topbar");
    topbar.setAttribute("aria-label", "Mehrabad floating airport information");
    const topLine = make("div", "jp-o3-topline");
    const metarButton = action("jp-o3-metar", "◉ METAR", raw, "profileWeather");
    if (badge) metarButton.append(make("small", "jp-o3-flight-category", badge));
    topLine.append(metarButton);
    const meta = make("div", "jp-o3-clock");
    const clock = shell.querySelector(".profile-elev");
    if (clock) meta.append(clock); // Keep the real UTC/local clocks and validity dates live.
    topLine.append(meta);
    const quick = make("div", "jp-o3-shortcuts");
    quick.append(
      action("jp-o3-fact", "WIND", facts[1] || "—", "profileWind"),
      action("jp-o3-fact", "VISIBILITY", facts[0] || "—", "profileWeather"),
      action("jp-o3-fact", "CLOUDS", cloud || "—", "profileWeather"),
      action("jp-o3-fact", "TEMP", temp, "profileWeather"),
      action("jp-o3-fact", "RUNWAYS", "ADC", "profileRunways"),
      action("jp-o3-fact", "NOTAM", "CHECK", "profileNotam"),
      action("jp-o3-fact", "TAF", "FORECAST", "profileTaf")
    );
    topbar.append(topLine, quick);
    root.append(topbar);
    root.classList.add("jp-o3-topbar-experiment");
    // Moving cards does not duplicate any weather/status source or alter any navigation.
  }
  function apply() {
    queued = false;
    const shell = root.querySelector(":scope > .profile-shell");
    if (code() !== "OIII" || !shell) {
      root.classList.remove("jp-o3-topbar-experiment", "jp-o3-details-open");
      root.querySelector(":scope > .jp-o3-topbar")?.remove();
      root.querySelector(":scope > .jp-o3-details")?.remove();
      installedShell = null;
      return;
    }
    if (installedShell === shell &&
        root.querySelector(":scope > .jp-o3-topbar") &&
        root.querySelector(":scope > .jp-o3-details")) return;
    root.querySelector(":scope > .jp-o3-topbar")?.remove();
    root.querySelector(":scope > .jp-o3-details")?.remove();
    root.classList.remove("jp-o3-topbar-experiment", "jp-o3-details-open");
    install(shell);
  }
  const queue = () => { if (!queued) { queued = true; requestAnimationFrame(apply); } };
  new MutationObserver(queue).observe(root, {childList: true, subtree: true});
  root.addEventListener("keydown", event => {
    if (event.key === "Escape" && root.classList.contains("jp-o3-details-open")) close();
  });
  queue();
  window.JEPPIRAN_OIII_TOPBAR_EXPERIMENT = Object.freeze({
    airport: "OIII", variant: 2, reversible: true
  });
})();
