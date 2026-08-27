(() => {
  const { TRIP } = window;
  const $ = (sel, root = document) => root.querySelector(sel);

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

  let map, carMarker, streets, sat;
  const markers = {};
  let activeDay = null;
  let activeLine = null;
  let snakeRaf = 0;
  let dayToken = 0;
  let playing = false;

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

  function initMap() {
    map = L.map("map", {
      zoomControl: false,
      attributionControl: true,
      scrollWheelZoom: true,
    }).setView([42.44, 19.26], 10);

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
        m.on("click", () => highlightStop(stop.id, true));
        markers[stop.id] = m;
        m.addTo(map);
      });
    });

    carMarker = L.marker(TRIP.days[0].route[0], {
      icon: L.divIcon({
        className: "car-marker",
        html: "🚗",
        iconSize: [28, 28],
      }),
      zIndexOffset: 1000,
    }).addTo(map);

    setTimeout(() => {
      map.invalidateSize();
      setActiveDay(TRIP.days[0].id, { fly: false, force: true });
    }, 300);
  }

  function applyMarkerFocus(id) {
    Object.values(markers).forEach((m) => {
      const el = m.getElement();
      if (!el) return;
      const on = m.dayId === id;
      el.classList.toggle("is-off", !on);
      el.classList.toggle("is-on-day", on);
      if (!on) m.closePopup();
    });
  }

  function snakeDay(day, token) {
    if (snakeRaf) cancelAnimationFrame(snakeRaf);
    if (activeLine) {
      map.removeLayer(activeLine);
      activeLine = null;
    }
    const pts = day.route && day.route.length > 1 ? day.route : day.stops.map((s) => [s.lat, s.lng]);
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    activeLine = L.polyline(reduced ? pts : [pts[0]], {
      color: day.color,
      weight: 4.5,
      opacity: 0.95,
      lineCap: "round",
      className: "route-active",
    }).addTo(map);
    carMarker.setLatLng(pts[0]);
    if (reduced) {
      carMarker.setLatLng(pts[pts.length - 1]);
      return;
    }
    const dense = densify(pts, 110);
    const t0 = performance.now();
    const duration = 1100;
    function tick(now) {
      if (token !== dayToken) return;
      const t = Math.min(1, (now - t0) / duration);
      const ease = 1 - (1 - t) * (1 - t);
      const idx = Math.max(1, Math.floor(ease * (dense.length - 1)));
      activeLine.setLatLngs(dense.slice(0, idx + 1));
      carMarker.setLatLng(dense[idx]);
      if (t < 1) snakeRaf = requestAnimationFrame(tick);
    }
    snakeRaf = requestAnimationFrame(tick);
  }

  function setActiveDay(id, opts = {}) {
    const { fly = true, force = false, skipFit = false } = opts;
    if (!force && id === activeDay) return;
    const day = dayOf(id);
    if (!day) return;
    playing = false;
    const hud = $("#play-route");
    if (hud) hud.textContent = "Проиграть сторону";
    activeDay = id;
    dayToken += 1;
    const token = dayToken;

    document.querySelectorAll(".days-nav a").forEach((a) => {
      a.classList.toggle("is-on", a.dataset.day === id);
    });
    document.querySelectorAll(".day").forEach((el) => {
      el.classList.toggle("is-current", el.id === id);
    });
    const now = $("#map-now");
    if (now) {
      now.textContent = `${day.track} · ${day.date} · ${day.title}`;
    }

    applyMarkerFocus(id);
    requestAnimationFrame(() => applyMarkerFocus(id));
    snakeDay(day, token);

    const pts = day.route && day.route.length ? day.route : day.stops.map((s) => [s.lat, s.lng]);
    const b = L.latLngBounds(pts).pad(0.35);
    if (skipFit) return;
    if (fly) {
      map.flyToBounds(b, { duration: 1.15 });
      map.once("moveend", () => applyMarkerFocus(id));
    } else {
      map.fitBounds(b);
    }
  }

  function highlightStop(id, fly = true) {
    document.querySelectorAll(".stop").forEach((el) => {
      el.classList.toggle("is-on", el.dataset.stop === id);
    });
    const stopEl = document.querySelector(`[data-stop="${id}"]`);
    if (!stopEl) return;
    if (stopEl.dataset.day !== activeDay) {
      setActiveDay(stopEl.dataset.day, { fly: false, skipFit: true });
    }
    if (fly) {
      const lat = Number(stopEl.dataset.lat);
      const lng = Number(stopEl.dataset.lng);
      map.flyTo([lat, lng], 13, { duration: 0.9 });
      markers[id]?.openPopup();
    }
  }

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function playRoute() {
    const day = dayOf(activeDay);
    if (!day || playing) return;
    playing = true;
    const token = dayToken;
    const pts = densify(day.route, 160);
    const steps = pts.length - 1;
    let i = 0;
    const hud = $("#play-route");
    hud.textContent = "Идёт сторона…";
    if (activeLine) activeLine.setLatLngs([pts[0]]);

    function tick() {
      if (!playing || token !== dayToken) {
        hud.textContent = "Проиграть сторону";
        return;
      }
      const t = i / steps;
      const f = t * (pts.length - 1);
      const i0 = Math.floor(f);
      const i1 = Math.min(i0 + 1, pts.length - 1);
      const lt = f - i0;
      const lat = lerp(pts[i0][0], pts[i1][0], lt);
      const lng = lerp(pts[i0][1], pts[i1][1], lt);
      carMarker.setLatLng([lat, lng]);
      if (activeLine) activeLine.setLatLngs(pts.slice(0, i1 + 1));
      map.panTo([lat, lng], { animate: false });
      i += 1;
      if (i <= steps) {
        requestAnimationFrame(tick);
      } else {
        playing = false;
        hud.textContent = "Проиграть сторону";
        const b = L.latLngBounds(day.route);
        map.flyToBounds(b.pad(0.28), { duration: 0.8 });
      }
    }
    tick();
  }

  function fitActiveDay() {
    const day = dayOf(activeDay);
    if (!day) return;
    map.flyToBounds(L.latLngBounds(day.route).pad(0.3), { duration: 0.9 });
  }

  function bind() {
    $("#story").addEventListener("click", (e) => {
      const stop = e.target.closest(".stop");
      if (!stop || e.target.closest("a") || e.target.matches(".check")) return;
      highlightStop(stop.dataset.stop);
    });

    $("#story").addEventListener("change", (e) => {
      if (!e.target.matches(".check")) return;
      saved[e.target.dataset.id] = e.target.checked;
      localStorage.setItem("mne-tapes", JSON.stringify(saved));
    });

    $("#days-nav").addEventListener("click", (e) => {
      const a = e.target.closest("a");
      if (!a) return;
      setActiveDay(a.dataset.day, { fly: true, force: true });
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

    const days = [...document.querySelectorAll(".day")];
    const vis = {};
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          vis[en.target.id] = en.isIntersecting ? en.intersectionRatio : 0;
        });
        const best = Object.entries(vis).sort((a, b) => b[1] - a[1])[0];
        if (best && best[1] > 0.18) setActiveDay(best[0], { fly: true });
      },
      { rootMargin: "-28% 0px -42% 0px", threshold: [0, 0.18, 0.35, 0.55, 0.8] }
    );
    days.forEach((d) => io.observe(d));
  }

  function intro() {
    const root = $("#intro");
    const gone = sessionStorage.getItem("mne-intro") === "1";
    const close = () => {
      root.classList.add("is-gone");
      sessionStorage.setItem("mne-intro", "1");
      setTimeout(() => {
        map?.invalidateSize();
        if (activeDay) setActiveDay(activeDay, { fly: false, force: true });
      }, 400);
    };
    if (gone) {
      root.classList.add("is-gone");
      return;
    }
    $("#play").addEventListener("click", close);
    $("#skip").addEventListener("click", close);
    document.addEventListener(
      "keydown",
      (e) => {
        if (e.key === "Escape" || e.key === "Enter" || e.key === " ") close();
      },
      { once: true }
    );
  }

  renderNav();
  renderStory();
  renderStays();
  renderTape();
  intro();
  initMap();
  bind();
})();
