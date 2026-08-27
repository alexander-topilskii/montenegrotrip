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
    optional: "опционально",
    vista: "вид",
    fun: "аттракцион",
    tip: "заметка",
    skip: "skip",
  };

  const saved = JSON.parse(localStorage.getItem("mne-tapes") || "{}");

  function renderStory() {
    const root = $("#story");
    root.innerHTML = TRIP.days
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
    $("#days-nav").innerHTML = TRIP.days
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
      moth: ["🦋"],
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
          : roll > 0.72
            ? "moth"
            : roll > 0.42
              ? "star"
              : roll > 0.18
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
        spawn(Math.random() > 0.65 ? "moth" : "spark");
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
  const denseCache = {};
  let ritualDone = sessionStorage.getItem("mne-tape-ritual") === "1";
  let sawInsert = false;
  let ignoreScrollDrive = 0;

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

  function denseRoute(day, n = 130) {
    if (!denseCache[day.id]) {
      const pts = day.route && day.route.length > 1 ? day.route : day.stops.map((s) => [s.lat, s.lng]);
      denseCache[day.id] = densify(pts, n);
    }
    return denseCache[day.id];
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

  function bearingDeg(a, b) {
    const dLng = ((b[1] - a[1]) * Math.PI) / 180;
    const lat1 = (a[0] * Math.PI) / 180;
    const lat2 = (b[0] * Math.PI) / 180;
    const y = Math.sin(dLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
    return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  }

  function setCarBearing(a, b) {
    const el = carMarker?.getElement()?.querySelector(".car-rot");
    if (!el) return;
    if (almost(a, b, 0.00005)) return;
    el.style.transform = `rotate(${bearingDeg(a, b) - 90}deg)`;
  }

  function pathDuration(pts) {
    let d = 0;
    for (let i = 1; i < pts.length; i++) {
      d += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    }
    return Math.min(isCompact() ? 1800 : 2600, Math.max(420, d * (isCompact() ? 1200 : 1700) + pts.length * 7));
  }

  function buildPath(day, destLL) {
    const dense = denseRoute(day);
    const cur = carMarker.getLatLng();
    const startLL = [cur.lat, cur.lng];
    const iDest = nearestIndex(dense, destLL);
    const iFrom = nearestIndex(dense, startLL);
    const onRoute = almost(startLL, dense[iFrom], 0.06);
    if (onRoute) {
      if (iFrom === iDest) return [dense[iDest]];
      return iFrom < iDest ? dense.slice(iFrom, iDest + 1) : dense.slice(iDest, iFrom + 1).reverse();
    }
    const onto = densify([startLL, dense[iFrom]], 30);
    const along =
      iFrom <= iDest ? dense.slice(iFrom, iDest + 1) : dense.slice(iDest, iFrom + 1).reverse();
    return onto.concat(along.slice(1));
  }

  function updateProgressLine(day, carLL) {
    const dense = denseRoute(day);
    const idx = nearestIndex(dense, carLL);
    if (ghostLine) ghostLine.setLatLngs(dense);
    if (activeLine) activeLine.setLatLngs(dense.slice(0, Math.max(2, idx + 1)));
  }

  function keepCarInView(ll) {
    if (!map) return;
    const pad = isCompact() ? -0.16 : -0.28;
    const inner = map.getBounds().pad(pad);
    if (!inner.contains(ll)) map.panTo(ll, { animate: false });
  }

  function paintDayLines(day) {
    const dense = denseRoute(day);
    if (ghostLine) map.removeLayer(ghostLine);
    if (activeLine) map.removeLayer(activeLine);
    ghostLine = L.polyline(dense, {
      color: day.color,
      weight: 3,
      opacity: 0.28,
      lineCap: "round",
      className: "route-ghost",
    }).addTo(map);
    const cur = carMarker.getLatLng();
    const idx = nearestIndex(dense, [cur.lat, cur.lng]);
    activeLine = L.polyline(dense.slice(0, Math.max(2, idx + 1)), {
      color: day.color,
      weight: 4.5,
      opacity: 0.95,
      lineCap: "round",
      className: "route-active",
    }).addTo(map);
  }

  function driveAlong(pts, opts = {}) {
    const { onDone, pan = true, notes = false, zoomAfter = null } = opts;
    driveToken += 1;
    const token = driveToken;
    if (driveRaf) cancelAnimationFrame(driveRaf);
    if (!pts || pts.length < 2) {
      if (pts?.[0]) {
        carMarker.setLatLng(pts[0]);
        const day = dayOf(activeDay);
        if (day) updateProgressLine(day, pts[0]);
      }
      onDone?.();
      return;
    }
    traveling = true;
    FX.travelOn();
    if (notes) FX.rainNotes(Math.min(2800, pathDuration(pts)));
    if (reduced()) {
      const last = pts[pts.length - 1];
      carMarker.setLatLng(last);
      const day = dayOf(activeDay);
      if (day) updateProgressLine(day, last);
      traveling = false;
      FX.travelOff();
      onDone?.();
      return;
    }
    const t0 = performance.now();
    const dur = opts.duration || pathDuration(pts);
    function tick(now) {
      if (token !== driveToken) {
        const hud = $("#play-route");
        if (hud) hud.textContent = "Проиграть сторону";
        return;
      }
      const t = Math.min(1, (now - t0) / dur);
      const ease = t < 0.5 ? 2 * t * t : 1 - (-2 * t + 2) ** 2 / 2;
      const f = ease * (pts.length - 1);
      const i0 = Math.floor(f);
      const i1 = Math.min(i0 + 1, pts.length - 1);
      const lt = f - i0;
      const lat = lerp(pts[i0][0], pts[i1][0], lt);
      const lng = lerp(pts[i0][1], pts[i1][1], lt);
      const ll = [lat, lng];
      carMarker.setLatLng(ll);
      setCarBearing(pts[i0], pts[i1]);
      const day = dayOf(activeDay);
      if (day) updateProgressLine(day, ll);
      if (pan) keepCarInView(ll);
      if (t < 1) {
        driveRaf = requestAnimationFrame(tick);
      } else {
        traveling = false;
        FX.travelOff();
        if (opts.flash !== false && pts.length > 10) FX.flash();
        if (zoomAfter) map.flyTo(pts[pts.length - 1], zoomAfter, { duration: 0.7 });
        onDone?.();
      }
    }
    driveRaf = requestAnimationFrame(tick);
  }

  function applyMarkerFocus(id, stopId) {
    Object.values(markers).forEach((m) => {
      const el = m.getElement();
      if (!el) return;
      const on = m.dayId === id;
      el.classList.toggle("is-off", !on);
      el.classList.toggle("is-on-day", on);
      el.classList.toggle("is-target", !!stopId && m.stopId === stopId);
      if (!on) m.closePopup();
    });
  }

  function setActiveDay(id, opts = {}) {
    const { fly = false, force = false } = opts;
    if (!force && id === activeDay) return;
    const day = dayOf(id);
    if (!day) return;
    activeDay = id;

    document.querySelectorAll(".days-nav a").forEach((a) => {
      a.classList.toggle("is-on", a.dataset.day === id);
    });
    document.querySelectorAll(".day").forEach((el) => {
      el.classList.toggle("is-current", el.id === id);
    });
    const now = $("#map-now");
    if (now) now.textContent = `${day.track} · ${day.date} · ${day.title}`;

    applyMarkerFocus(id, activeStop);
    requestAnimationFrame(() => applyMarkerFocus(id, activeStop));
    paintDayLines(day);

    if (fly) {
      const pts = denseRoute(day);
      map.flyToBounds(L.latLngBounds(pts).pad(isCompact() ? 0.5 : 0.32), {
        duration: isCompact() ? 0.65 : 0.95,
      });
    } else if (isCompact()) {
      map.fitBounds(L.latLngBounds(denseRoute(day)).pad(0.48), { animate: false });
    }
  }

  function highlightStop(id, opts = {}) {
    const { fly = false, fromScroll = false, openPop = !fromScroll && !isCompact() } = opts;
    const found = stopOf(id);
    if (!found) return;
    const { stop, day } = found;
    const same = id === activeStop && day.id === activeDay;

    document.querySelectorAll(".stop").forEach((el) => {
      el.classList.toggle("is-on", el.dataset.stop === id);
    });

    if (day.id !== activeDay) setActiveDay(day.id, { fly: false, force: true });
    activeStop = id;
    applyMarkerFocus(day.id, id);

    const now = $("#map-now");
    if (now) now.textContent = `${day.track} · ${stop.name}`;

    const dest = [stop.lat, stop.lng];
    const cur = carMarker.getLatLng();
    if (same && almost([cur.lat, cur.lng], dest)) {
      if (fly && !isCompact()) map.flyTo(dest, 13, { duration: 0.75 });
      else if (isCompact()) map.panTo(dest, { animate: true, duration: 0.4 });
      if (openPop) markers[id]?.openPopup();
      return;
    }

    const path = buildPath(day, dest);
    if (!fromScroll) ignoreScrollDrive = Date.now() + pathDuration(path) + 120;
    driveAlong(path, {
      pan: true,
      zoomAfter: fly && !isCompact() ? 13 : null,
      onDone: () => {
        FX.caption(stop.name);
        applyMarkerFocus(day.id, id);
        if (isCompact()) map.panTo(dest, { animate: true, duration: 0.35 });
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
    toggle(map.touchZoom, !compact);
    toggle(map.scrollWheelZoom, !compact);
    toggle(map.doubleClickZoom, !compact);
    toggle(map.keyboard, !compact);
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
      scrollWheelZoom: !compact,
      dragging: !compact,
      touchZoom: !compact,
      doubleClickZoom: !compact,
      boxZoom: false,
      keyboard: !compact,
    }).setView([42.44, 19.26], compact ? 8.5 : 10);

    L.control.zoom({ position: "topright" }).addTo(map);

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

    carMarker = L.marker(TRIP.days[0].route[0], {
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
      setActiveDay(TRIP.days[0].id, { fly: false, force: true });
    }, 300);
  }

  function playRoute() {
    const day = dayOf(activeDay);
    if (!day || traveling) return;
    const hud = $("#play-route");
    const pts = denseRoute(day, 170);
    carMarker.setLatLng(pts[0]);
    hud.textContent = "Идёт сторона…";
    FX.rainNotes(2200);
    ignoreScrollDrive = Date.now() + 10000;
    driveAlong(pts, {
      duration: Math.min(9000, Math.max(2800, pts.length * 22)),
      pan: true,
      notes: true,
      onDone: () => {
        hud.textContent = "Проиграть сторону";
        map.flyToBounds(L.latLngBounds(day.route).pad(0.28), { duration: 0.8 });
      },
    });
  }

  function fitActiveDay() {
    const day = dayOf(activeDay);
    if (!day) return;
    map.flyToBounds(L.latLngBounds(day.route).pad(0.3), { duration: 0.9 });
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
    let bestDay = null;
    let bestDayD = Infinity;
    document.querySelectorAll(".day").forEach((el) => {
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

  function playTapeRitual() {
    if (ritualDone) return;
    ritualDone = true;
    sessionStorage.setItem("mne-tape-ritual", "1");
    FX.startAmbient();
    if (reduced() || sawInsert || isCompact()) {
      FX.rainNotes(isCompact() ? 1400 : 2600);
      return;
    }
    const overlay = $("#tape-ritual");
    overlay.classList.add("is-on");
    FX.clack();
    window.setTimeout(() => FX.clack(), 180);
    FX.rainNotes(3800);
    window.setTimeout(() => overlay.classList.remove("is-on"), 2600);
  }

  function onScrollFrame() {
    const intro = $("#intro");
    if (intro && !intro.classList.contains("is-gone")) return;
    if (!ritualDone && window.scrollY > window.innerHeight * 0.12) playTapeRitual();
    if (Date.now() < ignoreScrollDrive) return;
    const target = targetFromScroll();
    if (!target) return;
    if (target.type === "stop" && target.id !== activeStop) {
      highlightStop(target.id, { fromScroll: true, fly: false });
    } else if (target.type === "day") {
      const day = dayOf(target.id);
      if (!day) return;
      const first = day.stops[0];
      if (first && first.id !== activeStop && activeDay !== day.id) {
        highlightStop(first.id, { fromScroll: true, fly: false });
      } else if (day.id !== activeDay) {
        setActiveDay(day.id, { fly: false, force: true });
      }
    }
  }

  function bind() {
    $("#story").addEventListener("click", (e) => {
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
      const day = dayOf(a.dataset.day);
      if (!day) return;
      setActiveDay(day.id, { fly: false, force: true });
      const first = day.stops[0];
      if (first) highlightStop(first.id, { fly: false, fromScroll: false, openPop: false });
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

  function intro() {
    const root = $("#intro");
    const gone = sessionStorage.getItem("mne-intro") === "1";
    const close = () => {
      root.classList.add("is-gone");
      sessionStorage.setItem("mne-intro", "1");
      FX.startAmbient();
      setTimeout(() => {
        refreshMapSize();
        if (activeDay) setActiveDay(activeDay, { fly: false, force: true });
      }, 400);
    };
    if (gone) {
      root.classList.add("is-gone");
      FX.startAmbient();
      return;
    }
    $("#play").addEventListener("click", () => {
      if (reduced()) {
        close();
        return;
      }
      sawInsert = true;
      root.classList.add("is-inserting");
      FX.clack();
      window.setTimeout(() => FX.clack(), 160);
      FX.rainNotes(isCompact() ? 1600 : 3400);
      window.setTimeout(close, isCompact() ? 1600 : 2600);
    });
    $("#skip").addEventListener("click", close);
    document.addEventListener(
      "keydown",
      (e) => {
        if (e.key === "Escape") close();
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          $("#play").click();
        }
      },
      { once: true }
    );
  }

  renderNav();
  renderStory();
  renderStays();
  renderTape();
  FX.init();
  intro();
  initMap();
  bind();
})();
