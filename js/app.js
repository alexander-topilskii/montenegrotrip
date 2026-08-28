(() => {
  const { TRIP } = window;
  const $ = (sel, root = document) => root.querySelector(sel);
  const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const compactMq = window.matchMedia("(max-width: 980px)");
  const isCompact = () => compactMq.matches;

  function syncCompact() {
    document.documentElement.classList.toggle("is-compact", isCompact());
  }
  syncCompact();

  const kinds = {
    arrive: "прилёт",
    drive: "дорога",
    walk: "пешком",
    boat: "вода",
    sleep: "ночёвка",
    optional: "по желанию",
    vista: "вид",
    fun: "аттракцион",
    tip: "заметка",
    skip: "скорее нет",
  };

  const saved = JSON.parse(localStorage.getItem("mne-tapes") || "{}");

  function renderStory() {
    const ov = TRIP.overview;
    const overviewHtml = `
      <section class="day overview-day" id="overview">
        <div class="day-head">
          <div class="hwy" aria-hidden="true">00</div>
          <div>
            <p class="slug">${ov.slug}</p>
            <h2>${ov.title}</h2>
            <div class="meta">
              <span class="chip">весь маршрут</span>
              <span class="chip">без следования</span>
              <span class="chip">~750 км</span>
            </div>
          </div>
        </div>
        <blockquote class="liner">${ov.quote}</blockquote>
        <p class="summary">${ov.summary}</p>
        <ol class="spine">
          ${ov.points
            .map(
              (p) => `
            <li data-ov="${p.id}" data-lat="${p.lat}" data-lng="${p.lng}">
              <span class="n">${p.n}</span>
              <div>
                <h3>${p.name}</h3>
                <p>${p.place}</p>
              </div>
            </li>`
            )
            .join("")}
        </ol>
      </section>`;

    const root = $("#story");
    root.innerHTML =
      overviewHtml +
      TRIP.days
        .map((day) => {
        const photo = TRIP.photos[day.photo];
        const stops = day.stops
          .map((stop) => {
            const checked = saved[stop.id] ? "checked" : "";
            return `
            <article class="stop" data-kind="${stop.kind}" data-stop="${stop.id}" data-day="${day.id}" data-lat="${stop.lat}" data-lng="${stop.lng}">
              <input class="check" type="checkbox" data-id="${stop.id}" ${checked} aria-label="Отметить: ${stop.name}">
              <div>
                <h3>${stop.name}</h3>
                <p>${stop.note}</p>
                <a class="maps-link" href="${stop.maps}" target="_blank" rel="noopener">открыть в картах</a>
              </div>
              <div class="kind">${stop.time}<small>${stop.dur} · ${kinds[stop.kind] || stop.kind}</small></div>
            </article>`;
          })
          .join("");
        return `
        <section class="day" id="${day.id}">
          <div class="day-head">
            <div class="hwy" aria-hidden="true">${day.hwy}</div>
            <div>
              <p class="slug">${day.slug}</p>
              <h2>${day.title}</h2>
              <div class="meta">
                <span class="chip">${day.track}</span>
                <span class="chip">${day.date}</span>
                <span class="chip">${day.weekday}</span>
                <span class="chip">${day.drive}</span>
              </div>
            </div>
          </div>
          <figure class="still">
            <img src="${photo}" alt="${day.caption}" loading="lazy">
            <figcaption>${day.caption}</figcaption>
          </figure>
          <blockquote class="liner">${day.quote}</blockquote>
          <p class="summary">${day.summary}</p>
          <div class="stops">${stops}</div>
        </section>`;
        })
        .join("");
  }

  function renderStays() {
    $("#receipts").innerHTML = TRIP.stays
      .map(
        (s) => `
      <article class="receipt">
        <div class="stars">★★★★☆ MOTEL</div>
        <h3>${s.place}</h3>
        <p>${s.nights}</p>
        <p>${s.address}</p>
        <p>${s.checkin}${s.price ? " · " + s.price : ""}</p>
        <p>${s.extra}</p>
      </article>`
      )
      .join("");
  }

  function renderTape() {
    $("#tracks").innerHTML = TRIP.mixtape
      .map(
        (t) => `<li><b>${t.n}</b><span>${t.title}<br><small>${t.artist}</small></span></li>`
      )
      .join("");
  }

  function renderNav() {
    const ov = `<a href="#overview" data-day="overview" title="Весь маршрут">◯</a>`;
    $("#days-nav").innerHTML =
      ov +
      TRIP.days
        .map((d) => `<a href="#${d.id}" data-day="${d.id}" title="${d.date}">${d.date.split(" ")[0]}</a>`)
        .join("");
  }

  const FX = (() => {
    let canvas;
    let ctx;
    let motes = [];
    let raf = 0;
    let w = 0;
    let h = 0;
    let travel = 0;
    let sparkIv = 0;
    let noteIv = 0;
    let ambientIv = 0;
    let dpr = 1;

    const GLYPHS = {
      star: ["✦", "✧", "⋆", "✩", "✶"],
      snow: ["❄", "❅", "❆", "✻"],
      note: ["♪", "♫", "♩", "♬"],
      spark: ["·", "˚", "✧"],
    };

    function resize() {
      if (!canvas) return;
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.width = Math.floor(window.innerWidth * dpr);
      h = canvas.height = Math.floor(window.innerHeight * dpr);
      canvas.style.width = window.innerWidth + "px";
      canvas.style.height = window.innerHeight + "px";
    }

    function initMotes() {
      motes = Array.from({ length: 48 }, () => ({
        x: Math.random(),
        y: Math.random(),
        r: 0.5 + Math.random() * 1.7,
        s: 0.07 + Math.random() * 0.22,
        a: 0.12 + Math.random() * 0.32,
        drift: Math.random() * Math.PI * 2,
        edge: Math.random() < 0.5 ? 0 : 1,
      }));
    }

    function tick(t) {
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);
      const live = document.body.classList.contains("tape-on") || travel > 0.05;
      if (live) {
        const boost = 1 + travel * 1.6;
        motes.forEach((m) => {
          m.y -= m.s * 0.00028 * boost;
          m.x += Math.sin(t / 900 + m.drift) * 0.00007;
          if (m.y < -0.03) m.y = 1.03;
          if (m.x < 0) m.x += 1;
          if (m.x > 1) m.x -= 1;
          let px = m.x;
          if (travel > 0.15) {
            px = m.edge ? 0.04 + m.x * 0.1 : 0.86 + m.x * 0.1;
          }
          ctx.beginPath();
          ctx.fillStyle = `rgba(255, 236, 210, ${m.a * (0.45 + travel * 0.7)})`;
          ctx.arc(px * w, m.y * h, m.r * dpr * boost, 0, Math.PI * 2);
          ctx.fill();
        });
      }
      raf = requestAnimationFrame(tick);
    }

    function spawn(kind, opts = {}) {
      const layer = $("#fx-dom");
      if (!layer || reduced()) return;
      const set = GLYPHS[kind] || GLYPHS.spark;
      const el = document.createElement("span");
      el.className = `fx-bit is-${kind}`;
      el.textContent = set[Math.floor(Math.random() * set.length)];
      const mode = opts.where || "edge";
      let x;
      if (mode === "sky") x = 8 + Math.random() * 84;
      else if (opts.edge === "left") x = Math.random() * 13;
      else if (opts.edge === "right") x = 87 + Math.random() * 13;
      else x = Math.random() < 0.5 ? Math.random() * 13 : 87 + Math.random() * 13;
      el.style.left = x + "vw";
      el.style.top = (opts.y ?? 12 + Math.random() * 70) + "vh";
      el.style.setProperty("--dur", (opts.dur || 5.5 + Math.random() * 4) + "s");
      el.style.setProperty("--dx", (Math.random() * 36 - 18) + "px");
      el.style.setProperty("--rot", (Math.random() * 70 - 35) + "deg");
      el.style.fontSize = (opts.size || (kind === "note" ? 22 : 16) + Math.random() * 14) + "px";
      layer.appendChild(el);
      while (layer.childElementCount > 90) layer.firstChild.remove();
      window.setTimeout(() => el.remove(), 11000);
    }

    function rainNotes(ms = 3200) {
      if (reduced()) return;
      window.clearInterval(noteIv);
      const compact = isCompact();
      const end = Date.now() + (compact ? Math.min(ms, 1600) : ms);
      const burst = () => {
        spawn("note", {
          where: "sky",
          y: -10,
          dur: 4.2 + Math.random() * 3.2,
          size: compact ? 14 + Math.random() * 10 : 14 + Math.random() * 20,
        });
        if (!compact && Math.random() > 0.45) spawn("note", { y: -12, size: 12 + Math.random() * 16 });
        if (Date.now() > end) window.clearInterval(noteIv);
      };
      burst();
      noteIv = window.setInterval(burst, compact ? 180 : 95);
    }

    function travelOn() {
      travel = 1;
      document.body.classList.add("is-traveling");
      if (reduced()) return;
      window.clearInterval(sparkIv);
      sparkIv = window.setInterval(() => {
        const compact = isCompact();
        const roll = Math.random();
        const kind = compact
          ? roll > 0.5
            ? "star"
            : "snow"
          : roll > 0.55
            ? "star"
            : roll > 0.22
              ? "snow"
              : "spark";
        spawn(kind);
        if (!compact && Math.random() > 0.4) spawn("star");
        if (!compact && Math.random() > 0.55) spawn("snow");
        if (!compact && Math.random() > 0.8) spawn("note", { y: -8, size: 18 });
      }, isCompact() ? 220 : 90);
    }

    function travelOff() {
      travel = 0;
      document.body.classList.remove("is-traveling");
      window.clearInterval(sparkIv);
    }

    function flash() {
      if (isCompact()) return;
      const el = $("#polaroid-flash");
      if (!el || reduced()) return;
      el.classList.remove("is-on");
      void el.offsetWidth;
      el.classList.add("is-on");
      window.setTimeout(() => el.classList.remove("is-on"), 650);
    }

    function caption(text) {
      const el = $("#map-arrive");
      if (!el) return;
      el.textContent = text;
      el.classList.add("is-on");
      window.setTimeout(() => el.classList.remove("is-on"), 1500);
    }

    function clack() {
      try {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        const ac = new AC();
        const o = ac.createOscillator();
        const g = ac.createGain();
        o.type = "square";
        o.frequency.value = 170;
        g.gain.setValueAtTime(0.035, ac.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ac.currentTime + 0.09);
        o.connect(g);
        g.connect(ac.destination);
        o.start();
        o.stop(ac.currentTime + 0.1);
        window.setTimeout(() => ac.close(), 200);
      } catch (_) {
        /* ignore */
      }
    }

    function startAmbient() {
      document.body.classList.add("tape-on");
      if (reduced() || ambientIv) return;
      ambientIv = window.setInterval(() => {
        if (!document.body.classList.contains("tape-on")) return;
        if (travel > 0.2) return;
        spawn(Math.random() > 0.65 ? "star" : "spark");
      }, 1600);
    }

    function init() {
      canvas = $("#fx-canvas");
      if (!canvas) return;
      ctx = canvas.getContext("2d");
      initMotes();
      resize();
      window.addEventListener("resize", resize);
      if (!reduced()) raf = requestAnimationFrame(tick);
    }

    return { init, spawn, rainNotes, travelOn, travelOff, flash, caption, clack, startAmbient };
  })();

  let map;
  let carMarker;
  let streets;
  let sat;
  const markers = {};
  let activeDay = null;
  let activeStop = null;
  let ghostLine = null;
  let activeLine = null;
  let driveRaf = 0;
  let driveToken = 0;
  let traveling = false;
  const routes = {};
  const ovMarkers = [];
  let dayFollow = false;
  let followZooming = false;
  let holdFollowY = null;
  let ignoreScrollDrive = 0;
  let followCam = null;
  let carFlip = 1;
  let carFlipHold = 0;

  function pinIcon(label, color) {
    return L.divIcon({
      className: "pin-icon",
      html: `<div class="pin" style="--c:${color}"><span>${label}</span></div>`,
      iconSize: [28, 28],
      iconAnchor: [4, 26],
      popupAnchor: [10, -24],
    });
  }

  function offsetCoord(lat, lng, n) {
    if (!n) return [lat, lng];
    const a = n * 1.15;
    return [lat + Math.cos(a) * 0.014 * n, lng + Math.sin(a) * 0.018 * n];
  }

  function densify(latlngs, n = 90) {
    const out = [];
    for (let i = 0; i < latlngs.length - 1; i++) {
      const a = latlngs[i];
      const b = latlngs[i + 1];
      const steps = Math.max(2, Math.round(n / (latlngs.length - 1)));
      for (let s = 0; s < steps; s++) {
        const t = s / steps;
        out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      }
    }
    out.push(latlngs[latlngs.length - 1]);
    return out;
  }

  function dayOf(id) {
    return TRIP.days.find((d) => d.id === id);
  }

  function stopOf(id) {
    for (const day of TRIP.days) {
      const s = day.stops.find((st) => st.id === id);
      if (s) return { stop: s, day };
    }
    return null;
  }

  function isOverview() {
    return activeDay === "overview";
  }

  function dedupePts(pts, eps = 0.0007) {
    const out = [];
    pts.forEach((p) => {
      if (!out.length || !almost(out[out.length - 1], p, eps)) out.push(p);
    });
    return out;
  }

  function waypointsFor(day) {
    if (day.id === "overview") return dedupePts(day.points.map((p) => [p.lat, p.lng]), 0.0002);
    const pts = day.route && day.route.length > 1 ? day.route : day.stops.map((s) => [s.lat, s.lng]);
    return dedupePts(pts);
  }

  function simplifyPts(pts, max = 700) {
    if (pts.length <= max) return pts;
    const step = (pts.length - 1) / (max - 1);
    const out = [];
    for (let i = 0; i < max - 1; i++) out.push(pts[Math.round(i * step)]);
    out.push(pts[pts.length - 1]);
    return out;
  }

  const OSRM_URLS = [
    "https://router.project-osrm.org/route/v1/driving/",
    "https://routing.openstreetmap.de/routed-car/route/v1/driving/",
  ];

  async function fetchOsrm(pts) {
    if (pts.length < 2) return pts;
    const coords = pts.map(([lat, lng]) => `${lng},${lat}`).join(";");
    const q = "?overview=full&geometries=geojson&steps=false";
    let lastErr;
    for (const base of OSRM_URLS) {
      try {
        const res = await fetch(base + coords + q, { mode: "cors" });
        if (!res.ok) continue;
        const data = await res.json();
        const geom = data?.routes?.[0]?.geometry?.coordinates;
        if (!geom || geom.length < 2) continue;
        return geom.map(([lng, lat]) => [lat, lng]);
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr || new Error("osrm");
  }

  function fallbackRoute(pts) {
    return densify(pts, 120);
  }

  function denseRoute(day) {
    const id = day.id || day;
    if (routes[id]) return routes[id];
    const obj = id === "overview" ? TRIP.overview : dayOf(id) || day;
    return fallbackRoute(waypointsFor(obj));
  }

  async function loadRoute(day) {
    const id = day.id;
    const wps = waypointsFor(day);
    if (!routes[id]) routes[id] = fallbackRoute(wps);
    if (wps.length < 2) return routes[id];
    try {
      routes[id] = simplifyPts(await fetchOsrm(wps));
      if (map) map.getContainer().dataset.osrm = id;
      if (activeDay === id) paintCurrentLines();
    } catch (_) {
      routes[id] = fallbackRoute(wps);
    }
    return routes[id];
  }

  function prefetchRoutes() {
    loadRoute(TRIP.overview);
    TRIP.days.forEach((d, i) => {
      window.setTimeout(() => loadRoute(d), 280 * (i + 1));
    });
  }

  function nearestIndex(pts, ll) {
    let bi = 0;
    let bd = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const d = (pts[i][0] - ll[0]) ** 2 + (pts[i][1] - ll[1]) ** 2;
      if (d < bd) {
        bd = d;
        bi = i;
      }
    }
    return bi;
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function almost(a, b, eps = 0.0025) {
    return Math.abs(a[0] - b[0]) < eps && Math.abs(a[1] - b[1]) < eps;
  }

  function segLen(a, b) {
    return Math.hypot(b[0] - a[0], b[1] - a[1]);
  }

  function cumDist(pts) {
    const c = new Float64Array(pts.length);
    for (let i = 1; i < pts.length; i++) c[i] = c[i - 1] + segLen(pts[i - 1], pts[i]);
    return c;
  }

  function sampleAlong(pts, cum, dist) {
    const n = pts.length;
    const total = cum[n - 1];
    if (n < 2 || dist <= 0) return { ll: pts[0], i0: 0, i1: 1 };
    if (dist >= total) return { ll: pts[n - 1], i0: n - 2, i1: n - 1 };
    let lo = 0;
    let hi = n - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (cum[mid] < dist) lo = mid;
      else hi = mid;
    }
    const span = cum[hi] - cum[lo] || 1e-9;
    const t = (dist - cum[lo]) / span;
    return {
      ll: [lerp(pts[lo][0], pts[hi][0], t), lerp(pts[lo][1], pts[hi][1], t)],
      i0: lo,
      i1: hi,
    };
  }

  function easeAlong(t) {
    if (t <= 0) return 0;
    if (t >= 1) return 1;
    const a = 0.18;
    if (t < a) {
      const u = t / a;
      return a * u * u * (3 - 2 * u);
    }
    if (t > 1 - a) {
      const u = (1 - t) / a;
      return 1 - a * u * u * (3 - 2 * u);
    }
    return t;
  }

  function setCarFlip(pts, i0) {
    const wrap = carMarker?.getElement()?.querySelector(".car-rot");
    if (!wrap || !pts || pts.length < 2) return;
    const i1 = Math.min(pts.length - 1, i0 + 10);
    const dx = pts[i1][1] - pts[i0][1];
    if (Math.abs(dx) < 0.0002) return;
    const next = dx > 0 ? -1 : 1;
    if (next === carFlip) {
      carFlipHold = 0;
      return;
    }
    carFlipHold += 1;
    if (carFlipHold < 8) return;
    carFlip = next;
    carFlipHold = 0;
    wrap.style.transform = carFlip < 0 ? "scaleX(-1)" : "scaleX(1)";
  }

  function pathDuration(pts) {
    if (!pts || pts.length < 2) return 800;
    let d = 0;
    for (let i = 1; i < pts.length; i++) d += segLen(pts[i - 1], pts[i]);
    const ms = d * (isCompact() ? 3200 : 5200);
    return Math.min(isCompact() ? 7000 : 11000, Math.max(1100, ms));
  }

  function resetFollowCam(ll) {
    followCam = ll ? { lat: ll[0], lng: ll[1] } : null;
  }

  function keepCarInView(ll) {
    if (!map || !dayFollow) return;
    if (!followCam) {
      followCam = { lat: ll[0], lng: ll[1] };
    } else {
      followCam.lat += (ll[0] - followCam.lat) * 0.16;
      followCam.lng += (ll[1] - followCam.lng) * 0.16;
    }
    map.setView([followCam.lat, followCam.lng], map.getZoom(), { animate: false });
  }

  function buildPath(day, destLL) {
    const dense = denseRoute(day);
    const cur = carMarker.getLatLng();
    const startLL = [cur.lat, cur.lng];
    const iDest = nearestIndex(dense, destLL);
    const iFrom = nearestIndex(dense, startLL);
    const onRoute = almost(startLL, dense[iFrom], 0.08);
    if (onRoute) {
      if (iFrom === iDest) return [dense[iDest]];
      return iFrom < iDest ? dense.slice(iFrom, iDest + 1) : dense.slice(iDest, iFrom + 1).reverse();
    }
    const onto = densify([startLL, dense[iFrom]], 24);
    const along =
      iFrom <= iDest ? dense.slice(iFrom, iDest + 1) : dense.slice(iDest, iFrom + 1).reverse();
    return onto.concat(along.slice(1));
  }

  function updateProgressLine(day, carLL) {
    const dense = denseRoute(day);
    const idx = nearestIndex(dense, carLL);
    if (ghostLine) ghostLine.setLatLngs(dense);
    if (activeLine) {
      if (dayFollow) activeLine.setLatLngs(dense.slice(0, Math.max(2, idx + 1)));
      else activeLine.setLatLngs(dense);
    }
  }

  function lineStyle(color, ghost) {
    return {
      color,
      weight: ghost ? 3 : 4.5,
      opacity: ghost ? 0.28 : 0.95,
      lineCap: "round",
      smoothFactor: 0,
      className: ghost ? "route-ghost" : "route-active",
    };
  }

  function paintCurrentLines() {
    if (isOverview()) paintOverviewLines(false);
    else {
      const day = dayOf(activeDay);
      if (day) paintDayLines(day, !dayFollow);
    }
  }

  function paintOverviewLines(fit) {
    const dense = denseRoute(TRIP.overview);
    if (ghostLine) map.removeLayer(ghostLine);
    if (activeLine) map.removeLayer(activeLine);
    ghostLine = L.polyline(dense, lineStyle(TRIP.overview.color, true)).addTo(map);
    activeLine = L.polyline(dense, lineStyle(TRIP.overview.color, false)).addTo(map);
    if (!traveling) carMarker.setLatLng(dense[0]);
    if (fit && dense.length) {
      map.flyToBounds(L.latLngBounds(dense).pad(isCompact() ? 0.22 : 0.18), {
        duration: isCompact() ? 0.7 : 1.05,
      });
    }
  }

  function paintDayLines(day, full = true) {
    const dense = denseRoute(day);
    if (ghostLine) map.removeLayer(ghostLine);
    if (activeLine) map.removeLayer(activeLine);
    ghostLine = L.polyline(dense, lineStyle(day.color, true)).addTo(map);
    const cur = carMarker.getLatLng();
    const idx = nearestIndex(dense, [cur.lat, cur.lng]);
    activeLine = L.polyline(full ? dense : dense.slice(0, Math.max(2, idx + 1)), lineStyle(day.color, false)).addTo(
      map
    );
  }

  function currentSubject() {
    return isOverview() ? TRIP.overview : dayOf(activeDay);
  }

  function driveAlong(pts, opts = {}) {
    const { onDone, pan = true, notes = false, zoomAfter = null } = opts;
    driveToken += 1;
    const token = driveToken;
    if (driveRaf) cancelAnimationFrame(driveRaf);
    if (!pts || pts.length < 2) {
      if (pts?.[0]) {
        carMarker.setLatLng(pts[0]);
        const sub = currentSubject();
        if (sub) updateProgressLine(sub, pts[0]);
      }
      onDone?.();
      return;
    }
    traveling = true;
    FX.travelOn();
    if (notes) FX.rainNotes(Math.min(3200, pathDuration(pts)));
    if (reduced()) {
      const last = pts[pts.length - 1];
      carMarker.setLatLng(last);
      const sub = currentSubject();
      if (sub) updateProgressLine(sub, last);
      traveling = false;
      FX.travelOff();
      onDone?.();
      return;
    }
    const cum = cumDist(pts);
    const total = cum[cum.length - 1] || 1e-9;
    const t0 = performance.now();
    const dur = opts.duration || pathDuration(pts);
    carFlipHold = 0;
    resetFollowCam(pts[0]);
    let lineTick = 0;
    function tick(now) {
      if (token !== driveToken) {
        const hud = $("#play-route");
        if (hud) hud.textContent = "Проиграть сторону";
        return;
      }
      const t = Math.min(1, (now - t0) / dur);
      const { ll, i0 } = sampleAlong(pts, cum, easeAlong(t) * total);
      carMarker.setLatLng(ll);
      setCarFlip(pts, i0);
      const sub = currentSubject();
      if (sub && (t >= 1 || (lineTick++ & 2) === 0)) updateProgressLine(sub, ll);
      if (pan) keepCarInView(ll);
      if (t < 1) {
        driveRaf = requestAnimationFrame(tick);
      } else {
        traveling = false;
        FX.travelOff();
        if (sub) updateProgressLine(sub, ll);
        if (opts.flash !== false && pts.length > 10) FX.flash();
        if (zoomAfter) map.flyTo(pts[pts.length - 1], zoomAfter, { duration: 0.85 });
        onDone?.();
      }
    }
    driveRaf = requestAnimationFrame(tick);
  }

  function applyMarkerFocus(id, stopId) {
    const ov = id === "overview";
    ovMarkers.forEach((m) => {
      const el = m.getElement();
      if (!el) return;
      el.classList.toggle("is-off", !ov);
      el.classList.toggle("is-on-day", ov);
      el.classList.toggle("is-target", ov && stopId && m.ovId === stopId);
    });
    Object.values(markers).forEach((m) => {
      const el = m.getElement();
      if (!el) return;
      const on = !ov && m.dayId === id;
      el.classList.toggle("is-off", !on);
      el.classList.toggle("is-on-day", on);
      el.classList.toggle("is-target", !!(stopId && m.stopId === stopId && on));
      if (!on) m.closePopup();
    });
  }

  function setNav(id) {
    document.querySelectorAll(".days-nav a").forEach((a) => {
      a.classList.toggle("is-on", a.dataset.day === id);
    });
    document.querySelectorAll(".day").forEach((el) => {
      el.classList.toggle("is-current", el.id === id);
    });
  }

  function showOverview(opts = {}) {
    const { fly = true } = opts;
    dayFollow = false;
    followZooming = false;
    holdFollowY = null;
    activeStop = null;
    traveling = false;
    driveToken += 1;
    resetFollowCam(null);
    activeDay = "overview";
    setNav("overview");
    const now = $("#map-now");
    if (now) now.textContent = "весь маршрут · аэропорт → Дурмитор → аэропорт";
    document.querySelectorAll(".stop").forEach((el) => el.classList.remove("is-on"));
    applyMarkerFocus("overview");
    requestAnimationFrame(() => applyMarkerFocus("overview"));
    paintOverviewLines(fly);
    loadRoute(TRIP.overview);
  }

  function setActiveDay(id, opts = {}) {
    const { fly = true, force = false, follow = false } = opts;
    if (id === "overview") {
      showOverview({ fly });
      return;
    }
    if (!force && id === activeDay && !follow) return;
    const day = dayOf(id);
    if (!day) return;
    const switched = id !== activeDay;
    activeDay = id;
    if (switched) {
      dayFollow = false;
      followZooming = false;
      holdFollowY = window.scrollY;
      activeStop = null;
      resetFollowCam(null);
    }
    setNav(id);
    const now = $("#map-now");
    if (now) now.textContent = `${day.track} · ${day.date} · ${day.title}`;
    applyMarkerFocus(id, activeStop);
    requestAnimationFrame(() => applyMarkerFocus(id, activeStop));
    const dense = denseRoute(day);
    if (!dayFollow) carMarker.setLatLng(dense[0]);
    paintDayLines(day, !dayFollow);
    loadRoute(day);
    if (fly && !dayFollow) {
      ignoreScrollDrive = Date.now() + (isCompact() ? 800 : 1100);
      map.flyToBounds(L.latLngBounds(dense).pad(isCompact() ? 0.42 : 0.28), {
        duration: isCompact() ? 0.7 : 1,
      });
    }
  }

  function followZoom() {
    return isCompact() ? 12 : 13;
  }

  function highlightStop(id, opts = {}) {
    const { fly = false, fromScroll = false, openPop = !fromScroll && !isCompact() } = opts;
    const found = stopOf(id);
    if (!found) return;
    const { stop, day } = found;

    document.querySelectorAll(".stop").forEach((el) => {
      el.classList.toggle("is-on", el.dataset.stop === id);
    });

    const entering = day.id !== activeDay;
    if (entering) setActiveDay(day.id, { fly: false, force: true, follow: false });

    const same = id === activeStop && !entering;
    activeStop = id;
    applyMarkerFocus(day.id, id);
    const now = $("#map-now");
    if (now) now.textContent = `${day.track} · ${stop.name}`;

    const dest = [stop.lat, stop.lng];
    const dense = denseRoute(day);
    const start = dense[0];

    if (fromScroll && !dayFollow) {
      dayFollow = true;
      followZooming = true;
      carMarker.setLatLng(start);
      paintDayLines(day, false);
      map.flyTo(start, followZoom(), { duration: 0.9 });
      const token = ++driveToken;
      map.once("moveend", () => {
        if (token !== driveToken) return;
        followZooming = false;
        const path = buildPath(day, dest);
        driveAlong(path, {
          pan: true,
          onDone: () => {
            FX.caption(stop.name);
            applyMarkerFocus(day.id, id);
          },
        });
      });
      return;
    }

    if (!dayFollow && !fromScroll) {
      dayFollow = true;
    }

    const cur = carMarker.getLatLng();
    if (same && almost([cur.lat, cur.lng], dest)) {
      if (openPop) markers[id]?.openPopup();
      return;
    }

    const path = buildPath(day, dest);
    if (!fromScroll) ignoreScrollDrive = Date.now() + pathDuration(path) + 120;
    driveAlong(path, {
      pan: dayFollow,
      zoomAfter: fly && !isCompact() ? followZoom() : null,
      onDone: () => {
        FX.caption(stop.name);
        applyMarkerFocus(day.id, id);
        if (openPop) markers[id]?.openPopup();
      },
    });
  }

  function applyMapTouchMode() {
    if (!map) return;
    const compact = isCompact();
    const toggle = (handler, on) => {
      if (!handler) return;
      if (on) handler.enable();
      else handler.disable();
    };
    toggle(map.dragging, !compact);
    toggle(map.touchZoom, false);
    toggle(map.scrollWheelZoom, false);
    toggle(map.doubleClickZoom, false);
    toggle(map.keyboard, false);
    map.invalidateSize();
  }

  function refreshMapSize() {
    if (!map) return;
    map.invalidateSize({ animate: false });
  }

  function initMap() {
    const compact = isCompact();
    map = L.map("map", {
      zoomControl: false,
      attributionControl: true,
      scrollWheelZoom: false,
      dragging: !compact,
      touchZoom: false,
      doubleClickZoom: false,
      boxZoom: false,
      keyboard: false,
    }).setView([42.44, 19.26], compact ? 8.5 : 10);

    L.control.zoom({ position: "topright" }).addTo(map);
    map.getContainer().addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        if (e.ctrlKey || e.metaKey) return;
        const root = document.scrollingElement || document.documentElement;
        root.scrollTop += e.deltaY;
        root.scrollLeft += e.deltaX;
      },
      { passive: false }
    );

    streets = L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
      maxZoom: 19,
    });
    sat = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      { attribution: "Tiles &copy; Esri", maxZoom: 19 }
    );
    streets.addTo(map);

    const seen = {};
    TRIP.days.forEach((day) => {
      day.stops.forEach((stop) => {
        const key = `${stop.lat.toFixed(3)},${stop.lng.toFixed(3)}`;
        seen[key] = (seen[key] || 0) + 1;
        const [lat, lng] = offsetCoord(stop.lat, stop.lng, seen[key] - 1);
        const m = L.marker([lat, lng], {
          icon: pinIcon(day.hwy.replace(/^0/, ""), day.color),
        }).bindPopup(
          `<div class="pop"><h3>${stop.name}</h3><p>${day.track} · ${day.date}</p><p>${stop.note}</p></div>`
        );
        m.dayId = day.id;
        m.stopId = stop.id;
        m.on("click", () => highlightStop(stop.id, { fly: true, fromScroll: false }));
        markers[stop.id] = m;
        m.addTo(map);
      });
    });

    TRIP.overview.points.forEach((p, i) => {
      const [lat, lng] = offsetCoord(p.lat, p.lng, i > 3 ? 1 : 0);
      const m = L.marker([lat, lng], {
        icon: pinIcon(p.n.replace(/^0/, ""), TRIP.overview.color),
      }).bindPopup(`<div class="pop"><h3>${p.name}</h3><p>${p.place}</p></div>`);
      m.ovId = p.id;
      m.on("click", () => {
        if (!isOverview()) showOverview({ fly: false });
        document.querySelectorAll(".spine li").forEach((el) => {
          el.classList.toggle("is-on", el.dataset.ov === p.id);
        });
        applyMarkerFocus("overview", p.id);
        m.openPopup();
      });
      ovMarkers.push(m);
      m.addTo(map);
    });

    carMarker = L.marker([TRIP.overview.points[0].lat, TRIP.overview.points[0].lng], {
      icon: L.divIcon({
        className: "car-marker",
        html: '<div class="car-rot"><span class="car-emoji">🚗</span></div>',
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      }),
      zIndexOffset: 1000,
    }).addTo(map);

    setTimeout(() => {
      refreshMapSize();
      showOverview({ fly: true });
      prefetchRoutes();
    }, 300);
  }

  function playRoute() {
    if (isOverview()) {
      const pts = denseRoute(TRIP.overview);
      const hud = $("#play-route");
      carMarker.setLatLng(pts[0]);
      hud.textContent = "Идёт сторона…";
      dayFollow = true;
      FX.rainNotes(1800);
      const dur = Math.min(18000, Math.max(5200, pathDuration(pts) * 1.25));
      ignoreScrollDrive = Date.now() + dur + 400;
      driveAlong(pts, {
        duration: dur,
        pan: true,
        notes: true,
        onDone: () => {
          hud.textContent = "Проиграть сторону";
          dayFollow = false;
          map.flyToBounds(L.latLngBounds(pts).pad(0.2), { duration: 0.8 });
        },
      });
      return;
    }
    const day = dayOf(activeDay);
    if (!day || traveling) return;
    const hud = $("#play-route");
    const pts = denseRoute(day);
    carMarker.setLatLng(pts[0]);
    hud.textContent = "Идёт сторона…";
    dayFollow = true;
    FX.rainNotes(2200);
    const dur = Math.min(14000, Math.max(3600, pathDuration(pts) * 1.2));
    ignoreScrollDrive = Date.now() + dur + 400;
    driveAlong(pts, {
      duration: dur,
      pan: true,
      notes: true,
      onDone: () => {
        hud.textContent = "Проиграть сторону";
        map.flyToBounds(L.latLngBounds(pts).pad(0.28), { duration: 0.8 });
      },
    });
  }

  function fitActiveDay() {
    if (isOverview()) {
      dayFollow = false;
      const pts = denseRoute(TRIP.overview);
      map.flyToBounds(L.latLngBounds(pts).pad(0.2), { duration: 0.9 });
      return;
    }
    const day = dayOf(activeDay);
    if (!day) return;
    dayFollow = false;
    const pts = denseRoute(day);
    carMarker.setLatLng(pts[0]);
    paintDayLines(day, true);
    map.flyToBounds(L.latLngBounds(pts).pad(0.28), { duration: 0.9 });
  }

  function targetFromScroll() {
    const atlas = $(".atlas");
    const atlasBottom = atlas ? atlas.getBoundingClientRect().bottom : 0;
    const band = isCompact()
      ? Math.min(Math.max(atlasBottom + 36, window.innerHeight * 0.52), window.innerHeight * 0.72)
      : window.innerHeight * 0.4;
    const topCut = isCompact() ? Math.max(90, atlasBottom - 8) : 90;
    let bestStop = null;
    let bestStopD = Infinity;
    document.querySelectorAll(".stop").forEach((el) => {
      const r = el.getBoundingClientRect();
      if (r.bottom < topCut || r.top > window.innerHeight - 40) return;
      const mid = r.top + r.height * 0.35;
      const d = Math.abs(mid - band);
      if (d < bestStopD) {
        bestStopD = d;
        bestStop = el;
      }
    });
    if (bestStop && bestStopD < window.innerHeight * 0.42) {
      return { type: "stop", id: bestStop.dataset.stop };
    }
    const ov = $("#overview");
    if (ov) {
      const r = ov.getBoundingClientRect();
      if (r.top < band && r.bottom > band) return { type: "overview" };
    }
    let bestDay = null;
    let bestDayD = Infinity;
    document.querySelectorAll(".day:not(.overview-day)").forEach((el) => {
      const head = el.querySelector(".day-head") || el;
      const r = head.getBoundingClientRect();
      if (r.bottom < topCut || r.top > window.innerHeight * 0.78) return;
      const d = Math.abs(r.top - band);
      if (d < bestDayD) {
        bestDayD = d;
        bestDay = el;
      }
    });
    if (bestDay) return { type: "day", id: bestDay.id };
    return null;
  }

  function clamp01(v) {
    return Math.min(1, Math.max(0, v));
  }

  function smoothstep(t) {
    return t * t * (3 - 2 * t);
  }

  function initCassette() {
    const hero = $("#hero");
    const stage = $("#hero-stage");
    const cassette = $("#cassette");
    const anchor = $("#anchor-start");
    const slot = $("#deck-slot");
    const door = $("#deck-door");
    const intro = $("#hero-intro");
    const status = $("#deck-status");
    const cue = $("#scroll-cue");
    if (!hero || !stage || !cassette || !anchor || !slot || !door || !intro || !status || !cue) return;

    const STATUS = [
      "вставь кассету — прокрути вниз",
      "ещё немного…",
      "щёлк",
      "▶ играет: MONTENEGRO ’26, side A",
    ];

    let fired = false;
    let ticking = false;
    let lastPlaying = false;

    function render() {
      const rect = hero.getBoundingClientRect();
      const total = hero.offsetHeight - window.innerHeight;
      const p = reduced() ? 1 : clamp01(total > 0 ? -rect.top / total : 0);

      if (rect.bottom < -200) {
        ticking = false;
        return;
      }

      const stageRect = stage.getBoundingClientRect();
      const aRect = anchor.getBoundingClientRect();
      const sRect = slot.getBoundingClientRect();
      const ax = aRect.left - stageRect.left + aRect.width / 2;
      const ay = aRect.top - stageRect.top + aRect.height / 2;
      const sx = sRect.left - stageRect.left + sRect.width / 2;
      const sy = sRect.top - stageRect.top + sRect.height / 2;
      const t = smoothstep(clamp01(p / 0.62));
      const shake = p > 0.5 && p < 0.68 ? Math.sin(p * 220) * 2.2 * (1 - t) : 0;
      cassette.style.transform =
        `translate(calc(-50% + ${ax + (sx - ax) * t + shake}px), calc(-50% + ${ay + (sy - ay) * t}px)) ` +
        `rotate(${-7 + 7 * t + shake * 0.4}deg) scale(${1 + (0.44 - 1) * t})`;
      cassette.style.opacity = String(clamp01(1 - (p - 0.58) / 0.1));
      intro.style.opacity = String(clamp01(1 - p / 0.34));
      intro.style.transform = `translateY(${-p * 70}px)`;
      cue.style.opacity = String(clamp01(1 - p / 0.22));
      const d = clamp01((p - 0.56) / 0.12);
      door.style.transform = `scaleY(${d})`;
      door.style.opacity = String(0.25 + d * 0.75);

      const playing = p > 0.66;
      if (playing !== lastPlaying) {
        lastPlaying = playing;
        document.body.classList.toggle("is-playing", playing);
      }
      if (playing && !fired) {
        fired = true;
        FX.startAmbient();
        if (!reduced()) {
          FX.clack();
          window.setTimeout(() => FX.clack(), 160);
          FX.rainNotes(isCompact() ? 1800 : 3600);
        }
      }
      if (!playing) fired = fired && p > 0.6;

      const si = p < 0.3 ? 0 : p < 0.56 ? 1 : p < 0.66 ? 2 : 3;
      if (status.dataset.i !== String(si)) {
        status.dataset.i = String(si);
        status.textContent = STATUS[si];
        status.classList.toggle("is-live", si === 3);
      }
      stage.style.setProperty("--away", String(clamp01((p - 0.74) / 0.26)));
      ticking = false;
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(render);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    requestAnimationFrame(render);
  }

  function onScrollFrame() {
    if (Date.now() < ignoreScrollDrive) return;
    if (followZooming) return;
    const target = targetFromScroll();
    if (!target) return;
    if (holdFollowY != null && Math.abs(window.scrollY - holdFollowY) < 48) {
      if (target.type === "overview" && !isOverview()) showOverview({ fly: true });
      else if (target.type === "day" && target.id !== activeDay) {
        setActiveDay(target.id, { fly: true, force: true });
      }
      return;
    }
    if (holdFollowY != null) holdFollowY = null;
    if (target.type === "overview") {
      if (!isOverview()) showOverview({ fly: true });
      return;
    }
    if (target.type === "stop") {
      const found = stopOf(target.id);
      if (!found) return;
      if (found.day.id !== activeDay) {
        setActiveDay(found.day.id, { fly: true, force: true });
        return;
      }
      if (target.id !== activeStop) {
        highlightStop(target.id, { fromScroll: true, fly: false });
      }
    } else if (target.type === "day") {
      if (target.id !== activeDay) setActiveDay(target.id, { fly: true, force: true });
    }
  }

  function bind() {
    $("#story").addEventListener("click", (e) => {
      const ov = e.target.closest("[data-ov]");
      if (ov) {
        if (!isOverview()) showOverview({ fly: false });
        const id = ov.dataset.ov;
        document.querySelectorAll(".spine li").forEach((el) => {
          el.classList.toggle("is-on", el.dataset.ov === id);
        });
        applyMarkerFocus("overview", id);
        ovMarkers.find((m) => m.ovId === id)?.openPopup();
        return;
      }
      const stop = e.target.closest(".stop");
      if (!stop || e.target.closest("a") || e.target.matches(".check")) return;
      highlightStop(stop.dataset.stop, { fly: true, fromScroll: false });
    });

    $("#story").addEventListener("change", (e) => {
      if (!e.target.matches(".check")) return;
      saved[e.target.dataset.id] = e.target.checked;
      localStorage.setItem("mne-tapes", JSON.stringify(saved));
    });

    $("#days-nav").addEventListener("click", (e) => {
      const a = e.target.closest("a");
      if (!a) return;
      e.preventDefault();
      const id = a.dataset.day;
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: "instant", block: "start" });
      if (id === "overview") showOverview({ fly: true });
      else setActiveDay(id, { fly: true, force: true });
      holdFollowY = window.scrollY;
      ignoreScrollDrive = Date.now() + 1100;
      history.replaceState(null, "", "#" + id);
    });

    $("#play-route").addEventListener("click", playRoute);
    $("#fit-route").addEventListener("click", fitActiveDay);
    $("#sat-toggle").addEventListener("click", () => {
      const usingSat = map.hasLayer(sat);
      if (usingSat) {
        map.removeLayer(sat);
        streets.addTo(map);
        $("#sat-toggle").textContent = "Спутник";
        $("#sat-toggle").classList.remove("is-on");
        $("#map").classList.remove("is-sat");
      } else {
        map.removeLayer(streets);
        sat.addTo(map);
        $("#sat-toggle").textContent = "Карта";
        $("#sat-toggle").classList.add("is-on");
        $("#map").classList.add("is-sat");
      }
    });

    const recTime = $("#rec-time");
    const start = Date.now();
    setInterval(() => {
      const s = Math.floor((Date.now() - start) / 1000);
      const mm = String(Math.floor(s / 60)).padStart(2, "0");
      const ss = String(s % 60).padStart(2, "0");
      recTime.textContent = `00:${mm}:${ss}`;
    }, 1000);

    let scrollTick = 0;
    window.addEventListener(
      "scroll",
      () => {
        if (scrollTick) return;
        scrollTick = requestAnimationFrame(() => {
          scrollTick = 0;
          onScrollFrame();
        });
      },
      { passive: true }
    );

    const mixtape = $("#mixtape");
    if (mixtape && !isCompact()) {
      const io = new IntersectionObserver(
        (entries) => {
          if (!entries[0].isIntersecting) return;
          FX.rainNotes(2400);
          io.disconnect();
        },
        { threshold: 0.32 }
      );
      io.observe(mixtape);
    }

    compactMq.addEventListener("change", () => {
      syncCompact();
      applyMapTouchMode();
    });
    window.addEventListener("resize", () => {
      syncCompact();
      refreshMapSize();
    });
    window.visualViewport?.addEventListener("resize", refreshMapSize);

    const road = $("#map-section");
    if (road) {
      const mapIo = new IntersectionObserver(
        (entries) => {
          if (entries[0].isIntersecting) refreshMapSize();
        },
        { threshold: 0.2 }
      );
      mapIo.observe(road);
    }
  }

  renderNav();
  renderStory();
  renderStays();
  renderTape();
  FX.init();
  initCassette();
  initMap();
  bind();
})();
