/* =========================================================
   Глава IV «Мама...»: письмо по одной строке
   • строка письма стоит в центре неподвижно — её успевают прочесть
   • глава делится поровну между строками; со скроллом строка гаснет и сменяется следующей
   • прочитанная строка уходит в тусклое медленное кольцо по краям
     (кольца рисуются один раз, а вращает их CSS — это почти ничего не стоит)
   • когда строку отпускают, сбоку падает неотправленное письмо и сгорает
   ========================================================= */
(function () {
  const sec = document.getElementById("mama");
  const scene = document.getElementById("mamaScene");
  const canvas = document.getElementById("mamaCanvas");
  const letter = document.getElementById("mamaLetter");
  if (!sec || !scene || !canvas || !letter) return;

  const ctx = canvas.getContext("2d");
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };

  const RING_TEXT = Array.from(letter.querySelectorAll("[data-ring]")).map((p) => p.textContent.trim());
  const CENTER_TEXT = ((letter.querySelector("[data-center]") || {}).textContent || "").trim();
  const LINES = CENTER_TEXT ? RING_TEXT.concat([CENTER_TEXT]) : RING_TEXT.slice();
  const lineEl = document.getElementById("mamaLine");

  let W = 0, H = 0, dpr = 1, cx = 0, cy = 0, R = 0;
  let rings = [];          // { el } — холсты колец
  const ringsEl = document.createElement("div");
  ringsEl.className = "mama-rings";
  ringsEl.setAttribute("aria-hidden", "true");
  canvas.before(ringsEl);
  function showRings() { rings.forEach((rg, i) => rg.el.classList.toggle("is-on", wantIdx > i)); }
  let fontFamily = '"Broadsheet", "Old Standard TT", serif';
  let q = 0, visible = false;

  /* ---------- раскладка: кольца — только для уже прочитанных строк ---------- */
  function layout() {
    const rect = scene.getBoundingClientRect();
    W = rect.width; H = rect.height;
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    const head = scene.querySelector(".chapter__head");
    const top = head ? head.offsetTop + head.offsetHeight + 10 : 0;
    cx = W / 2;
    cy = top + (H - top) / 2;
    // кольца крупнее экрана по высоте — середина остаётся свободной для строки
    R = Math.max(Math.min(W * 0.46, (H - top) * 0.62), Math.min(W * 0.62, (H - top) * 0.5));
    fontFamily = getComputedStyle(document.body).fontFamily || fontFamily;
    if (lineEl) {
      lineEl.style.top = cy + "px";
      lineEl.style.setProperty("--mw", Math.round(Math.min(W - 48, Math.max(R * 1.12, 300), 640)) + "px");
    }

    // кольца: каждое — свой небольшой холст, нарисованный один раз
    ringsEl.innerHTML = "";
    const rd = Math.min(dpr, 1.25);
    rings = RING_TEXT.map((text, i) => {
      const r = R * (1 - i * 0.075);              // первая строка — внешнее кольцо, дальше внутрь
      const circ = 2 * Math.PI * r;
      const once = text + "   ·   ";
      // строка повторяется по кругу, как эхо; размер шрифта подгоняем, чтобы повторы легли ровно
      ctx.font = `100px ${fontFamily}`;
      const w100 = ctx.measureText(once).width;
      const want = Math.min(r * 0.075, 17);
      const copies = Math.max(1, Math.round(circ / (w100 * want / 100)));
      let font = (circ * 0.995) / (copies * w100) * 100;
      font = Math.max(11, Math.min(font, 20));
      const S = Math.ceil(2 * (r + font * 1.5));
      const cv = document.createElement("canvas");
      cv.className = "mama-ring";
      cv.width = Math.round(S * rd); cv.height = Math.round(S * rd);
      cv.style.width = S + "px"; cv.style.height = S + "px";
      cv.style.left = (cx - S / 2) + "px"; cv.style.top = (cy - S / 2) + "px";
      const speed = (0.018 + i * 0.003);                  // рад/с
      cv.style.animationDuration = (2 * Math.PI / speed).toFixed(0) + "s";
      if (i % 2) cv.style.animationDirection = "reverse";
      const c = cv.getContext("2d");
      c.font = `${font}px ${fontFamily}`;
      c.textBaseline = "middle";
      c.fillStyle = "#fff";
      const full = once.repeat(copies);
      const total = c.measureText(full).width;
      const spread = circ / total;
      let acc = 0;
      for (const ch of full) {
        const w = c.measureText(ch).width;
        const ang = -Math.PI / 2 + ((acc + w / 2) * spread) / r;
        acc += w;
        if (ch === " ") continue;
        const x = S / 2 + Math.cos(ang) * r, y = S / 2 + Math.sin(ang) * r;
        const cs = Math.cos(ang + Math.PI / 2), sn = Math.sin(ang + Math.PI / 2);
        c.setTransform(cs * rd, sn * rd, -sn * rd, cs * rd, x * rd, y * rd);
        c.fillText(ch, -w / 2, 0);
      }
      ringsEl.appendChild(cv);
      return { el: cv };
    });
    showRings();
    makeEnvelopeSprite();
  }

  /* ---------- текущая строка: стоит, пока её читают; меняется только затуханием ---------- */
  let shownIdx = -1, wantIdx = -1, swapTimer = 0;
  function setLine(idx) {
    if (!lineEl || idx === wantIdx) return;
    const forward = idx > wantIdx && wantIdx >= 0;
    wantIdx = idx;
    showRings();
    clearTimeout(swapTimer);
    // строку отпустили — сверху падает неотправленное письмо и сгорает
    if (forward && !reduce && sprite) spawnEnvelope(performance.now());
    if (shownIdx >= 0) lineEl.classList.remove("is-on");
    swapTimer = setTimeout(() => {
      shownIdx = wantIdx;
      if (shownIdx < 0) { lineEl.textContent = ""; return; }
      lineEl.textContent = LINES[shownIdx];
      lineEl.classList.toggle("is-last", shownIdx === LINES.length - 1);
      requestAnimationFrame(() => lineEl.classList.add("is-on"));
    }, shownIdx >= 0 && !reduce ? 750 : 0);
  }

  /* ---------- конверт ---------- */
  let sprite = null, envW = 120, envH = 78;
  function makeEnvelopeSprite() {
    envW = Math.max(84, Math.min(R * 0.36, 150));
    envH = envW * 0.64;
    sprite = document.createElement("canvas");
    sprite.width = Math.round(envW * dpr);
    sprite.height = Math.round(envH * dpr);
    const c = sprite.getContext("2d");
    c.scale(dpr, dpr);
    const g = c.createLinearGradient(0, 0, envW, envH);
    g.addColorStop(0, "#fbfaf8"); g.addColorStop(1, "#e9e8e4");
    c.fillStyle = g;
    c.fillRect(0, 0, envW, envH);
    // клапан
    c.strokeStyle = "rgba(0,0,0,.22)";
    c.lineWidth = 1;
    c.beginPath(); c.moveTo(0, 0); c.lineTo(envW / 2, envH * 0.55); c.lineTo(envW, 0); c.stroke();
    c.strokeStyle = "rgba(0,0,0,.1)";
    c.beginPath(); c.moveTo(0, envH); c.lineTo(envW * 0.42, envH * 0.48); c.moveTo(envW, envH); c.lineTo(envW * 0.58, envH * 0.48); c.stroke();
    // марка
    const sw = envW * 0.16, sh = sw * 1.2, sx = envW - sw - envW * 0.06, sy = envH * 0.08;
    c.fillStyle = "#c50000";
    c.fillRect(sx, sy, sw, sh);
    c.fillStyle = "#fbfaf8";
    for (let k = 0; k < 6; k++) {
      c.beginPath(); c.arc(sx + (k + 0.5) * sw / 6, sy, 1.1, 0, Math.PI * 2); c.fill();
      c.beginPath(); c.arc(sx + (k + 0.5) * sw / 6, sy + sh, 1.1, 0, Math.PI * 2); c.fill();
    }
    // адрес от руки
    c.fillStyle = "#1c2030";
    c.font = `700 ${envW * 0.17}px "Caveat", "Segoe Print", cursive`;
    c.textAlign = "center";
    c.fillText("маме", envW * 0.5, envH * 0.84);
    c.strokeStyle = "rgba(28,32,48,.5)";
    c.beginPath(); c.moveTo(envW * 0.3, envH * 0.9); c.lineTo(envW * 0.7, envH * 0.89); c.stroke();
  }

  const envs = [];
  const sparks = [];

  function spawnEnvelope(now) {
    const work = document.createElement("canvas");
    work.width = sprite.width; work.height = sprite.height;
    const corner = (Math.random() * 4) | 0;
    // падает сбоку от строки, чтобы не закрывать её
    const side = Math.random() < 0.5 ? -1 : 1;
    const half = (lineEl ? lineEl.offsetWidth : R) / 2;
    let x = cx + side * (half + envW * 0.7 + Math.random() * envW * 0.6);
    x = Math.max(envW * 0.6, Math.min(W - envW * 0.6, x));
    envs.push({
      x,
      y: -envH,
      vy: (H / 3.2) * (0.85 + Math.random() * 0.3),
      sway: Math.random() * 6.28,
      rot: (Math.random() - 0.5) * 0.6,
      vr: (Math.random() - 0.5) * 0.5,
      burnAt: H * (0.22 + Math.random() * 0.2),
      b: 0,
      // откуда начинает гореть: с одного из углов
      ox: corner % 2 ? envW : 0, oy: corner > 1 ? envH : 0,
      p1: Math.random() * 6.28, p2: Math.random() * 6.28, p3: Math.random() * 6.28,
      work, wctx: work.getContext("2d"),
    });
  }

  // контур прогоревшей дыры (в координатах конверта)
  function burnPath(c, e, scale) {
    const maxR = Math.hypot(envW, envH) * 1.15;
    const r0 = e.b * maxR * scale;
    c.beginPath();
    for (let i = 0; i <= 48; i++) {
      const t = (i / 48) * Math.PI * 2;
      const rr = r0 * (1 + 0.22 * Math.sin(3 * t + e.p1) + 0.12 * Math.sin(7 * t + e.p2) + 0.06 * Math.sin(13 * t + e.p3));
      const x = e.ox + Math.cos(t) * rr, y = e.oy + Math.sin(t) * rr;
      i ? c.lineTo(x, y) : c.moveTo(x, y);
    }
    c.closePath();
  }

  function drawEnvelope(e) {
    const c = e.wctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.globalCompositeOperation = "source-over";
    c.clearRect(0, 0, e.work.width, e.work.height);
    c.drawImage(sprite, 0, 0);
    if (e.b > 0) {
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      // обугленная полоса вокруг дыры
      c.globalCompositeOperation = "source-atop";
      burnPath(c, e, 1.28);
      c.fillStyle = "rgba(25, 12, 4, .85)";
      c.fill();
      burnPath(c, e, 1.12);
      c.fillStyle = "rgba(8, 4, 2, .95)";
      c.fill();
      // сама дыра
      c.globalCompositeOperation = "destination-out";
      burnPath(c, e, 1);
      c.fill();
    }
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.translate(e.x, e.y);
    ctx.rotate(e.rot);
    ctx.translate(-envW / 2, -envH / 2);
    ctx.drawImage(e.work, 0, 0, envW, envH);
    if (e.b > 0 && e.b < 1) {
      // огненная кромка — только по бумаге
      ctx.beginPath(); ctx.rect(0, 0, envW, envH); ctx.clip();
      ctx.globalCompositeOperation = "lighter";
      burnPath(ctx, e, 1.04);
      ctx.lineWidth = 9;
      ctx.strokeStyle = "rgba(255, 80, 0, .28)";
      ctx.stroke();
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(255, 150, 50, .95)";
      ctx.stroke();
      ctx.lineWidth = 1.2;
      ctx.strokeStyle = "rgba(255, 235, 180, .9)";
      ctx.stroke();
    }
    ctx.restore();
  }

  function emitSparks(e, dt) {
    const n = Math.round((reduce ? 0 : 60) * dt);
    const maxR = Math.hypot(envW, envH) * 1.15 * e.b * 1.04;
    const cos = Math.cos(e.rot), sin = Math.sin(e.rot);
    for (let i = 0; i < n; i++) {
      const t = Math.random() * Math.PI * 2;
      const lx = e.ox + Math.cos(t) * maxR, ly = e.oy + Math.sin(t) * maxR;
      if (lx < 0 || ly < 0 || lx > envW || ly > envH) continue;   // только с края, который на бумаге
      const px = lx - envW / 2, py = ly - envH / 2;
      const ash = Math.random() < 0.3;
      sparks.push({
        x: e.x + px * cos - py * sin, y: e.y + px * sin + py * cos,
        vx: (Math.random() - 0.5) * 30, vy: ash ? 20 + Math.random() * 30 : -30 - Math.random() * 60,
        life: 0, max: ash ? 1.6 + Math.random() : 0.6 + Math.random() * 0.8, ash,
        s: ash ? 1.5 + Math.random() * 2.5 : 1 + Math.random() * 1.6,
      });
    }
  }

  /* ---------- кадр ---------- */
  let last = performance.now(), dirty = false;
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!visible) return;
    const t = now / 1000;

    // письма
    for (let i = envs.length - 1; i >= 0; i--) {
      const e = envs[i];
      const slow = e.b > 0 ? 0.55 : 1;
      e.y += e.vy * dt * slow;
      e.x += Math.sin(t * 1.3 + e.sway) * 22 * dt;
      e.rot += (e.vr + Math.sin(t * 0.9 + e.sway) * 0.25) * dt;
      if (e.b === 0 && e.y > e.burnAt) e.b = 0.001;
      if (e.b > 0) { e.b = Math.min(1, e.b + dt / 1.9); emitSparks(e, dt); }
      if (e.b >= 1 || e.y > H + envH) envs.splice(i, 1);
    }

    // холст чистим, только если на нём что-то есть или было
    if (!envs.length && !sparks.length) {
      if (dirty) { ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, canvas.width, canvas.height); dirty = false; }
      return;
    }
    dirty = true;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // письма поверх текста
    envs.forEach(drawEnvelope);

    // искры и пепел
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.globalCompositeOperation = "lighter";
    for (let i = sparks.length - 1; i >= 0; i--) {
      const s = sparks[i];
      s.life += dt;
      if (s.life > s.max) { sparks.splice(i, 1); continue; }
      s.x += (s.vx + Math.sin(t * 3 + i) * 10) * dt;
      s.y += s.vy * dt;
      const k = 1 - s.life / s.max;
      if (s.ash) continue;
      ctx.fillStyle = `rgba(255, ${Math.round(120 + 100 * k)}, 40, ${k})`;
      ctx.beginPath(); ctx.arc(s.x, s.y, s.s * (0.5 + k * 0.5), 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalCompositeOperation = "source-over";
    sparks.forEach((s) => {
      if (!s.ash) return;
      const k = 1 - s.life / s.max;
      ctx.fillStyle = `rgba(40, 36, 34, ${k * 0.9})`;
      ctx.fillRect(s.x, s.y, s.s, s.s * 0.6);
    });
  }

  let geo = null, scrollTick = false;
  function onScroll() {
    if (scrollTick) return;
    scrollTick = true;
    requestAnimationFrame(() => { scrollTick = false; measure(); });
  }
  function measure() {
    if (!geo) geo = { top: parseFloat(getComputedStyle(scene).top) || 0, h: scene.offsetHeight };
    const r = sec.getBoundingClientRect();
    const vh = window.innerHeight;
    const was = visible;
    visible = r.bottom > 0 && r.top < vh;
    if (visible !== was) ringsEl.classList.toggle("is-paused", !visible);
    const hh = geo.top;
    q = clamp01((hh - r.top) / Math.max(1, r.height - geo.h));
    // глава делится поровну между строками письма; пока глава не видна — строки нет
    const near = r.top < vh * 0.6 && r.bottom > vh * 0.4;
    setLine(near ? Math.min(LINES.length - 1, Math.floor(q * LINES.length * 0.999)) : -1);
  }

  const ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  ready.then(() => {
    layout();
    measure();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", () => { geo = null; layout(); measure(); });
    requestAnimationFrame(frame);
  });
})();
