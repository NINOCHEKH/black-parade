/* =========================================================
   Главы лонгрида: печать текста, проявление, шествие, песни, меню
   (работает вместе с script.js — берёт оттуда SONGS, selectSong, engine)
   ========================================================= */
(function () {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- Печать текста, как в начале ---------- */
  const SPEED = 22, JITTER = 14;
  const PAUSE = { ".": 220, "?": 220, "!": 220, "…": 220, ",": 110, "—": 100, ":": 120, ";": 120 };

  function splitChars(el) {
    const chars = [];
    const walk = (node) => {
      Array.from(node.childNodes).forEach((n) => {
        if (n.nodeType === Node.TEXT_NODE) {
          const frag = document.createDocumentFragment();
          for (const ch of n.textContent) {
            const s = document.createElement("span");
            s.className = "ch";
            s.textContent = ch;
            frag.appendChild(s);
            chars.push(s);
          }
          n.replaceWith(frag);
        } else if (n.nodeType === Node.ELEMENT_NODE) {
          walk(n);
        }
      });
    };
    el.setAttribute("aria-label", el.textContent);
    walk(el);
    return chars;
  }

  const caret = document.createElement("span");
  caret.className = "caret";
  caret.setAttribute("aria-hidden", "true");

  function typeEl(el) {
    const chars = el._chars || (el._chars = splitChars(el));
    return new Promise((resolve) => {
      if (reduce || !chars.length) {
        chars.forEach((c) => c.classList.add("is-on"));
        resolve();
        return;
      }
      let i = 0;
      (function next() {
        if (i >= chars.length) { resolve(); return; }
        const c = chars[i++];
        c.classList.add("is-on");
        c.after(caret);
        setTimeout(next, SPEED + Math.random() * JITTER + (PAUSE[c.textContent] || 0));
      })();
    });
  }

  // Группа печатается по строкам; в монологе прошлые строки затухают
  async function typeGroup(group) {
    if (group._typed) return;
    group._typed = true;
    const lines = Array.from(group.querySelectorAll("[data-type]"));
    const fade = group.classList.contains("monologue");
    for (let i = 0; i < lines.length; i++) {
      if (fade) {
        const p = lines[i].closest("p");
        group.querySelectorAll("p").forEach((q) => { if (q !== p && q._done) q.classList.add("is-past"); });
      }
      await typeEl(lines[i]);
      const p = lines[i].closest("p");
      if (p) p._done = true;
      await new Promise((r) => setTimeout(r, reduce ? 0 : 160));
    }
    // в конце монолога все строки снова ярче, кроме самых первых
    if (fade) group.querySelectorAll("p").forEach((q, i, all) => q.classList.toggle("is-past", i < all.length - 2));
    if (group.dataset.after) group.classList.add("is-done");   // зачёркивание / штамп
    if (caret.parentNode) setTimeout(() => caret.remove(), 1600);
  }

  // заранее разбиваем на буквы, чтобы текст занимал место и не прыгал
  document.querySelectorAll("[data-type-group] [data-type]").forEach((el) => { el._chars = splitChars(el); });

  const typeObserver = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { typeGroup(e.target); typeObserver.unobserve(e.target); }
    });
  }, { threshold: 0.35 });
  document.querySelectorAll(".chapters [data-type-group]").forEach((g) => typeObserver.observe(g));

  /* ---------- Плавное проявление ---------- */
  const revealObserver = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add("is-visible"); revealObserver.unobserve(e.target); }
    });
  }, { threshold: 0.2 });
  document.querySelectorAll("[data-reveal], .flatline").forEach((el) => revealObserver.observe(el));

  /* ---------- Глава I: личное дело в темноте ---------- */
  const deadSec = document.getElementById("dead");
  const scene = document.getElementById("deadScene");
  const stage = document.getElementById("stage3d");
  const folder = document.getElementById("folder");
  const disc = document.getElementById("disc");
  const remains = document.getElementById("remains");
  const dissolveFunc = document.getElementById("dissolveFunc");
  const clamp01 = (x) => Math.max(0, Math.min(1, x));
  const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
  const easeIO = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const lerp = (a, b, t) => a + (b - a) * t;

  // фазы скролла внутри главы (0…1, пока сцена закреплена)
  const PH = { dissolveFrom: 0.36, dissolveTo: 0.58, textAt: 0.55, redFrom: 0.78, redTo: 0.98 };

  let deadQ = 0, dis = 0, sceneVisible = false;
  let mode = "idle";                       // idle → opening → open → closing → idle
  const st = { ry: -20, rx: -6, ty: 0, open: 0, lift: 0, light: 0 };
  let animStart = 0, from = null, ryTarget = 0;
  const T_OPEN = 2.9;                      // длительность раскрытия, с
  let lastFrame = performance.now();
  const t0 = performance.now();

  function sceneGeometry() {
    const r = deadSec.getBoundingClientRect();
    const vh = window.innerHeight;
    const hh = parseFloat(getComputedStyle(scene).top) || 0;
    return { r, vh, hh, travel: Math.max(1, r.height - scene.offsetHeight) };
  }

  function updateDead() {
    if (!deadSec || !scene) return;
    const { r, vh, hh, travel } = sceneGeometry();
    sceneVisible = r.bottom > 0 && r.top < vh;
    if (!sceneVisible) return;
    const appear = clamp01((vh - r.top) / Math.max(1, vh - hh));
    scene.style.setProperty("--appear", (reduce ? 1 : 1 - Math.pow(1 - appear, 3)).toFixed(3));
    deadQ = clamp01((hh - r.top) / travel);
    remains.classList.toggle("is-shown", deadQ > PH.textAt);
    scene.style.setProperty("--red", smooth(PH.redFrom, PH.redTo, deadQ).toFixed(3));   // плавно наплывает красный
  }

  /* --- открыть / закрыть папку --- */
  function openFolder() {
    if (mode !== "idle" || dis > 0.05) return;
    mode = "opening";
    animStart = performance.now();
    from = { ...st };
    ryTarget = Math.round(st.ry / 360) * 360;              // повернуться лицом кратчайшим путём
    folder.setAttribute("aria-label", "Личное дело пациента № 7 — закрыть");
  }
  function closeFolder() {
    if (mode !== "open") return;
    mode = "closing";
    animStart = performance.now();
    folder.classList.remove("is-open");
    folder.setAttribute("aria-label", "Личное дело пациента № 7 — открыть");
  }
  function toggleFolder() { if (mode === "idle") openFolder(); else if (mode === "open") closeFolder(); }

  if (folder) {
    folder.addEventListener("click", (e) => {
      if (e.target.closest(".doc, .disc")) return;
      toggleFolder();
    });
    folder.addEventListener("keydown", (e) => {
      if ((e.key === "Enter" || e.key === " ") && e.target === folder) { e.preventDefault(); toggleFolder(); }
    });
  }

  // общая «раскадровка»: k — секунды от начала раскрытия (при закрытии идём назад)
  function pose(k) {
    const fh = folder.offsetHeight;
    const pA = easeIO(clamp01(k / 0.9));                  // повернуться лицом
    const pB = easeIO(clamp01((k - 0.6) / 1.0));          // лечь на стол
    const pC = easeIO(clamp01((k - 1.5) / 1.0));          // раскрыться
    const pD = easeIO(clamp01((k - 2.3) / 0.6));          // диск приподнимается
    st.ry = lerp(from.ry, ryTarget, pA);
    st.rx = lerp(lerp(from.rx, 0, pA), 54, pB);
    st.ty = lerp(from.ty, fh * 0.1, pB);
    st.open = pC;
    st.lift = pD * fh * 0.04;
    st.light = clamp01((k - 0.5) / 1.4);
  }

  function stepFolder(now, dt) {
    const t = (now - t0) / 1000;
    const el = (now - animStart) / 1000;
    if (mode === "idle") {
      if (!reduce) st.ry += 14 * dt;                       // медленно вращается
      st.rx = -6 + (reduce ? 0 : 3 * Math.sin(t * 0.5));
      st.ty = reduce ? 0 : 6 * Math.sin(t * 0.8);
      st.light = Math.max(0, st.light - dt * 1.5);
    } else if (mode === "opening") {
      pose(reduce ? T_OPEN : el);
      if (el >= T_OPEN || reduce) { mode = "open"; folder.classList.add("is-open"); }
    } else if (mode === "open") {
      pose(T_OPEN);
    } else if (mode === "closing") {
      // назад по той же раскадровке, чуть быстрее; поворот не повторяем
      from = { ry: ryTarget, rx: -6 + 3 * Math.sin(t * 0.5), ty: 0 };
      const k = reduce ? 0 : T_OPEN - el * 1.25;
      pose(Math.max(0, k));
      if (k <= 0) { mode = "idle"; st.ry = ryTarget; }
    }

    const lightOn = st.light * (1 - dis);
    const c = Math.cos(st.ry * Math.PI / 180);
    const amb = 1 - 0.65 * lightOn;
    scene.style.setProperty("--ry", st.ry.toFixed(2) + "deg");
    scene.style.setProperty("--rx", st.rx.toFixed(2) + "deg");
    scene.style.setProperty("--ty", st.ty.toFixed(1) + "px");
    scene.style.setProperty("--open", st.open.toFixed(4));
    scene.style.setProperty("--lift", st.lift.toFixed(1) + "px");
    scene.style.setProperty("--light", lightOn.toFixed(3));
    scene.style.setProperty("--dimF", ((0.12 + 0.55 * (1 - Math.max(0, c))) * amb).toFixed(3));
    scene.style.setProperty("--dimB", ((0.12 + 0.55 * (1 - Math.max(0, -c))) * amb).toFixed(3));
    scene.style.setProperty("--dimIn", (0.25 * amb).toFixed(3));

    // свет покачивается, как лампочка на шнуре, и иногда мигает
    const fw = folder.offsetWidth / 2;
    lightX = reduce ? 0 : fw * 0.07 * Math.sin(t * 1.25) + fw * 0.015 * Math.sin(t * 2.9);
    lightI = reduce ? 1 : flickerLevel(now);
    scene.style.setProperty("--lx", lightX.toFixed(1) + "px");
    scene.style.setProperty("--li", lightI.toFixed(3));
  }

  let lightX = 0, lightI = 1, nextFlicker = performance.now() + 5000, flickerEnd = 0, flickerStep = 0, flickerVal = 1;
  function flickerLevel(now) {
    if (st.light < 0.95) return 1;
    if (now > nextFlicker && now > flickerEnd) {
      flickerEnd = now + 250 + Math.random() * 450;
      nextFlicker = flickerEnd + 4000 + Math.random() * 6000;
    }
    if (now < flickerEnd) {
      if (now > flickerStep) { flickerVal = Math.random() < 0.55 ? 0.25 + Math.random() * 0.35 : 1; flickerStep = now + 40 + Math.random() * 70; }
      return flickerVal;
    }
    return 1;
  }

  // диск включает Dead!
  if (disc) disc.addEventListener("click", (e) => {
    e.stopPropagation();
    if (mode !== "open") return;
    const i = SONGS.findIndex((s) => s.title === "Dead!");
    if (i === current && !engine.paused) engine.pause();
    else selectSong(i, { autoplay: true });
  });

  /* --- документы: достать, прочитать, вложить обратно --- */
  const viewer = document.getElementById("docViewer");
  const card = document.getElementById("docCard");
  const closeBtn = viewer && viewer.querySelector(".doc-viewer__close");
  let openDocBtn = null, docAnim = null;

  // кадры подъёма: лист лежит в папке под наклоном стола → приподнимается → встаёт прямо перед тобой
  function liftFrames(fromR, toR, btn) {
    const dx = (fromR.left + fromR.width / 2) - (toR.left + toR.width / 2);
    const dy = (fromR.top + fromR.height / 2) - (toR.top + toR.height / 2);
    const sc = Math.max(0.12, fromR.width / toR.width);
    const tilt = st.rx;
    const rz = btn.classList.contains("doc--record") ? -5 : btn.classList.contains("doc--xray") ? 5 : -1;
    return [
      { transform: `perspective(1400px) translate(${dx}px, ${dy}px) rotateX(${tilt}deg) rotateZ(${rz}deg) scale(${sc})`, opacity: 0.7 },
      { transform: `perspective(1400px) translate(${dx * 0.45}px, ${dy * 0.45 - 60}px) rotateX(${tilt * 0.45}deg) rotateZ(${rz * 0.5}deg) scale(${(sc + 1) * 0.45})`, opacity: 1, offset: 0.45 },
      { transform: "perspective(1400px) translate(0, 0) rotateX(0deg) rotateZ(0deg) scale(1)", opacity: 1 },
    ];
  }

  function openDoc(btn) {
    if (openDocBtn || mode !== "open") return;
    const tpl = document.getElementById("doc-" + btn.dataset.doc);
    const fromR = btn.querySelector(".doc__paper").getBoundingClientRect();
    card.innerHTML = "";
    card.appendChild(tpl.content.cloneNode(true));
    viewer.hidden = false;
    card.scrollTop = 0;
    const toR = card.getBoundingClientRect();
    btn.classList.add("is-out");
    openDocBtn = btn;
    requestAnimationFrame(() => viewer.classList.add("is-open"));
    closeBtn.focus({ preventScroll: true });
    if (reduce) return;
    docAnim = card.animate(liftFrames(fromR, toR, btn), { duration: 820, easing: "cubic-bezier(.25,.8,.25,1)" });
    docAnim.onfinish = docAnim.oncancel = () => { docAnim = null; };
  }

  function closeDoc() {
    if (!openDocBtn || viewer.classList.contains("is-closing")) return;
    if (docAnim) docAnim.cancel();
    const btn = openDocBtn;
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      viewer.hidden = true;
      viewer.classList.remove("is-closing");
      card.getAnimations().forEach((a) => a.cancel());
      card.innerHTML = "";
      btn.classList.remove("is-out");
      openDocBtn = null;
      btn.focus({ preventScroll: true });
    };
    viewer.classList.remove("is-open");
    viewer.classList.add("is-closing");
    if (reduce) { finish(); return; }
    const a = card.getBoundingClientRect();
    const b = btn.querySelector(".doc__paper").getBoundingClientRect();
    const anim = card.animate(liftFrames(b, a, btn).reverse(), { duration: 620, easing: "cubic-bezier(.5,0,.3,1)", fill: "forwards" });
    anim.onfinish = anim.oncancel = finish;
    setTimeout(finish, 900);   // подстраховка
  }

  document.querySelectorAll(".doc").forEach((btn) => btn.addEventListener("click", (e) => {
    e.stopPropagation();
    openDoc(btn);
  }));

  if (viewer) {
    viewer.querySelectorAll("[data-close]").forEach((el) => el.addEventListener("click", closeDoc));
    document.addEventListener("keydown", (e) => {
      if (!openDocBtn) return;
      if (e.key === "Escape") { e.preventDefault(); closeDoc(); }
      else if (e.key === "Tab") { e.preventDefault(); closeBtn.focus(); }
      else if (["ArrowDown", "ArrowUp", "PageDown", "PageUp", "Home", "End"].includes(e.key)) e.preventDefault();
    }, true);
    // пока документ открыт, страница не листается; длинный документ листается сам
    const blockScroll = (e) => {
      if (!openDocBtn) return;
      const scrollable = card.scrollHeight > card.clientHeight + 1;
      if (!(scrollable && card.contains(e.target))) e.preventDefault();
    };
    window.addEventListener("wheel", blockScroll, { passive: false, capture: true });
    window.addEventListener("touchmove", blockScroll, { passive: false, capture: true });
  }

  /* --- рассыпание: шум съедает папку, кусочки улетают и тают --- */
  const dc = document.getElementById("dust");
  const dctx = dc && dc.getContext("2d");
  let motes = [], shards = [], dprD = 1, lastDis = 0;
  const SHARD_COLORS = ["#b9b2a3", "#b9b2a3", "#a59e8f", "#ebe8e1", "#efece4", "#141414", "#2a2a2b", "#c50000"];

  function setDissolve(v) {
    dis = v;
    scene.style.setProperty("--dis", v.toFixed(3));
    stage.classList.toggle("is-dissolving", v > 0.001);
    // порог по шуму: 0 — всё на месте, 1 — ничего не осталось
    const T = lerp(0.18, 0.86, v);
    const slope = 14;
    dissolveFunc.setAttribute("slope", slope);
    dissolveFunc.setAttribute("intercept", (0.5 - slope * T + (v <= 0.001 ? 50 : 0)).toFixed(3));
    stage.style.opacity = v >= 0.999 ? "0" : "";
  }

  function emitShards(amount) {
    const fr = folder.getBoundingClientRect();
    const cr = dc.getBoundingClientRect();
    const n = Math.min(260, Math.round(amount));
    for (let i = 0; i < n; i++) {
      shards.push({
        x: (fr.left - cr.left + Math.random() * fr.width) * dprD,
        y: (fr.top - cr.top + Math.random() * fr.height) * dprD,
        vx: (20 + Math.random() * 70) * dprD,
        vy: (-30 - Math.random() * 60) * dprD,
        s: (1 + Math.random() * 3.2) * dprD,
        rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 6,
        life: 0, max: 1.4 + Math.random() * 1.8,
        c: SHARD_COLORS[(Math.random() * SHARD_COLORS.length) | 0],
      });
    }
  }

  function updateDissolve() {
    const v = reduce ? (deadQ > PH.dissolveTo ? 1 : 0) : smooth(PH.dissolveFrom, PH.dissolveTo, deadQ);
    if (Math.abs(v - dis) < 0.0005) return;
    if (v > lastDis && dc) emitShards((v - lastDis) * 2600);   // осколки — только когда рассыпается, не при сборке
    lastDis = v;
    setDissolve(v);
  }

  /* --- пыль в луче лампы --- */
  function sizeDust() {
    if (!dc) return;
    dprD = Math.min(window.devicePixelRatio || 1, 2);
    dc.width = Math.round(dc.clientWidth * dprD);
    dc.height = Math.round(dc.clientHeight * dprD);
  }
  function newMote(anyAge) {
    const max = 5 + Math.random() * 7;
    return {
      x: Math.random(), y: Math.random(),
      r: 0.5 + Math.pow(Math.random(), 2.2) * 2.4,
      vx: (Math.random() - 0.5) * 0.006, vy: 0.002 + Math.random() * 0.008,
      sway: Math.random() * 6.28, life: anyAge ? Math.random() * max : 0, max,
    };
  }
  if (dc) for (let i = 0; i < 110; i++) motes.push(newMote(true));

  function drawDust(dt, t) {
    if (!dc) return;
    if (dc.width !== Math.round(dc.clientWidth * dprD)) sizeDust();
    const W = dc.width, H = dc.height;
    dctx.clearRect(0, 0, W, H);
    const lightOn = st.light * (1 - dis);
    const cx = 0.5 + lightX / (W / dprD), cy = 0.56;
    motes.forEach((m, i) => {
      m.life += dt;
      if (m.life > m.max) { motes[i] = newMote(false); return; }
      m.x += (m.vx + Math.sin(t * 0.4 + m.sway) * 0.0025) * dt;
      m.y += m.vy * dt * (Math.sin(t * 0.3 + m.sway) > 0.7 ? -1 : 1);
      if (m.y > 1.05) m.y = -0.05;
      const fade = Math.sin(Math.PI * (m.life / m.max));
      const circle = clamp01(1 - Math.hypot((m.x - cx) / 0.3, (m.y - cy) / 0.38));
      const column = clamp01(1 - Math.abs(m.x - cx) / 0.16) * clamp01(m.y / cy) * 0.55;
      const a = fade * (0.05 + 0.08 * lightOn + 0.8 * lightOn * lightI * Math.max(circle, column)) * (1 - 0.5 * dis);
      if (a < 0.01) return;
      const x = m.x * W, y = m.y * H, rr = m.r * dprD * 2.6;
      const gr = dctx.createRadialGradient(x, y, 0, x, y, rr);
      gr.addColorStop(0, `rgba(255,238,214,${a})`);
      gr.addColorStop(0.35, `rgba(255,230,200,${a * 0.6})`);
      gr.addColorStop(1, "rgba(255,230,200,0)");
      dctx.fillStyle = gr;
      dctx.beginPath(); dctx.arc(x, y, rr, 0, Math.PI * 2); dctx.fill();
    });

    // осколки папки: летят вверх-вправо, кружатся, становятся пылью и исчезают
    for (let i = shards.length - 1; i >= 0; i--) {
      const p = shards[i];
      p.life += dt;
      if (p.life > p.max) { shards.splice(i, 1); continue; }
      const k = p.life / p.max;
      p.vx += Math.sin(t * 2 + p.rot) * 12 * dprD * dt;
      p.vy -= 10 * dprD * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      const size = p.s * (1 - k * 0.8);
      dctx.globalAlpha = (1 - k) * (k < 0.08 ? k / 0.08 : 1);
      dctx.fillStyle = p.c;
      dctx.save();
      dctx.translate(p.x, p.y); dctx.rotate(p.rot);
      dctx.fillRect(-size / 2, -size / 2, size, size * 0.7);
      dctx.restore();
    }
    dctx.globalAlpha = 1;
  }

  function deadLoop(now) {
    requestAnimationFrame(deadLoop);
    const dt = Math.min(0.05, (now - lastFrame) / 1000);
    lastFrame = now;
    if (!sceneVisible && !shards.length) return;
    stepFolder(now, dt);
    updateDissolve();
    drawDust(dt, (now - t0) / 1000);
  }

  if (scene) {
    sizeDust();
    setDissolve(0);
    window.addEventListener("resize", sizeDust);
    requestAnimationFrame(deadLoop);
  }

  /* ---------- Глава II: марш по телевизору ---------- */
  const tv = document.getElementById("tv");
  const track = document.getElementById("tvTrack");

  function marcherSVG(kind) {
    // фигура 60×200: перо, кивер, череп, мундир, ноги; в руках — барабан, труба или знамя
    const instrument = {
      drum: `<ellipse cx="30" cy="132" rx="17" ry="5" fill="#e9e3d6"/><rect x="13" y="132" width="34" height="20" fill="#050505"/><path d="M13 136 L47 148 M13 148 L47 136" stroke="#e9e3d6" stroke-width="1.2"/><ellipse cx="30" cy="152" rx="17" ry="5" fill="#050505" stroke="#e9e3d6" stroke-width="1"/><path d="M12 112 L22 128 M48 112 L38 128" stroke="#e9e3d6" stroke-width="2" stroke-linecap="round"/>`,
      horn: `<path d="M34 110 L56 96" stroke="#e9e3d6" stroke-width="3" stroke-linecap="round"/><path d="M53 90 L60 101 L52 100 Z" fill="#e9e3d6"/>`,
      flag: `<path d="M48 40 L48 175" stroke="#050505" stroke-width="2.5"/><path d="M48 42 L76 50 L48 62 Z" fill="#050505"/><circle cx="48" cy="38" r="2.5" fill="#e9e3d6"/>`,
    }[kind];
    return `<svg class="marcher" viewBox="0 0 60 200" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <g class="leg-a"><rect x="21" y="148" width="8" height="50" fill="#050505"/><rect x="19" y="194" width="12" height="5" fill="#050505"/></g>
      <g class="leg-b"><rect x="31" y="148" width="8" height="50" fill="#050505"/><rect x="29" y="194" width="12" height="5" fill="#050505"/></g>
      <g class="body">
        <ellipse cx="30" cy="16" rx="12" ry="16" fill="#efebe2"/>
        <ellipse cx="22" cy="24" rx="8" ry="11" fill="#e2ddd2"/>
        <ellipse cx="38" cy="22" rx="8" ry="12" fill="#e2ddd2"/>
        <path d="M17 38 L43 38 L41 72 L19 72 Z" fill="#050505"/>
        <rect x="18" y="62" width="24" height="3" fill="#bdb6a8"/>
        <circle cx="30" cy="50" r="4" fill="#bdb6a8"/>
        <path d="M15 72 L45 72 L43 76 L17 76 Z" fill="#050505"/>
        <ellipse cx="30" cy="87" rx="10" ry="12" fill="#e9e3d6"/>
        <ellipse cx="26" cy="85" rx="3" ry="3.4" fill="#050505"/>
        <ellipse cx="34" cy="85" rx="3" ry="3.4" fill="#050505"/>
        <path d="M30 89 L28 93 L32 93 Z" fill="#050505"/>
        <path d="M24 96 H36" stroke="#050505" stroke-width="1.4" stroke-dasharray="1.5 1"/>
        <path d="M17 100 Q30 96 43 100 L45 150 L15 150 Z" fill="#050505"/>
        <path d="M18 101 L42 148 M42 101 L18 148" stroke="#e9e3d6" stroke-width="1.6" opacity=".85"/>
        <rect x="8" y="102" width="8" height="38" rx="3" fill="#050505"/>
        <rect x="44" y="102" width="8" height="38" rx="3" fill="#050505"/>
        ${instrument}
      </g>
    </svg>`;
  }

  if (track) {
    // два одинаковых ряда подряд — лента бесконечно едет по экрану
    const kinds = ["flag", "drum", "horn", "drum", "horn", "drum", "horn", "drum"];
    let row = "";
    for (let i = 0; i < kinds.length; i++) row += marcherSVG(kinds[i]);
    track.innerHTML = row + row;
    track.querySelectorAll(".marcher").forEach((m, i) => {
      m.querySelectorAll(".leg-a, .leg-b, .body").forEach((g) => { g.style.animationDelay = (-(i % 3) * 0.06) + "s"; });
    });
  }

  /* ---------- Сцена «Парада»: карточки рассыпаются, красный тускнеет, телевизор гаснет ---------- */
  const paradeSec = document.getElementById("parade");
  const pScene = document.getElementById("paradeScene");
  const tvStage = pScene && pScene.querySelector(".tv-stage");
  const pCards = pScene ? Array.from(pScene.querySelectorAll(".pcard-wrap")) : [];
  const pFilters = document.getElementById("pcardFilters");
  const pCanvas = document.getElementById("paradeShards");
  const pctx2 = pCanvas && pCanvas.getContext("2d");
  let pShards = [], pDpr = 1, tvState = "off";
  const CARD_COLORS = ["#f1f0ec", "#f1f0ec", "#e2e1dc", "#ffffff", "#141313", "#c50000"];

  // у каждой записки свой износ: рваные края, сгиб, пятна, скотч (случайно, но одинаково при каждом заходе)
  function seeded(seed) {
    return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  function tornClip(rnd) {
    const pts = [];
    const tear = (rnd() * 4) | 0;                     // одна сторона порвана сильнее
    const edge = (side, n, f) => {
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const big = side === tear ? 1 : 0.35;
        const j = (rnd() * 1.6 + (rnd() < 0.18 ? rnd() * 3.5 : 0)) * big;
        pts.push(f(t * 100, j));
      }
    };
    edge(0, 22, (t, j) => [t, j]);                     // верх
    edge(1, 26, (t, j) => [100 - j, t]);               // право
    edge(2, 22, (t, j) => [100 - t, 100 - j]);         // низ
    edge(3, 26, (t, j) => [j, 100 - t]);               // лево
    // оторванный уголок
    const c = (rnd() * 4) | 0, k = 6 + rnd() * 8;
    const cut = [[0, 0], [100, 0], [100, 100], [0, 100]][c];
    const out = pts.filter(([x, y]) => Math.abs(x - cut[0]) + Math.abs(y - cut[1]) > k);
    return "polygon(" + out.map(([x, y]) => `${x.toFixed(1)}% ${y.toFixed(1)}%`).join(",") + ")";
  }
  pCards.forEach((wrap, i) => {
    const rnd = seeded(97 + i * 131);
    const paper = wrap.querySelector(".pcard");
    paper.style.setProperty("--clip", tornClip(rnd));
    paper.style.setProperty("--fold", (95 + rnd() * 40).toFixed(0) + "deg");
    paper.style.setProperty("--rz", ((rnd() - 0.5) * 5).toFixed(1) + "deg");
    ["s1", "s2", "s3"].forEach((k) => {
      paper.style.setProperty(`--${k}x`, (10 + rnd() * 80).toFixed(0) + "%");
      paper.style.setProperty(`--${k}y`, (10 + rnd() * 80).toFixed(0) + "%");
    });
    paper.style.setProperty("--tape", rnd() < 0.6 ? "1" : "0");
    paper.style.setProperty("--tape-x", (20 + rnd() * 45).toFixed(0) + "%");
    paper.style.setProperty("--tape-r", ((rnd() - 0.5) * 12).toFixed(1) + "deg");
  });

  // свой фильтр «рассыпания» у каждой карточки
  const svgNS = "http://www.w3.org/2000/svg";
  pCards.forEach((wrap, i) => {
    const f = document.createElementNS(svgNS, "filter");
    f.setAttribute("id", "pcd" + i);
    f.setAttribute("x", "-10%"); f.setAttribute("y", "-10%"); f.setAttribute("width", "120%"); f.setAttribute("height", "120%");
    f.setAttribute("color-interpolation-filters", "sRGB");
    f.innerHTML = `<feTurbulence type="fractalNoise" baseFrequency="0.05" numOctaves="2" seed="${20 + i * 7}" result="n"/>
      <feColorMatrix in="n" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  1 0 0 0 0" result="na"/>
      <feComponentTransfer in="na" result="m"><feFuncA type="linear" slope="14" intercept="8"/></feComponentTransfer>
      <feComposite in="SourceGraphic" in2="m" operator="in"/>`;
    pFilters.appendChild(f);
    wrap._func = f.querySelector("feFuncA");
    wrap._dis = 0;
  });

  // окно каждой карточки на шкале скролла: появилась → держится → рассыпалась.
  // На широком экране слева и справа видно по карточке, на узком — строго по одной
  const narrowMQ = window.matchMedia("(max-width: 900px)");
  function setCardTimings() {
    pCards.forEach((wrap, i) => {
      if (narrowMQ.matches) {
        const start = 0.04 + i * 0.128;
        wrap._t = { in0: start, in1: start + 0.03, out0: start + 0.09, out1: start + 0.122 };
      } else {
        const start = 0.04 + i * 0.112;
        wrap._t = { in0: start, in1: start + 0.035, out0: start + 0.15, out1: start + 0.205 };
      }
    });
  }
  setCardTimings();
  narrowMQ.addEventListener("change", () => { setCardTimings(); updateParadeScene(); });

  function sizePShards() {
    if (!pCanvas) return;
    pDpr = Math.min(window.devicePixelRatio || 1, 2);
    pCanvas.width = Math.round(pCanvas.clientWidth * pDpr);
    pCanvas.height = Math.round(pCanvas.clientHeight * pDpr);
  }

  function setTv(on) {
    if (!tv || (on ? "on" : "off") === tvState) return;
    tvState = on ? "on" : "off";
    tvStage.classList.toggle("is-off", !on);
    if (on) {
      tv.classList.remove("is-off", "is-on");
      void tv.offsetWidth;            // перезапуск анимации включения
      tv.classList.add("is-on");
    } else {
      tv.classList.remove("is-on");
      tv.classList.add("is-off");
    }
  }

  let pVisible = false;
  function updateParadeScene() {
    if (!paradeSec || !pScene) return;
    const r = paradeSec.getBoundingClientRect();
    const vh = window.innerHeight;
    pVisible = r.bottom > 0 && r.top < vh;
    if (!pVisible) return;
    const hh = parseFloat(getComputedStyle(pScene).top) || 0;
    const q = clamp01((hh - r.top) / Math.max(1, r.height - pScene.offsetHeight));
    pScene.style.setProperty("--dim", smooth(0.04, 0.96, q).toFixed(3));   // красный тускнеет
    setTv(q < 0.95);                                                        // текст закончился — телевизор гаснет

    pCards.forEach((wrap) => {
      const t = wrap._t;
      const a = reduce ? (q >= t.in0 && q < t.out0 ? 1 : 0) : smooth(t.in0, t.in1, q);
      const d = reduce ? (q >= t.out0 ? 1 : 0) : smooth(t.out0, t.out1, q);
      const active = a > 0.001 && d < 0.999;
      wrap.classList.toggle("is-active", active);
      wrap.style.setProperty("--a", a.toFixed(3));
      if (d > wrap._dis && pCanvas && active) emitCardShards(wrap, (d - wrap._dis) * 900);
      wrap._dis = d;
      if (d > 0.001) {
        wrap.style.filter = `url(#pcd${wrap.dataset.card})`;
        const T = lerp(0.18, 0.86, d);
        wrap._func.setAttribute("intercept", (0.5 - 14 * T).toFixed(3));
      } else {
        wrap.style.filter = "";
      }
    });
  }

  function emitCardShards(wrap, amount) {
    const fr = wrap.getBoundingClientRect();
    const cr = pCanvas.getBoundingClientRect();
    const dir = wrap.classList.contains("pcard-wrap--l") ? -1 : 1;   // разлетаются наружу, от телевизора
    const n = Math.min(160, Math.round(amount));
    for (let i = 0; i < n; i++) {
      pShards.push({
        x: (fr.left - cr.left + Math.random() * fr.width) * pDpr,
        y: (fr.top - cr.top + Math.random() * fr.height) * pDpr,
        vx: dir * (20 + Math.random() * 60) * pDpr, vy: (-25 - Math.random() * 55) * pDpr,
        s: (1 + Math.random() * 3) * pDpr, rot: Math.random() * 6.28, vr: (Math.random() - 0.5) * 6,
        life: 0, max: 1.3 + Math.random() * 1.6, c: CARD_COLORS[(Math.random() * CARD_COLORS.length) | 0],
      });
    }
  }

  function drawPShards(dt, t) {
    if (!pctx2) return;
    if (pCanvas.width !== Math.round(pCanvas.clientWidth * pDpr)) sizePShards();
    pctx2.clearRect(0, 0, pCanvas.width, pCanvas.height);
    for (let i = pShards.length - 1; i >= 0; i--) {
      const p = pShards[i];
      p.life += dt;
      if (p.life > p.max) { pShards.splice(i, 1); continue; }
      const k = p.life / p.max;
      p.vx += Math.sin(t * 2 + p.rot) * 10 * pDpr * dt;
      p.vy -= 8 * pDpr * dt;
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
      const size = p.s * (1 - k * 0.8);
      pctx2.globalAlpha = (1 - k) * (k < 0.08 ? k / 0.08 : 1);
      pctx2.fillStyle = p.c;
      pctx2.save(); pctx2.translate(p.x, p.y); pctx2.rotate(p.rot);
      pctx2.fillRect(-size / 2, -size / 2, size, size * 0.7);
      pctx2.restore();
    }
    pctx2.globalAlpha = 1;
  }

  /* ---------- Отсчёт 10 → 0: шум, вспышки признаний, белый ---------- */
  const countSec = document.getElementById("countdown");
  const cScene = document.getElementById("countScene");
  const cNum = document.getElementById("countNum");
  const cNoise = document.getElementById("countNoise");
  const cFlashes = document.getElementById("countFlashes");
  const cLine = document.getElementById("countLine");
  const nctx = cNoise && cNoise.getContext("2d");
  // что он говорит на каждой цифре — всё тяжелее
  const COUNT_LINES = {
    10: "Говорят, перед концом вся жизнь проносится перед глазами.",
    9: "Моя не проносится. Она тянется, как очередь в коридоре поликлиники.",
    8: "И в этой очереди почти нет дней, за которые мне не стыдно.",
    7: "Я молчал, когда нужно было говорить, и говорил, когда лучше было промолчать.",
    6: "Люди уставали от меня. Я замечал это — и делал вид, что не замечаю.",
    5: "Я сам отталкивал тех, кто был рядом, а потом жаловался, что остался один.",
    4: "Я не был хорошим человеком.",
    3: "Хуже того — я был никаким. Таких не ненавидят. Таких просто не помнят.",
    2: "Меня забудут быстрее, чем из этой палаты выветрится запах хлорки.",
    1: "Наверное, это честно.",
  };
  // признания вспыхивают вокруг — ступенями, от тихих к невыносимым
  const CONFESSIONS = [
    ["я не перезвонил", "я сказал «потом»", "я опять опоздал", "я забыл её день рождения"],
    ["я врал тем, кто меня любил", "я хлопал дверью", "я делал вид, что мне всё равно", "я ни разу не сказал спасибо"],
    ["я не был хорошим сыном", "я делал больно нарочно", "меня не за что вспомнить", "я никого не удержал"],
    ["поздно", "никто не придёт", "прости", "уже ничего не исправить"],
  ];
  // сколько секунд держится каждая цифра: в начале медленно, к концу всё быстрее
  const COUNT_STEP = { 10: 2.9, 9: 2.9, 8: 2.6, 7: 3.0, 6: 2.6, 5: 2.5, 4: 2.2, 3: 2.0, 2: 2.3, 1: 1.7, 0: 0.9 };
  let cVisible = false, cNoiseLevel = 0, cWhite = false, nextFlashAt = 0, noiseImg = null;
  let cState = "wait";            // wait → run → done
  let cNum0 = 10, cStepEnd = 0, cProgress = 0, cLockY = 0, cLastY = window.scrollY;
  const COUNT_TOTAL = Object.values(COUNT_STEP).reduce((x, y) => x + y, 0);
  let cElapsedBefore = 0;

  function sizeNoise() {
    if (!cNoise) return;
    cNoise.width = 240; cNoise.height = 135;     // мелкая картинка, растянутая на экран, — как помехи в эфире
    noiseImg = nctx.createImageData(cNoise.width, cNoise.height);
    if (cNoiseOver) { cNoiseOver.width = 240; cNoiseOver.height = 135; }
  }

  function setLine(text) {
    if (cLine.textContent === text) return;
    cLine.classList.add("is-swap");
    setTimeout(() => { cLine.textContent = text; cLine.classList.remove("is-swap"); }, 300);
  }

  /* --- перекидные цифры --- */
  const flipTens = document.getElementById("flipTens");
  const flipOnes = document.getElementById("flipOnes");
  const clockStage = document.getElementById("clockStage");
  const cNoiseOver = document.getElementById("countNoiseOver");
  const noctx = cNoiseOver && cNoiseOver.getContext("2d");
  let clockArrive = 0, clockArriving = false, clockArriveStart = 0;

  function buildFlip(el, d) {
    el.innerHTML = ["flip__half flip__half--top", "flip__half flip__half--bot", "flip__flap flip__flap--top", "flip__flap flip__flap--bot"]
      .map((c) => `<div class="${c}"><span>${d}</span></div>`).join("");
    el._d = d;
    el._s = Array.from(el.querySelectorAll("span"));   // верх, низ, створка-верх, створка-низ
  }
  function setFlip(el, d, animate) {
    if (!el || el._d === d) return;
    const prev = el._d;
    const [ht, hb, ft, fb] = el._s;
    el._d = d;
    clearTimeout(el._timer);
    if (!animate || reduce) {
      [ht, hb, ft, fb].forEach((x) => (x.textContent = d));
      el.classList.remove("is-flipping");
      return;
    }
    // верх уже новый, низ ещё старый; верхняя створка падает со старой цифрой, нижняя — опускается с новой
    ht.textContent = d; hb.textContent = prev; ft.textContent = prev; fb.textContent = d;
    el.classList.remove("is-flipping"); void el.offsetWidth; el.classList.add("is-flipping");
    el._timer = setTimeout(() => {
      hb.textContent = d; ft.textContent = d;
      el.classList.remove("is-flipping");
    }, 640);
  }
  function setClock(n, animate) {
    const t = String(Math.floor(n / 10)), o = String(n % 10);
    setFlip(flipTens, t, animate);
    setFlip(flipOnes, o, animate);
  }
  if (flipTens) { buildFlip(flipTens, "1"); buildFlip(flipOnes, "0"); }

  function showNumber(n) {
    cNum.textContent = String(n);
    setClock(n, true);
    setLine(COUNT_LINES[n] || "");
  }

  function resetCountdown() {
    cState = "wait"; cNum0 = 10; cProgress = 0; cElapsedBefore = 0; cWhite = false;
    cScene.classList.remove("is-white", "is-done");
    cNum.textContent = "10"; cLine.textContent = ""; cFlashes.innerHTML = "";
    setClock(10, false);
    clockArriving = false; clockArrive = 0;
    clockStage.style.setProperty("--ca", "0");
    cNoiseLevel = 0; cScene.style.setProperty("--noise", "0");
  }

  function startCountdown() {
    cState = "run";
    cLockY = Math.round(window.scrollY + countSec.getBoundingClientRect().top - (parseFloat(getComputedStyle(cScene).top) || 0));
    window.scrollTo(0, cLockY);
    cNum0 = 10; cElapsedBefore = 0;
    setClock(10, false);
    // часы выплывают из темноты; первая цифра держится, пока они не подъедут
    clockArriving = true; clockArriveStart = performance.now();
    cStepEnd = performance.now() + (COUNT_STEP[10] + 1.6) * 1000;
    cNum.textContent = "10";
    setTimeout(() => { if (cState === "run") setLine(COUNT_LINES[10]); }, 1400);
  }

  function finishCountdown() {
    cState = "done";
    cWhite = true;
    cNoiseLevel = 0;
    cNum.textContent = "0";
    setClock(0, false);
    clockArriving = false; clockArrive = 1;
    clockStage.style.setProperty("--ca", "1");
    cScene.classList.add("is-white", "is-done");
    cScene.style.setProperty("--noise", "0");
    cFlashes.innerHTML = "";
  }
  window.finishCountdown = () => { if (cState !== "done") finishCountdown(); };

  // таймер идёт сам, по времени, а не по скроллу
  function tickCountdown(now) {
    if (cState !== "run") return;
    if (now >= cStepEnd) {
      cElapsedBefore += COUNT_STEP[cNum0];
      if (cNum0 === 0) { finishCountdown(); return; }
      cNum0 -= 1;
      cStepEnd = now + COUNT_STEP[cNum0] * 1000;
      showNumber(cNum0);
    }
    const inStep = Math.max(0, COUNT_STEP[cNum0] - Math.max(0, (cStepEnd - now) / 1000));
    cProgress = clamp01((cElapsedBefore + inStep) / COUNT_TOTAL);
    cNoiseLevel = Math.pow(cProgress, 1.4);
    cScene.style.setProperty("--noise", cNoiseLevel.toFixed(3));
  }

  // пока идёт отсчёт, страница стоит; прокрутка вверх отпускает и сбрасывает отсчёт
  function updateCountdown() {
    if (!countSec || !cScene) return;
    const r = countSec.getBoundingClientRect();
    const vh = window.innerHeight;
    const y = window.scrollY;
    cVisible = r.bottom > 0 && r.top < vh;
    const hh = parseFloat(getComputedStyle(cScene).top) || 0;
    if (cState === "wait" && y > cLastY && r.top <= hh + 1 && r.top > hh - vh * 0.6) startCountdown();
    else if (cState === "run" && y > cLockY + 1) window.scrollTo(0, cLockY);
    else if (cState === "run" && y < cLockY - 2) resetCountdown();
    cLastY = window.scrollY;
  }

  const countBlocks = (e) => {
    if (cState !== "run") return false;
    return true;
  };
  window.addEventListener("wheel", (e) => {
    if (!countBlocks()) return;
    if (e.deltaY < 0) { resetCountdown(); return; }
    e.preventDefault();
  }, { passive: false });
  let cTouchY = null;
  window.addEventListener("touchstart", (e) => { cTouchY = e.touches[0].clientY; }, { passive: true });
  window.addEventListener("touchmove", (e) => {
    if (!countBlocks() || cTouchY === null) return;
    if (e.touches[0].clientY - cTouchY > 12) { resetCountdown(); return; }
    e.preventDefault();
  }, { passive: false });
  window.addEventListener("keydown", (e) => {
    if (!countBlocks()) return;
    if (["ArrowDown", "PageDown", "End", "Space"].includes(e.code)) e.preventDefault();
    if (["ArrowUp", "PageUp", "Home"].includes(e.code)) resetCountdown();
  });

  function spawnFlash() {
    const tier = CONFESSIONS[Math.min(3, Math.floor(cProgress * 4))];
    const el = document.createElement("span");
    el.className = "flash" + (Math.random() < 0.2 + 0.4 * cProgress ? " flash--red" : "");
    el.textContent = tier[(Math.random() * tier.length) | 0];
    // вокруг цифры, не поверх неё и не поверх строки внизу
    let x, y;
    do { x = Math.random(); y = Math.random() * 0.8; } while (Math.abs(x - 0.45) < 0.3 && Math.abs(y - 0.42) < 0.3);
    el.style.left = (x * 82 + 2) + "%";
    el.style.top = (y * 86 + 4) + "%";
    const want = 13 + Math.random() * (14 + 26 * cNoiseLevel);
    const fit = (cFlashes.clientWidth * 0.9) / (el.textContent.length * 0.52);
    el.style.fontSize = Math.min(want, fit).toFixed(1) + "px";
    el.style.setProperty("--life", (0.7 + Math.random() * 0.9).toFixed(2) + "s");
    el.addEventListener("animationend", () => el.remove());
    cFlashes.appendChild(el);
    const maxLeft = cFlashes.clientWidth - el.offsetWidth - 8;
    if (el.offsetLeft > maxLeft) el.style.left = Math.max(8, maxLeft) + "px";
  }

  function drawCountdown(now) {
    tickCountdown(now);
    if (clockArriving) {
      clockArrive = reduce ? 1 : clamp01((now - clockArriveStart) / 3400);
      const e = 1 - Math.pow(1 - clockArrive, 3);
      clockStage.style.setProperty("--ca", e.toFixed(4));
      if (clockArrive >= 1) clockArriving = false;
    }
    if (!cVisible || cWhite || cState !== "run") return;
    if (nctx && cNoiseLevel > 0.01) {
      const d = noiseImg.data;
      for (let i = 0; i < d.length; i += 4) {
        const v = (Math.random() * 255) | 0;
        d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255;
      }
      nctx.putImageData(noiseImg, 0, 0);
      if (noctx) noctx.drawImage(cNoise, 0, 0);          // те же помехи поверх часов, только слабее
    }
    // ближе к нулю часы дёргаются
    const g = reduce ? 0 : Math.max(0, cNoiseLevel - 0.35) * 1.6;
    clockStage.style.setProperty("--shx", ((Math.random() - 0.5) * g * 16).toFixed(1));
    clockStage.style.setProperty("--shy", ((Math.random() - 0.5) * g * 8).toFixed(1));
    if (!reduce && now > nextFlashAt && cNoiseLevel > 0.03) {
      spawnFlash();
      nextFlashAt = now + (1200 - 1120 * cNoiseLevel) * (0.5 + Math.random());
    }
  }

  let lastP = performance.now();
  function sceneLoop(now) {
    requestAnimationFrame(sceneLoop);
    const dt = Math.min(0.05, (now - lastP) / 1000);
    lastP = now;
    if (pVisible || pShards.length) drawPShards(dt, now / 1000);
    drawCountdown(now);
  }
  sizePShards(); sizeNoise();
  window.addEventListener("resize", sizePShards);
  requestAnimationFrame(sceneLoop);

  /* ---------- Глава III: текст слева и справа, переписка, телефон садится ---------- */
  const loveSec = document.getElementById("i-dont-love-you");
  const loveScene = document.getElementById("loveScene");
  const phone = document.getElementById("phone");
  const phoneWrap = document.getElementById("phoneWrap");
  const smsList = document.getElementById("smsList");
  const smsDraft = document.getElementById("smsDraft");
  const smsClock = document.getElementById("smsClock");
  const smsBattery = document.getElementById("smsBattery");
  const loveColL = document.getElementById("loveColL");
  const loveColR = document.getElementById("loveColR");
  const phoneKeys = phone ? Array.from(phone.querySelectorAll(".key")) : [];

  // шкала главы (0…1): 0–0.08 телефон уходит вправо и растёт; 0.03–0.47 текст слева;
  // 0.46–0.56 телефон переезжает влево; 0.52–0.9 текст справа; 0.86 батарея мигает; 0.93 телефон гаснет
  const SMS = [
    { at: 0.06, who: "her", meta: "Она · 21:40", text: "ты спишь?" },
    { at: 0.12, who: "her", meta: "Она · 21:41", text: "я приду во вторник. принесу апельсины" },
    { at: 0.18, who: "her", meta: "Она · 21:44", text: "врач сказал, тебе лучше. это правда?" },
    { at: 0.42, who: "her", meta: "Она · 22:30", text: "?" },
    { at: 0.47, who: "her", meta: "Она · 23:05", text: "ты тут?" },
    { at: 0.72, who: "me",  meta: "Я · 23:52 · доставлено", text: "не приходи больше. я тебя не люблю" },
    { at: 0.79, who: "her", meta: "Она · 23:58", text: "это неправда" },
    { at: 0.85, who: "her", meta: "Она · 00:03", text: "я всё равно приду во вторник" },
  ];
  const DRAFTS = [
    { from: 0.22, to: 0.27, hold: 0.29, erase: 0.31, text: "да, всё хорошо" },
    { from: 0.33, to: 0.36, hold: 0.38, erase: 0.40, text: "мне страшно" },
    { from: 0.56, to: 0.69, hold: 0.72, erase: 0.72, text: "не приходи больше. я тебя не люблю", send: true },
  ];
  let smsShown = -1, lastDraft = "";

  function draftAt(q) {
    for (const d of DRAFTS) {
      if (q < d.from) return "";
      if (q < d.to) return d.text.slice(0, Math.round(d.text.length * (q - d.from) / (d.to - d.from)));
      if (q < d.hold) return d.text;
      if (!d.send && q < d.erase) return d.text.slice(0, Math.round(d.text.length * (1 - (q - d.hold) / (d.erase - d.hold))));
    }
    return "";   // отправлено
  }

  function pressKey() {
    if (!phoneKeys.length || reduce) return;
    const k = phoneKeys[(Math.random() * phoneKeys.length) | 0];
    k.classList.add("is-down");
    setTimeout(() => k.classList.remove("is-down"), 90);
  }

  // колонка «проезжает» снизу вверх; end — где остановится последняя строка (доля высоты окна)
  function scrollCol(col, p, endAt) {
    const inner = col.firstElementChild;
    const view = col.clientHeight;
    const start = view * 0.95;
    const end = endAt === undefined ? -inner.offsetHeight : view * endAt - inner.offsetHeight;
    inner.style.setProperty("--y", lerp(start, end, p).toFixed(1) + "px");
  }

  function updateLove() {
    if (!loveSec || !loveScene) return;
    const r = loveSec.getBoundingClientRect();
    const vh = window.innerHeight;
    if (r.bottom < 0 || r.top > vh) return;
    const hh = parseFloat(getComputedStyle(loveScene).top) || 0;
    const q = clamp01((hh - r.top) / Math.max(1, r.height - loveScene.offsetHeight));
    const narrow = narrowMQ.matches;

    // переписка: перестраиваем, только когда меняется число сообщений (скролл назад тоже работает)
    let n = -1;
    SMS.forEach((m, i) => { if (q >= m.at) n = i; });
    if (n !== smsShown) {
      const grew = n > smsShown;
      smsList.innerHTML = "";
      SMS.slice(0, n + 1).forEach((m, i) => {
        const el = document.createElement("div");
        el.className = "sms sms--" + m.who;
        if (!(grew && i === n)) el.style.animation = "none";
        el.innerHTML = `<span class="sms__meta"></span>`;
        el.firstChild.textContent = m.meta;
        el.appendChild(document.createTextNode(m.text));
        smsList.appendChild(el);
      });
      smsShown = n;
      smsClock.textContent = n >= 0 ? SMS[n].meta.split(" · ")[1] : "21:40";
      if (grew && phone && !reduce) phone.animate(
        [{ translate: "0 0" }, { translate: "-3px 0" }, { translate: "3px 0" }, { translate: "-2px 0" }, { translate: "0 0" }],
        { duration: 300 }
      );   // вибрация
    }

    const d = draftAt(q);
    if (d !== lastDraft) { smsDraft.textContent = d; pressKey(); lastDraft = d; }

    // текст: слева, потом справа
    const pL = reduce ? (q < 0.47 ? 0.5 : 1) : clamp01((q - 0.03) / 0.44);
    const pR = reduce ? (q > 0.52 ? 1 : 0) : clamp01((q - 0.52) / 0.38);
    scrollCol(loveColL, pL);
    scrollCol(loveColR, pR, 0.55);   // последняя фраза остаётся на экране
    loveColL.style.visibility = q < 0.5 ? "visible" : "hidden";
    loveColR.style.visibility = q > 0.5 ? "visible" : "hidden";

    // телефон: растёт и уходит вправо, потом переезжает влево
    if (phoneWrap) {
      const side = Math.min(window.innerWidth * 0.23, 330);
      const toRight = smooth(0, 0.08, q), toLeft = smooth(0.46, 0.56, q);
      const x = narrow ? 0 : side * (toRight - 2 * toLeft);
      const sc = narrow ? 1 : 1 + 0.14 * toRight;
      phoneWrap.style.setProperty("--px", x.toFixed(1) + "px");
      phoneWrap.style.setProperty("--ps", sc.toFixed(3));
      // поворачивается к тексту
      const turn = narrow ? 0 : (toRight - 2 * toLeft);
      phone.style.setProperty("--pry", (-8 * turn + 4 * Math.sin(q * 6)).toFixed(1) + "deg");
      phone.style.setProperty("--prx", (8 - 3 * q).toFixed(1) + "deg");
    }

    // батарея садится вместе с ним; экран тускнеет; в конце — гаснет
    const bat = clamp01(1 - q * 1.08);
    smsBattery.style.setProperty("--bat", bat.toFixed(3));
    phone.style.setProperty("--glow", clamp01(1 - smooth(0.6, 0.92, q) * 0.85).toFixed(3));
    phone.classList.toggle("is-low", q > 0.84 && q < 0.93);
    phone.classList.toggle("is-off", q >= 0.93);
  }

  /* ---------- Кнопки песен ---------- */
  const chips = Array.from(document.querySelectorAll(".track-chip"));
  const songIndex = (title) => SONGS.findIndex((s) => s.title === title);

  chips.forEach((chip) => {
    chip.addEventListener("click", () => {
      const i = songIndex(chip.dataset.song);
      if (i < 0) return;
      if (i === current && !engine.paused) engine.pause();
      else selectSong(i, { autoplay: true });
    });
  });

  function updateChips() {
    const playingTitle = engine.paused ? null : SONGS[current].title;
    if (disc) disc.classList.toggle("is-playing", playingTitle === "Dead!");
    chips.forEach((c) => {
      const on = c.dataset.song === playingTitle;
      c.classList.toggle("is-playing", on);
      c.setAttribute("aria-pressed", String(on));
    });
  }

  /* ---------- Меню: переход к главам и подсветка текущей ---------- */
  const navLinks = Array.from(document.querySelectorAll(".nav a"));
  navLinks.forEach((a) => {
    a.addEventListener("click", (e) => {
      const target = document.querySelector(a.getAttribute("href"));
      if (!target) return;
      e.preventDefault();
      if (window.revealStory) window.revealStory();   // вступление дальше не держит прокрутку
      const cd = document.getElementById("countdown");
      if (cd && window.finishCountdown && target.compareDocumentPosition(cd) & Node.DOCUMENT_POSITION_PRECEDING) window.finishCountdown();
      target.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      history.replaceState(null, "", a.getAttribute("href"));
    });
  });

  const chapterObserver = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      navLinks.forEach((a) => a.classList.toggle("is-current", a.getAttribute("href") === "#" + e.target.id));
    });
  }, { rootMargin: "-45% 0px -50% 0px" });
  document.querySelectorAll(".chapter").forEach((c) => chapterObserver.observe(c));

  // выше первой главы — ничего не подсвечено
  const firstChapter = document.querySelector(".chapter");
  function clearNavAboveChapters() {
    if (firstChapter && firstChapter.getBoundingClientRect().top > window.innerHeight * 0.5) {
      navLinks.forEach((a) => a.classList.remove("is-current"));
    }
  }

  /* ---------- Один общий цикл для скролла ---------- */
  let ticking = false;
  window.addEventListener("scroll", () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => { updateDead(); updateParadeScene(); updateCountdown(); updateLove(); clearNavAboveChapters(); ticking = false; });
  }, { passive: true });

  setInterval(updateChips, 250);
  window.addEventListener("resize", () => { updateDead(); updateParadeScene(); updateCountdown(); updateLove(); });
  updateDead();
  updateParadeScene();
  updateCountdown();
  updateLove();
})();
