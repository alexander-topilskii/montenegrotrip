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

  const LAND = [
    [41.877, 19.247],
    [41.93, 19.18],
    [42.05, 19.1],
    [42.18, 18.97],
    [42.28, 18.84],
    [42.39, 18.71],
    [42.486, 18.698],
    [42.45, 18.53],
    [42.42, 18.44],
    [42.58, 18.5],
    [42.76, 18.66],
    [42.96, 18.8],
    [43.16, 18.88],
    [43.35, 19.02],
    [43.548, 19.22],
    [43.5, 19.48],
    [43.3, 19.7],
    [43.08, 19.92],
    [42.88, 20.08],
    [42.84, 20.166],
    [42.68, 19.98],
    [42.52, 19.74],
    [42.4, 19.52],
    [42.26, 19.4],
    [42.08, 19.36],
    [41.94, 19.3],
  ];

  const CITIES = [
    { name: "Котор", lat: 42.425, lng: 18.771 },
    { name: "Ловчен", lat: 42.4, lng: 18.82 },
    { name: "Подгорица", lat: 42.441, lng: 19.262 },
    { name: "Шавник", lat: 42.956, lng: 19.097 },
    { name: "Дурмитор", lat: 43.155, lng: 19.123 },
  ];

  let userPaused = false;
  let dockedDeck = false;
  let inserted = false;
  let activeDay = "overview";
  let lastDayFlash = "";
  let traveling = false;

  function photoUrl(key) {
    return (key && TRIP.photos[key]) || "";
  }

  function clamp01(v) {
    return Math.min(1, Math.max(0, v));
  }

  function smoothstep(t) {
    return t * t * (3 - 2 * t);
  }

  function escapeAttr(s) {
    return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
  }

  function renderNav() {
    const ov = `<a href="#overview" data-day="overview" title="Вся плёнка">◯</a>`;
    $("#days-nav").innerHTML =
      ov +
      TRIP.days
        .map((d) => `<a href="#${d.id}" data-day="${d.id}" title="${d.date}">${d.date.split(" ")[0]}</a>`)
        .join("");
  }

  function ticketMarkup(stop, day, i) {
    const n = String(i + 1).padStart(2, "0");
    const checked = saved[stop.id] ? "checked" : "";
    return `
      <article class="ticket" id="stop-${stop.id}" data-kind="${stop.kind}">
        <input class="check" type="checkbox" data-id="${stop.id}" ${checked} aria-label="Отметить: ${stop.name}">
        <div>
          <p class="frame-kicker">${n} · ${kinds[stop.kind] || stop.kind} · ${stop.dur}</p>
          <h3>${stop.name}</h3>
          <p class="frame-note">${stop.note}</p>
        </div>
        <span class="kind">${stop.time}</span>
      </article>`;
  }

  function shotMarkup(stop, day, i, src) {
    const n = String(i + 1).padStart(2, "0");
    const checked = saved[stop.id] ? "checked" : "";
    const tilt = i % 2 ? 2.4 : -2.8;
    return `
      <article class="frame frame--shot" id="stop-${stop.id}"
        data-day="${day.id}" data-photo="${src}" data-kind="${stop.kind}"
        data-lat="${stop.lat}" data-lng="${stop.lng}" data-now="${escapeAttr(stop.name)}"
        style="--day:${day.color}; --tilt:${tilt}">
        <figure class="frame-shot">
          <img src="${src}" alt="" loading="lazy" decoding="async">
          <figcaption>${stop.name}</figcaption>
        </figure>
        <div class="frame-copy">
          <label class="frame-check">
            <input class="check" type="checkbox" data-id="${stop.id}" ${checked} aria-label="Отметить: ${stop.name}">
          </label>
          <p class="frame-kicker">${day.track} · ${n} · ${kinds[stop.kind] || stop.kind} · ${stop.dur}</p>
          <p class="frame-note">${stop.note}</p>
        </div>
      </article>`;
  }

  function reelMarkup(stops, day, startIndex) {
    const last = stops[stops.length - 1];
    const src = photoUrl(day.photo);
    const names = stops.map((s) => s.name).join(" · ");
    return `
      <article class="frame frame--reel" data-day="${day.id}" data-photo="${src}" data-kind="${stops[0].kind}"
        data-lat="${last.lat}" data-lng="${last.lng}" data-now="${escapeAttr(names)}"
        style="--day:${day.color}">
        <div class="frame-cluster">
          ${stops.map((s, k) => ticketMarkup(s, day, startIndex + k)).join("")}
        </div>
      </article>`;
  }

  function renderPlan() {
    const ov = TRIP.overview;
    const hero = photoUrl("road") || TRIP.photos.kotor;
    const overviewHtml = `
      <article class="frame frame--over" id="overview"
        data-day="overview" data-photo="${hero}" data-kind="vista"
        data-lat="${ov.points[0].lat}" data-lng="${ov.points[0].lng}"
        data-now="вся плёнка" style="--day:${ov.color}; --tilt:-1.6">
        <figure class="frame-shot">
          <img src="${hero}" alt="" decoding="async">
          <figcaption>шесть дней, одна сторона</figcaption>
        </figure>
        <header class="frame-copy">
          <p class="frame-kicker">${ov.slug}</p>
          <h2>${ov.title}</h2>
          <p class="frame-note">${ov.summary}</p>
          <ol class="spine">
            ${ov.points
              .map(
                (p) => `
              <li data-go="${p.id === "ov-tgd" || p.id === "ov-pg" ? "sep5" : p.id === "ov-kotor" ? "sep6" : p.id === "ov-park" ? "sep8" : "sep10"}">
                <span class="n">${p.n}</span>
                <div><h3>${p.name}</h3><p>${p.place}</p></div>
              </li>`
              )
              .join("")}
          </ol>
        </header>
      </article>`;

    const daysHtml = TRIP.days
      .map((day) => {
        const src = photoUrl(day.photo);
        const first = day.stops[0];
        const chapter = `
          <article class="frame frame--day" id="${day.id}"
            data-day="${day.id}" data-photo="${src}" data-kind="day"
            data-lat="${first.lat}" data-lng="${first.lng}" data-now="${escapeAttr(day.title)}"
            style="--day:${day.color}; --tilt:${day.hwy % 2 ? -2.2 : 2}">
            <figure class="frame-shot">
              <img src="${src}" alt="${day.caption}" loading="lazy" decoding="async">
              <figcaption>${day.caption}</figcaption>
            </figure>
            <header class="frame-copy">
              <p class="frame-kicker">${day.track} · ${day.date} · ${day.weekday}</p>
              <h2>${day.title}</h2>
              <p class="frame-lead">${day.slug}</p>
              <p class="frame-chips"><span>${day.drive}</span><span>${day.hours}</span></p>
            </header>
          </article>`;

        const parts = [];
        let buf = [];
        let bufAt = 0;
        day.stops.forEach((stop, i) => {
          const shot = photoUrl(stop.photo);
          if (shot) {
            if (buf.length) {
              parts.push(reelMarkup(buf, day, bufAt));
              buf = [];
            }
            parts.push(shotMarkup(stop, day, i, shot));
          } else {
            if (!buf.length) bufAt = i;
            buf.push(stop);
          }
        });
        if (buf.length) parts.push(reelMarkup(buf, day, bufAt));
        return chapter + parts.join("");
      })
      .join("");

    $("#plan").innerHTML = overviewHtml + daysHtml;
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
      .map((t) => `<li><b>${t.n}</b><span>${t.title}<br><small>${t.artist}</small></span></li>`)
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

    function kickTick() {
      if (raf || reduced() || !ctx) return;
      raf = requestAnimationFrame(tick);
    }

    function tick(t) {
      if (!ctx) return;
      const live = document.body.classList.contains("tape-on") || travel > 0.05;
      if (!live) {
        ctx.clearRect(0, 0, w, h);
        raf = 0;
        return;
      }
      ctx.clearRect(0, 0, w, h);
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
      el.style.setProperty("--dx", Math.random() * 36 - 18 + "px");
      el.style.setProperty("--rot", Math.random() * 70 - 35 + "deg");
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
      traveling = true;
      document.body.classList.add("is-traveling");
      kickTick();
      if (reduced()) return;
      window.clearInterval(sparkIv);
      sparkIv = window.setInterval(() => {
        const compact = isCompact();
        const roll = Math.random();
        const kind = compact ? (roll > 0.5 ? "star" : "snow") : roll > 0.55 ? "star" : roll > 0.22 ? "snow" : "spark";
        spawn(kind);
        if (!compact && Math.random() > 0.4) spawn("star");
        if (!compact && Math.random() > 0.55) spawn("snow");
        if (!compact && Math.random() > 0.8) spawn("note", { y: -8, size: 18 });
      }, isCompact() ? 220 : 90);
    }

    function travelOff() {
      travel = 0;
      traveling = false;
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
      const el = $("#stage-caption");
      if (!el) return;
      el.textContent = text;
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
      kickTick();
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
    }

    return { init, spawn, rainNotes, travelOn, travelOff, flash, caption, clack, startAmbient };
  })();

  const TAPE = (() => {
    const TARGET_VOL = 0.72;
    let audio = null;
    let unlocked = false;
    let wantPlay = false;
    let fadeRaf = 0;
    let armed = false;

    function node() {
      if (audio) return audio;
      audio = $("#tape-audio");
      if (!audio) {
        audio = new Audio("audio/rearview-horizon.mp3");
        audio.loop = true;
        audio.preload = "auto";
        audio.setAttribute("playsinline", "");
      }
      audio.loop = true;
      audio.preload = "auto";
      return audio;
    }

    function fadeVolume(to, ms) {
      const a = node();
      const from = a.volume;
      if (fadeRaf) cancelAnimationFrame(fadeRaf);
      if (ms < 1 || reduced()) {
        a.volume = to;
        return;
      }
      const t0 = performance.now();
      function tick(now) {
        const t = Math.min(1, (now - t0) / ms);
        a.volume = from + (to - from) * t;
        if (t < 1) fadeRaf = requestAnimationFrame(tick);
        else fadeRaf = 0;
      }
      fadeRaf = requestAnimationFrame(tick);
    }

    function armUnlock() {
      if (armed) return;
      armed = true;
      const kick = () => {
        armed = false;
        if (userPaused) return;
        if (wantPlay || inserted) play();
      };
      ["pointerdown", "keydown", "wheel", "touchstart"].forEach((ev) => {
        window.addEventListener(ev, kick, { once: true, capture: true, passive: true });
      });
    }

    function init() {
      const a = node();
      a.volume = TARGET_VOL;
      try {
        a.load();
      } catch (_) {
        /* ignore */
      }
      armUnlock();
    }

    async function play() {
      wantPlay = true;
      const a = node();
      if (!a.paused && unlocked) {
        document.body.classList.add("is-playing");
        document.body.classList.remove("is-paused");
        syncPlayButtons();
        return true;
      }
      a.muted = false;
      if (a.volume < 0.18) a.volume = 0.22;
      try {
        const p = a.play();
        fadeVolume(TARGET_VOL, 480);
        await p;
        unlocked = true;
        document.body.classList.add("is-playing");
        document.body.classList.remove("is-paused");
        syncPlayButtons();
        return true;
      } catch (_) {
        armUnlock();
        return false;
      }
    }

    function pause() {
      wantPlay = false;
      const a = node();
      fadeVolume(0, 220);
      window.setTimeout(() => {
        if (!wantPlay) a.pause();
      }, 240);
    }

    function stop() {
      wantPlay = false;
      const a = node();
      a.pause();
      a.currentTime = 0;
      a.volume = TARGET_VOL;
    }

    function isPlaying() {
      const a = node();
      return wantPlay && !a.paused;
    }

    function wantsPlay() {
      return wantPlay;
    }

    return { init, play, pause, stop, isPlaying, wantsPlay };
  })();

  function densify(latlngs, per = 10) {
    if (!latlngs || latlngs.length < 2) return latlngs ? latlngs.slice() : [];
    const out = [];
    for (let i = 0; i < latlngs.length - 1; i++) {
      const a = latlngs[i];
      const b = latlngs[i + 1];
      for (let s = 0; s < per; s++) {
        const t = s / per;
        out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
      }
    }
    out.push(latlngs[latlngs.length - 1]);
    return out;
  }

  function project(lat, lng) {
    const x = 22 + ((lng - 18.38) / (20.22 - 18.38)) * 196;
    const y = 18 + (1 - (lat - 41.85) / (43.58 - 41.85)) * 284;
    return [x, y];
  }

  function ptsPath(pts) {
    return pts
      .map((p, i) => {
        const [x, y] = project(p[0], p[1]);
        return `${i ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`;
      })
      .join(" ");
  }

  function nearestIndex(pts, lat, lng) {
    let bi = 0;
    let bd = Infinity;
    for (let i = 0; i < pts.length; i++) {
      const d = (pts[i][0] - lat) ** 2 + (pts[i][1] - lng) ** 2;
      if (d < bd) {
        bd = d;
        bi = i;
      }
    }
    return bi;
  }

  const FILM = (() => {
    let frames = [];
    let journey = [];
    let drawPath = null;
    let pathLen = 0;
    let carEl = null;
    let imgA = null;
    let imgB = null;
    let front = "a";
    let currentSrc = "";
    let carT = 0;
    let ticking = false;
    let glow = null;

    function buildJourney() {
      const pts = [];
      TRIP.days.forEach((day) => {
        const route = day.route && day.route.length > 1 ? day.route : day.stops.map((s) => [s.lat, s.lng]);
        densify(route, 8).forEach((p) => pts.push(p));
      });
      journey = pts;
    }

    function paintBoard() {
      const svg = $("#board-svg");
      if (!svg) return;
      const landD = ptsPath(LAND.concat([LAND[0]]));
      const ghostD = ptsPath(journey);
      const dayPaths = TRIP.days
        .map((day) => {
          const route = day.route && day.route.length > 1 ? day.route : day.stops.map((s) => [s.lat, s.lng]);
          return `<path class="board-day" d="${ptsPath(densify(route, 6))}" stroke="${day.color}" />`;
        })
        .join("");
      const labels = CITIES.map((c) => {
        const [x, y] = project(c.lat, c.lng);
        return `<text class="board-label" x="${x.toFixed(1)}" y="${(y - 6).toFixed(1)}">${c.name}</text>`;
      }).join("");
      svg.innerHTML = `
        <defs>
          <filter id="board-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="1.6" result="b"/>
            <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
          </filter>
        </defs>
        <path class="board-land" d="${landD}" />
        <path class="board-ghost" d="${ghostD}" />
        ${dayPaths}
        <path class="board-draw" id="board-draw" d="${ghostD}" />
        ${labels}
        <g id="board-car" filter="url(#board-glow)">
          <circle class="car-halo" r="9" />
          <circle class="car-core" r="3.4" />
        </g>`;
      drawPath = $("#board-draw");
      carEl = $("#board-car");
      pathLen = drawPath ? drawPath.getTotalLength() : 0;
      if (drawPath && pathLen) {
        drawPath.style.strokeDasharray = String(pathLen);
        drawPath.style.strokeDashoffset = String(pathLen);
      }

      const trace = $("#stage-trace");
      if (trace) {
        trace.innerHTML = `
          <path class="trace-land" d="${landD}" />
          <path class="trace-draw" d="${ghostD}" />`;
      }
    }

    function assignT() {
      frames = [...document.querySelectorAll(".frame")];
      frames.forEach((el) => {
        const lat = parseFloat(el.dataset.lat);
        const lng = parseFloat(el.dataset.lng);
        if (!journey.length || Number.isNaN(lat)) {
          el.dataset.t = "0";
          return;
        }
        const i = nearestIndex(journey, lat, lng);
        el.dataset.t = (i / Math.max(1, journey.length - 1)).toFixed(4);
      });
    }

    function focusOf(el) {
      const r = el.getBoundingClientRect();
      const mid = (r.top + r.bottom) / 2;
      const c = window.innerHeight * 0.5;
      const span = window.innerHeight * 0.58;
      return smoothstep(1 - Math.min(1, Math.abs(mid - c) / span));
    }

    function setBg(src) {
      if (!src || src === currentSrc || !imgA || !imgB) return;
      const back = front === "a" ? imgB : imgA;
      const fore = front === "a" ? imgA : imgB;
      if (back.getAttribute("src") !== src) back.src = src;
      back.classList.add("is-on");
      fore.classList.remove("is-on");
      front = front === "a" ? "b" : "a";
      currentSrc = src;
    }

    function placeCar(t) {
      if (!drawPath || !carEl) return;
      if (!pathLen) {
        pathLen = drawPath.getTotalLength();
        if (pathLen) {
          drawPath.style.strokeDasharray = String(pathLen);
        }
      }
      if (!pathLen) return;
      const p = drawPath.getPointAtLength(t * pathLen);
      carEl.setAttribute("transform", `translate(${p.x.toFixed(2)} ${p.y.toFixed(2)})`);
      drawPath.style.strokeDashoffset = String(pathLen * (1 - t));
    }

    function tick() {
      ticking = false;
      if (!frames.length) return;
      const vh = window.innerHeight;
      let best = 0;
      let bestF = -1;
      frames.forEach((el, i) => {
        const r = el.getBoundingClientRect();
        if (r.bottom < -40 || r.top > vh + 40) {
          el.style.setProperty("--focus", "0");
          return;
        }
        const f = reduced() ? (Math.abs((r.top + r.bottom) / 2 - vh * 0.5) < vh * 0.45 ? 1 : 0.35) : focusOf(el);
        el.style.setProperty("--focus", f.toFixed(3));
        if (f > bestF) {
          bestF = f;
          best = i;
        }
      });

      const el = frames[best];
      if (!el) return;
      const day = el.dataset.day || "overview";
      if (day !== activeDay) {
        activeDay = day;
        document.querySelectorAll("#days-nav a").forEach((a) => {
          a.classList.toggle("is-on", a.dataset.day === day);
        });
        if (lastDayFlash && lastDayFlash !== day && el.classList.contains("frame--day")) FX.flash();
        lastDayFlash = day;
      }

      const now = el.dataset.now || "";
      const nowEl = $("#board-now");
      if (nowEl && nowEl.textContent !== now) nowEl.textContent = now;
      const playEl = $("#now-play");
      if (playEl) {
        const dayObj = TRIP.days.find((d) => d.id === day);
        playEl.textContent = dayObj ? `▶ ${dayObj.track}` : "▶ SIDE A";
      }
      FX.caption(now);

      setBg(el.dataset.photo || currentSrc);

      const kind = el.dataset.kind;
      const shouldTravel = kind === "drive" || el.classList.contains("frame--reel");
      if (shouldTravel) FX.travelOn();
      else FX.travelOff();

      const t0 = parseFloat(el.dataset.t) || 0;
      carT += (t0 - carT) * (reduced() ? 1 : 0.18);
      placeCar(clamp01(carT));
      updateTapeProgress();
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(tick);
    }

    function init() {
      imgA = $("#stage-a");
      imgB = $("#stage-b");
      glow = $("#scroll-glow");
      buildJourney();
      paintBoard();
      assignT();
      const first = photoUrl("road") || TRIP.photos.kotor;
      if (imgA && first) {
        imgA.src = first;
        imgA.classList.add("is-on");
        currentSrc = first;
      }
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll);
      requestAnimationFrame(tick);
    }

    return { init, tick };
  })();

  function cassetteProgress() {
    const hero = $("#hero");
    if (!hero) return 1;
    const total = hero.offsetHeight - window.innerHeight;
    const rect = hero.getBoundingClientRect();
    return clamp01(total > 0 ? -rect.top / total : 0);
  }

  function setTapeProgress(t) {
    const el = $("#bar-deck");
    if (!el) return;
    el.style.setProperty("--tape", clamp01(t).toFixed(3));
  }

  function updateTapeProgress() {
    const hero = $("#hero");
    const film = $("#film");
    if (!hero || !film) return;
    const hr = hero.getBoundingClientRect();
    if (hr.bottom > 100) {
      setTapeProgress(cassetteProgress() * 0.1);
      return;
    }
    const top = film.offsetTop - window.innerHeight * 0.12;
    const end = film.offsetTop + film.offsetHeight - window.innerHeight * 0.7;
    setTapeProgress(0.1 + 0.9 * clamp01((window.scrollY - top) / Math.max(1, end - top)));
    const glow = $("#scroll-glow");
    if (glow) {
      const on = hr.bottom < 80 && film.getBoundingClientRect().bottom > 120;
      glow.classList.toggle("is-on", on);
    }
  }

  function syncPlayButtons() {
    const on = TAPE.isPlaying();
    const label = on ? "❚❚" : "▶";
    document.querySelectorAll(".js-tape-play").forEach((btn) => {
      btn.textContent = label;
      btn.setAttribute("aria-label", on ? "Пауза" : "Play");
    });
  }

  function stopTape() {
    FX.travelOff();
    userPaused = true;
    TAPE.stop();
    document.body.classList.remove("is-playing");
    document.body.classList.add("is-paused");
    syncPlayButtons();
  }

  function togglePlay() {
    if (TAPE.isPlaying()) {
      userPaused = true;
      TAPE.pause();
      document.body.classList.remove("is-playing");
      document.body.classList.add("is-paused");
      syncPlayButtons();
      return;
    }
    userPaused = false;
    TAPE.play();
    syncPlayButtons();
  }

  function dayIds() {
    return ["overview", ...TRIP.days.map((d) => d.id)];
  }

  function goToDay(id) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: reduced() ? "auto" : "smooth", block: "center" });
    history.replaceState(null, "", "#" + id);
  }

  function skipDay(dir) {
    const ids = dayIds();
    const i = Math.max(0, ids.indexOf(activeDay || "overview"));
    const next = ids[i + dir];
    if (!next) return;
    goToDay(next);
  }

  function setDeckDocked(on) {
    if (on === dockedDeck) return;
    dockedDeck = on;
    document.documentElement.classList.toggle("deck-docked", on);
  }

  function tryStartTape(e) {
    if (userPaused) return;
    if (e && e.target && e.target.closest && e.target.closest(".js-tape-play, [data-tape]")) return;
    if (inserted || cassetteProgress() > 0.66) TAPE.play();
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
    TAPE.init();

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
        updateTapeProgress();
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
      inserted = playing || dockedDeck;
      if (playing !== lastPlaying) {
        lastPlaying = playing;
        if (playing && !userPaused) document.body.classList.add("is-playing");
        else if (!playing && p < 0.18) document.body.classList.remove("is-playing");
      }
      if (p > 0.66) setDeckDocked(true);
      else if (p < 0.18) {
        setDeckDocked(false);
        inserted = false;
        if (fired) {
          TAPE.stop();
          userPaused = false;
        }
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
      if (!playing && p < 0.5) fired = false;

      const si = p < 0.3 ? 0 : p < 0.56 ? 1 : p < 0.66 ? 2 : 3;
      if (status.dataset.i !== String(si)) {
        status.dataset.i = String(si);
        status.textContent = STATUS[si];
        status.classList.toggle("is-live", si === 3);
      }
      stage.style.setProperty("--away", String(clamp01((p - 0.74) / 0.26)));
      updateTapeProgress();
      ticking = false;
    }

    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(render);
    }

    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    window.addEventListener("pointerdown", tryStartTape, { capture: true, passive: true });
    window.addEventListener("wheel", tryStartTape, { capture: true, passive: true });
    window.addEventListener("touchstart", tryStartTape, { capture: true, passive: true });
    window.addEventListener("keydown", tryStartTape, { capture: true });
    requestAnimationFrame(render);
  }

  function bind() {
    $("#plan").addEventListener("click", (e) => {
      const go = e.target.closest("[data-go]");
      if (go) {
        goToDay(go.dataset.go);
        return;
      }
    });

    $("#plan").addEventListener("change", (e) => {
      if (!e.target.matches(".check")) return;
      saved[e.target.dataset.id] = e.target.checked;
      localStorage.setItem("mne-tapes", JSON.stringify(saved));
    });

    $("#days-nav").addEventListener("click", (e) => {
      const a = e.target.closest("a");
      if (!a) return;
      e.preventDefault();
      goToDay(a.dataset.day);
    });

    document.querySelectorAll(".js-tape-play").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        togglePlay();
      });
    });
    document.querySelectorAll("[data-tape]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const act = btn.dataset.tape;
        if (act === "rew") skipDay(-1);
        else if (act === "ff") skipDay(1);
        else if (act === "stop") stopTape();
      });
    });

    const recTime = $("#rec-time");
    const start = Date.now();
    setInterval(() => {
      const s = Math.floor((Date.now() - start) / 1000);
      const mm = String(Math.floor(s / 60)).padStart(2, "0");
      const ss = String(s % 60).padStart(2, "0");
      recTime.textContent = `00:${mm}:${ss}`;
    }, 1000);

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

    compactMq.addEventListener("change", syncCompact);
    window.addEventListener("resize", syncCompact);

    if (location.hash) {
      const id = location.hash.slice(1);
      const el = document.getElementById(id);
      if (el) requestAnimationFrame(() => el.scrollIntoView({ block: "center" }));
    }
  }

  function initTheme() {
    const root = document.documentElement;
    const btn = $("#theme-btn");
    if (!btn) return;

    function paint(theme) {
      root.dataset.theme = theme;
      localStorage.setItem("mne-theme", theme);
      const light = theme === "light";
      btn.textContent = light ? "ночь" : "день";
      btn.setAttribute("aria-label", light ? "Тёмная тема" : "Светлая тема");
    }

    paint(root.dataset.theme === "light" ? "light" : "dark");
    btn.addEventListener("click", () => {
      paint(root.dataset.theme === "dark" ? "light" : "dark");
    });
  }

  renderNav();
  renderPlan();
  renderStays();
  renderTape();
  FX.init();
  initCassette();
  FILM.init();
  initTheme();
  bind();
})();
