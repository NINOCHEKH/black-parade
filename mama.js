/* =========================================================
   Глава IV «Мама...»: письмо по кольцам и горящие конверты
   • строки письма сложены в концентрические кольца и медленно вращаются
   • кольца проявляются по мере скролла (снаружи внутрь)
   • сверху падают неотправленные письма, загораются и сгорают на лету
   • падая, они расталкивают буквы в стороны; потом буквы возвращаются на место
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
  const CENTER_TEXT = (letter.querySelector("[data-center]") || {}).textContent || "";

  let W = 0, H = 0, dpr = 1, cx = 0, cy = 0, R = 0;
  let rings = [];          // { r, font, chars: [{ ch, a (угол), w, ox, oy }], speed, phase }
  let centerLines = [], centerFont = 16;
  let fontFamily = '"Broadsheet", "Old Standard TT", serif';
  let q = 0, visible = false;

  /* ---------- раскладка колец ---------- */
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
    R = Math.min(W * 0.46, (H - top) * 0.45);
    fontFamily = getComputedStyle(document.body).fontFamily || fontFamily;

    rings = RING_TEXT.map((text, i) => {
      const r = R * (1 - i * 0.125);
      const circ = 2 * Math.PI * r;
      const once = text + "   ·   ";
      // короткая строка повторяется по кругу, как эхо; размер шрифта подгоняем, чтобы повторы легли ровно
      ctx.font = `100px ${fontFamily}`;
      const w100 = ctx.measureText(once).width;
      const want = Math.min(r * 0.17, 30);
      const copies = Math.max(1, Math.round(circ / (w100 * want / 100)));
      let font = (circ * 0.995) / (copies * w100) * 100;
      font = Math.max(12, Math.min(font, 34));
      ctx.font = `${font}px ${fontFamily}`;
      const full = once.repeat(copies);
      const total = ctx.measureText(full).width;
      const spread = circ / total;               // почти 1: буквы стоят с обычным интервалом
      const chars = [];
      let acc = 0;
      for (const ch of full) {
        const w = ctx.measureText(ch).width;
        chars.push({ ch, a: ((acc + w / 2) * spread) / r, w, ox: 0, oy: 0, heat: 0 });
        acc += w;
      }
      return { r, font, chars, speed: (i % 2 ? -1 : 1) * (0.028 + i * 0.004), phase: -Math.PI / 2 };
    });

    // середина: короткая фраза в две строки
    centerFont = Math.max(14, Math.min(R * 0.085, 24));
    ctx.font = `italic ${centerFont}px ${fontFamily}`;
    const words = CENTER_TEXT.split(" ");
    const maxW = R * 0.5;
    centerLines = [];
    let line = "";
    words.forEach((wd) => {
      const t = line ? line + " " + wd : wd;
      if (ctx.measureText(t).width > maxW && line) { centerLines.push(line); line = wd; } else line = t;
    });
    if (line) centerLines.push(line);
    makeEnvelopeSprite();
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
  let nextEnvAt = 0;

  function spawnEnvelope(now) {
    const work = document.createElement("canvas");
    work.width = sprite.width; work.height = sprite.height;
    const corner = (Math.random() * 4) | 0;
    envs.push({
      x: W * (0.18 + Math.random() * 0.64),
      y: -envH,
      vy: (H / 6) * (0.75 + Math.random() * 0.5),
      sway: Math.random() * 6.28,
      rot: (Math.random() - 0.5) * 0.6,
      vr: (Math.random() - 0.5) * 0.5,
      burnAt: H * (0.28 + Math.random() * 0.34),
      b: 0,
      // откуда начинает гореть: с одного из углов
      ox: corner % 2 ? envW : 0, oy: corner > 1 ? envH : 0,
      p1: Math.random() * 6.28, p2: Math.random() * 6.28, p3: Math.random() * 6.28,
      work, wctx: work.getContext("2d"),
    });
    nextEnvAt = now + 1300 + Math.random() * 1300;
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
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(255, 150, 50, .95)";
      ctx.shadowColor = "rgba(255, 80, 0, 1)";
      ctx.shadowBlur = 14;
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
  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (!visible || !rings.length) return;
    const t = now / 1000;

    // письма
    if (!reduce && now > nextEnvAt && envs.length < 6) spawnEnvelope(now);
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

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // кольца
    rings.forEach((ring, i) => {
      const a = reduce ? (q > 0.06 + i * 0.1 ? 1 : 0) : smooth(0.05 + i * 0.1, 0.12 + i * 0.1, q);
      if (a <= 0.001) return;
      const rot = ring.phase + (reduce ? 0 : t * ring.speed);
      ctx.font = `${ring.font}px ${fontFamily}`;
      ctx.textBaseline = "middle";
      for (const c of ring.chars) {
        const ang = rot + c.a;
        const bx = cx + Math.cos(ang) * ring.r, by = cy + Math.sin(ang) * ring.r;
        // письма расталкивают буквы в стороны
        let tx = 0, ty = 0, heat = 0;
        for (const e of envs) {
          const infl = envW * 0.95 * (1 - e.b * 0.7);
          const dx = bx - e.x, dy = by - e.y;
          const d = Math.hypot(dx, dy) || 1;
          if (d < infl * 1.7) {
            const f = Math.pow(1 - d / (infl * 1.7), 2) * infl * 0.95;
            tx += Math.sign(dx) * f * 0.85 + (dx / d) * f * 0.25;
            ty += (dy / d) * f * 0.25;
            if (e.b > 0) heat = Math.max(heat, (1 - d / (infl * 1.7)) * (1 - e.b * 0.5));
          }
        }
        const k = Math.min(1, dt * 7);
        c.ox += (tx - c.ox) * k;
        c.oy += (ty - c.oy) * k;
        c.heat += (heat - c.heat) * Math.min(1, dt * 5);
        const x = bx + c.ox, y = by + c.oy;
        const r = 255, g = Math.round(255 - 110 * c.heat), b = Math.round(255 - 200 * c.heat);
        ctx.fillStyle = `rgba(${r},${g},${b},${a})`;
        const cs = Math.cos(ang + Math.PI / 2), sn = Math.sin(ang + Math.PI / 2);
        ctx.setTransform(cs * dpr, sn * dpr, -sn * dpr, cs * dpr, x * dpr, y * dpr);
        ctx.fillText(c.ch, -c.w / 2, 0);
      }
    });

    // середина
    const ca = reduce ? (q > 0.7 ? 1 : 0) : smooth(0.66, 0.74, q);
    if (ca > 0.001) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = `italic ${centerFont}px ${fontFamily}`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = `rgba(255,255,255,${ca})`;
      centerLines.forEach((ln, i) => ctx.fillText(ln, cx, cy + (i - (centerLines.length - 1) / 2) * centerFont * 1.3));
      ctx.textAlign = "start";
    }

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

  function onScroll() {
    const r = sec.getBoundingClientRect();
    const vh = window.innerHeight;
    visible = r.bottom > 0 && r.top < vh;
    const hh = parseFloat(getComputedStyle(scene).top) || 0;
    q = clamp01((hh - r.top) / Math.max(1, r.height - scene.offsetHeight));
  }

  const ready = document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve();
  ready.then(() => {
    layout();
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", () => { layout(); onScroll(); });
    requestAnimationFrame(frame);
  });
})();
