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

  function makeWave(x0, x1, y, amp, turns) {
    const steps = 48;
    let d = "";
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const x = x0 + (x1 - x0) * t;
      const yy = y + Math.sin(t * Math.PI * 2 * turns) * amp;
      d += `${i ? "L" : "M"}${x.toFixed(1)},${yy.toFixed(1)}`;
    }
    return d;
  }

  const ROAD_STOPS = [
    { name: "аэропорт", t: 0 },
    { name: "Подгорица", t: 0.18 },
    { name: "Котор", t: 0.38 },
    { name: "Дурмитор", t: 0.62 },
    { name: "Подгорица", t: 0.82 },
    { name: "аэропорт", t: 1 },
  ];

  const ROAD_CLOUDS = [
    { t: 0.07, s: 0.92 },
    { t: 0.22, s: 1.18 },
    { t: 0.37, s: 0.84 },
    { t: 0.52, s: 1.08 },
    { t: 0.68, s: 0.9 },
    { t: 0.84, s: 1.14 },
    { t: 0.96, s: 0.78 },
  ];

  const FILM = (() => {
    let frames = [];
    let drawPath = null;
    let ghostPath = null;
    let pathLen = 0;
    let carEl = null;
    let svgEl = null;
    let fluff = [];
    let stopDots = [];
    let imgA = null;
    let imgB = null;
    let front = "a";
    let currentSrc = "";
    let carT = 0;
    let raf = 0;
    let lastBest = 0;
    let pendingBg = "";
    let bgTimer = 0;
    let travelHold = 0;
    let shownNow = "";
    let nowTimer = 0;
    let glow = null;

    function paintRoad() {
      const svg = $("#road-svg");
      if (!svg) return;
      svgEl = svg;
      const d = makeWave(64, 1136, 118, 16, 2.15);
      svg.innerHTML = `
        <path class="road-ghost" id="road-ghost" d="${d}" fill="none"/>
        <path class="road-draw" id="road-draw" d="${d}" fill="none"/>
        <g id="road-clouds"></g>
        <g id="road-stops"></g>
        <g id="road-car">
          <g class="road-van" transform="translate(0,-11) scale(1.45)">
            <g class="road-exhaust">
              <circle class="road-puff-a" cx="-30" cy="-16" r="5.2"/>
              <circle class="road-puff-b" cx="-40" cy="-24" r="3.4"/>
            </g>
            <ellipse class="road-van-shadow" cx="0" cy="9" rx="20" ry="3.2"/>
            <path class="road-van-body" d="M-24 3h9l5-13h18l7 8h11v12H-24z"/>
            <rect class="road-van-stripe" x="-14" y="-1.5" width="30" height="3.2" rx="0.6"/>
            <rect class="road-van-glass" x="-8" y="-8.5" width="9.5" height="6" rx="1.1"/>
            <rect class="road-van-glass" x="3.5" y="-8.5" width="8.5" height="6" rx="1.1"/>
            <circle class="road-van-wheel" cx="-12" cy="10" r="5.4"/>
            <circle class="road-van-hub" cx="-12" cy="10" r="2.3"/>
            <circle class="road-van-wheel" cx="13" cy="10" r="5.4"/>
            <circle class="road-van-hub" cx="13" cy="10" r="2.3"/>
          </g>
        </g>`;
      ghostPath = $("#road-ghost");
      drawPath = $("#road-draw");
      carEl = $("#road-car");
      pathLen = ghostPath ? ghostPath.getTotalLength() : 0;
      if (drawPath && pathLen) {
        drawPath.style.strokeDasharray = String(pathLen);
        drawPath.style.strokeDashoffset = String(pathLen);
      }
      if (!ghostPath || !pathLen) return;

      const NS = "http://www.w3.org/2000/svg";
      const cloudRoot = $("#road-clouds");
      fluff = ROAD_CLOUDS.map((c, i) => {
        const p = ghostPath.getPointAtLength(c.t * pathLen);
        const g = document.createElementNS(NS, "g");
        g.classList.add("road-fluff");
        g.setAttribute("transform", `translate(${p.x.toFixed(1)} ${(p.y - 42).toFixed(1)}) scale(${c.s})`);
        g.style.opacity = "0";
        g.style.animationDelay = `${i * 0.4}s`;
        const path = document.createElementNS(NS, "path");
        path.setAttribute("d", "M0 12c4-11 18-13 24-3 7-10 22-8 24 3 10-2 13 10 3 13H4C-8 26-10 16-2 12z");
        g.appendChild(path);
        cloudRoot.appendChild(g);
        return { el: g, t: c.t };
      });

      const stopRoot = $("#road-stops");
      stopDots = ROAD_STOPS.map((s) => {
        const p = ghostPath.getPointAtLength(s.t * pathLen);
        const g = document.createElementNS(NS, "g");
        g.classList.add("road-stop");
        g.setAttribute("transform", `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)})`);
        const halo = document.createElementNS(NS, "circle");
        halo.setAttribute("class", "road-stop-halo");
        halo.setAttribute("r", "9");
        const dot = document.createElementNS(NS, "circle");
        dot.setAttribute("class", "road-stop-dot");
        dot.setAttribute("r", "4");
        const label = document.createElementNS(NS, "text");
        label.setAttribute("class", "road-stop-name");
        label.setAttribute("y", "22");
        label.textContent = s.name;
        g.appendChild(halo);
        g.appendChild(dot);
        g.appendChild(label);
        stopRoot.appendChild(g);
        return { el: g, t: s.t };
      });
    }

    function assignT() {
      frames = [...document.querySelectorAll(".frame")];
      const n = Math.max(1, frames.length - 1);
      frames.forEach((el, i) => {
        el.dataset.t = (i / n).toFixed(4);
      });
    }

    function focusFromRect(r, vh) {
      const mid = (r.top + r.bottom) / 2;
      const c = vh * 0.48;
      const span = vh * 0.4;
      return smoothstep(1 - Math.min(1, Math.abs(mid - c) / span));
    }

    function applyBg(src) {
      if (!src || src === currentSrc || !imgA || !imgB) return;
      const back = front === "a" ? imgB : imgA;
      const fore = front === "a" ? imgA : imgB;
      if (back.getAttribute("src") !== src) back.src = src;
      back.classList.add("is-on");
      fore.classList.remove("is-on");
      front = front === "a" ? "b" : "a";
      currentSrc = src;
    }

    function queueBg(src) {
      if (!src || src === currentSrc) return;
      pendingBg = src;
      window.clearTimeout(bgTimer);
      bgTimer = window.setTimeout(() => {
        bgTimer = 0;
        applyBg(pendingBg);
      }, 70);
    }

    function setNow(text) {
      const nowEl = $("#board-now");
      if (!nowEl || text === shownNow) return;
      shownNow = text;
      if (reduced()) {
        nowEl.textContent = text;
        return;
      }
      nowEl.classList.add("is-dim");
      window.clearTimeout(nowTimer);
      nowTimer = window.setTimeout(() => {
        nowEl.textContent = text;
        nowEl.classList.remove("is-dim");
      }, 160);
    }

    function placeCar(t) {
      if (!ghostPath || !pathLen) return;
      const d = clamp01(t) * pathLen;
      const p = ghostPath.getPointAtLength(d);
      const p2 = ghostPath.getPointAtLength(Math.min(pathLen, d + 10));
      const ang = (Math.atan2(p2.y - p.y, p2.x - p.x) * 180) / Math.PI;
      if (carEl) {
        carEl.setAttribute("transform", `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) rotate(${ang.toFixed(2)})`);
      }
      if (drawPath) drawPath.style.strokeDashoffset = String(pathLen * (1 - t));

      fluff.forEach((c) => {
        const appear = smoothstep(clamp01((t - (c.t - 0.1)) / 0.14));
        c.el.style.opacity = appear.toFixed(3);
      });
      stopDots.forEach((s) => {
        s.el.classList.toggle("is-passed", t >= s.t - 0.012);
        s.el.classList.toggle("is-here", Math.abs(t - s.t) < 0.045);
      });

      const say = $("#road-say");
      if (say && svgEl) {
        const ctm = svgEl.getScreenCTM();
        const road = $("#road");
        if (ctm && road) {
          const box = road.getBoundingClientRect();
          const x = ctm.a * p.x + ctm.e - box.left;
          const y = ctm.d * p.y + ctm.f - box.top;
          const maxX = Math.max(16, box.width - 188);
          say.style.setProperty("--say-x", `${Math.max(12, Math.min(maxX, x - 36)).toFixed(1)}px`);
          say.style.setProperty("--say-y", `${Math.max(4, y - 78).toFixed(1)}px`);
        }
      }
    }

    function filmProgress() {
      const plan = $("#plan");
      if (!plan) return 0;
      const vh = window.innerHeight;
      const top = window.scrollY + plan.getBoundingClientRect().top;
      const start = top - vh * 0.12;
      const end = top + plan.offsetHeight - vh * 0.72;
      return clamp01((window.scrollY - start) / Math.max(1, end - start));
    }

    function pickFrame(vh) {
      const c = vh * 0.48;
      let idx = lastBest;
      let bestDist = Infinity;
      let seen = false;
      frames.forEach((el, i) => {
        const r = el.getBoundingClientRect();
        if (r.bottom <= 48 || r.top >= vh - 48) return;
        seen = true;
        const mid = (r.top + r.bottom) / 2;
        let dist = Math.abs(mid - c);
        if (i === lastBest) dist -= vh * 0.06;
        if (dist < bestDist) {
          bestDist = dist;
          idx = i;
        }
      });
      return seen ? idx : lastBest;
    }

    function tick() {
      if (!frames.length) {
        raf = 0;
        return;
      }
      const vh = window.innerHeight;
      const motion = !reduced();
      const lerpF = motion ? 0.15 : 1;
      const lerpCar = motion ? 0.12 : 1;

      const raw = frames.map((el) => {
        const r = el.getBoundingClientRect();
        if (r.bottom < -vh * 0.2 || r.top > vh * 1.2) return 0;
        return motion
          ? focusFromRect(r, vh)
          : Math.abs((r.top + r.bottom) / 2 - vh * 0.5) < vh * 0.45
            ? 1
            : 0.18;
      });

      const best = pickFrame(vh);
      lastBest = best;

      let moving = false;
      frames.forEach((el, i) => {
        let target = raw[i];
        if (i === best) target = Math.max(target, 0.86);
        else target *= 0.42;
        const prev = parseFloat(el.style.getPropertyValue("--focus")) || 0;
        let next = prev + (target - prev) * lerpF;
        if (Math.abs(next - target) < 0.003) next = target;
        else moving = true;
        el.style.setProperty("--focus", next.toFixed(3));
        el.style.zIndex = String(4 + Math.round(next * 24));
      });

      const el = frames[best];
      if (!el) {
        raf = 0;
        return;
      }
      const day = el.dataset.day || "overview";
      if (day !== activeDay) {
        activeDay = day;
        document.querySelectorAll("#days-nav a").forEach((a) => {
          a.classList.toggle("is-on", a.dataset.day === day);
        });
        if (lastDayFlash && lastDayFlash !== day && el.classList.contains("frame--day")) FX.flash();
        lastDayFlash = day;
      }

      setNow(el.dataset.now || "");
      const playEl = $("#now-play");
      if (playEl) {
        const dayObj = TRIP.days.find((d) => d.id === day);
        playEl.textContent = dayObj ? `▶ ${dayObj.track}` : "▶ SIDE A";
      }

      queueBg(el.dataset.photo || currentSrc);

      const kind = el.dataset.kind;
      const shouldTravel = kind === "drive" || el.classList.contains("frame--reel");
      if (shouldTravel) travelHold = Math.min(4, travelHold + 1);
      else travelHold = Math.max(0, travelHold - 1);
      if (travelHold >= 3) {
        if (!traveling) FX.travelOn();
      } else if (travelHold <= 0 && traveling) {
        FX.travelOff();
      }

      const film = $("#film");
      if (film) {
        const fr = film.getBoundingClientRect();
        document.body.classList.toggle("is-on-road", fr.top < vh * 0.78 && fr.bottom > 90);
      }

      const t0 = filmProgress();
      const prevCar = carT;
      carT += (t0 - carT) * lerpCar;
      placeCar(clamp01(carT));
      if (Math.abs(carT - prevCar) > 0.0004) moving = true;
      updateTapeProgress();

      raf = moving ? requestAnimationFrame(tick) : 0;
    }

    function onScroll() {
      if (!raf) raf = requestAnimationFrame(tick);
    }

    function init() {
      imgA = $("#stage-a");
      imgB = $("#stage-b");
      glow = $("#scroll-glow");
      paintRoad();
      assignT();
      const first = photoUrl("road") || TRIP.photos.kotor;
      if (imgA && first) {
        imgA.src = first;
        imgA.classList.add("is-on");
        currentSrc = first;
      }
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll);
      onScroll();
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
