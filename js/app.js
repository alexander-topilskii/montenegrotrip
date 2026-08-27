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

  let map, carMarker, stopLayer, routeLine, streets, sat;
  const markers = {};

  function pinIcon(label, color) {
    return L.divIcon({
      className: "",
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

  function initMap() {
    map = L.map("map", {
      zoomControl: false,
      attributionControl: true,
      scrollWheelZoom: true,
    }).setView([42.75, 19.05], 8);

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

    routeLine = L.polyline(TRIP.route, {
      color: "#c45c26",
      weight: 3.5,
      opacity: 0.95,
      dashArray: "10 8",
      lineCap: "round",
    }).addTo(map);

    stopLayer = L.layerGroup().addTo(map);
    const seen = {};

    TRIP.days.forEach((day) => {
      day.stops.forEach((stop) => {
        const key = `${stop.lat.toFixed(3)},${stop.lng.toFixed(3)}`;
        seen[key] = (seen[key] || 0) + 1;
        const [lat, lng] = offsetCoord(stop.lat, stop.lng, seen[key] - 1);
        const m = L.marker([lat, lng], {
          icon: pinIcon(day.hwy.replace(/^0/, ""), day.color),
        }).bindPopup(
          `<div class="pop"><h3>${stop.name}</h3><p>${day.date} · ${stop.time}</p><p>${stop.note}</p></div>`
        );
        m.on("click", () => highlightStop(stop.id, false));
        markers[stop.id] = m;
        stopLayer.addLayer(m);
      });
    });

    carMarker = L.marker(TRIP.route[0], {
      icon: L.divIcon({
        className: "car-marker",
        html: "🚗",
        iconSize: [28, 28],
      }),
      zIndexOffset: 1000,
    }).addTo(map);

    map.fitBounds(routeLine.getBounds().pad(0.12));
    setTimeout(() => map.invalidateSize(), 300);
  }

  function highlightStop(id, fly = true) {
    document.querySelectorAll(".stop").forEach((el) => {
      el.classList.toggle("is-on", el.dataset.stop === id);
    });
    const stopEl = document.querySelector(`[data-stop="${id}"]`);
    if (stopEl && fly) {
      const lat = Number(stopEl.dataset.lat);
      const lng = Number(stopEl.dataset.lng);
      map.flyTo([lat, lng], 12, { duration: 1.1 });
      markers[id]?.openPopup();
    }
    if (stopEl) {
      document.querySelectorAll(".days-nav a").forEach((a) => {
        a.classList.toggle("is-on", a.dataset.day === stopEl.dataset.day);
      });
    }
  }

  function flyDay(id) {
    const day = TRIP.days.find((d) => d.id === id);
    if (!day) return;
    const pts = day.stops.map((s) => [s.lat, s.lng]);
    map.flyToBounds(L.latLngBounds(pts).pad(0.35), { duration: 1.2 });
    document.querySelectorAll(".days-nav a").forEach((a) => {
      a.classList.toggle("is-on", a.dataset.day === id);
    });
  }

  let playing = false;

  function lerp(a, b, t) {
    return a + (b - a) * t;
  }

  function playRoute() {
    if (playing) return;
    playing = true;
    const pts = TRIP.route;
    const steps = 280;
    let i = 0;
    const hud = $("#play-route");
    hud.textContent = "Идёт плёнка…";

    function tick() {
      const t = i / steps;
      const f = t * (pts.length - 1);
      const i0 = Math.floor(f);
      const i1 = Math.min(i0 + 1, pts.length - 1);
      const lt = f - i0;
      const lat = lerp(pts[i0][0], pts[i1][0], lt);
      const lng = lerp(pts[i0][1], pts[i1][1], lt);
      carMarker.setLatLng([lat, lng]);
      map.panTo([lat, lng], { animate: false });
      i += 1;
      if (i <= steps) {
        requestAnimationFrame(tick);
      } else {
        playing = false;
        hud.textContent = "Проиграть маршрут";
        map.fitBounds(routeLine.getBounds().pad(0.12));
      }
    }
    tick();
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
      flyDay(a.dataset.day);
    });

    $("#play-route").addEventListener("click", playRoute);
    $("#fit-route").addEventListener("click", () => {
      map.fitBounds(routeLine.getBounds().pad(0.12));
    });
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
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            document.querySelectorAll(".days-nav a").forEach((a) => {
              a.classList.toggle("is-on", a.dataset.day === en.target.id);
            });
          }
        });
      },
      { rootMargin: "-40% 0px -50% 0px", threshold: 0 }
    );
    days.forEach((d) => io.observe(d));
  }

  function intro() {
    const root = $("#intro");
    const gone = sessionStorage.getItem("mne-intro") === "1";
    const close = () => {
      root.classList.add("is-gone");
      sessionStorage.setItem("mne-intro", "1");
      setTimeout(() => map?.invalidateSize(), 400);
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
