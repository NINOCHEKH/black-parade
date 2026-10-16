/* =========================================================
   Глава V «Последнее слово» и финал
   • его последний текст разбит на фразы, они кружатся в глубине на разных орбитах
   • через какое-то время внизу появляется кнопка «ответь мне на вопрос»
   • вопрос на чёрном; кнопка «да» дважды уползает, на третий раз он благодарит
   • после этого весь лонгрид растворяется, остаются только источники
   ========================================================= */
(function () {
  const sec = document.getElementById("last-words");
  const scene = document.getElementById("lastScene");
  const vortex = document.getElementById("vortex");
  const source = document.getElementById("lastText");
  const askBtn = document.getElementById("askBtn");
  const question = document.getElementById("question");
  const yesBtn = document.getElementById("yesBtn");
  const noBtn = document.getElementById("noBtn");
  const thanks = document.getElementById("thanks");
  const readAgain = document.getElementById("readAgain");
  if (!sec || !scene || !vortex || !source) return;

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp01 = (x) => Math.max(0, Math.min(1, x));

  // одинаковый «хаос» при каждом заходе
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

  /* ---------- фразы на орбитах ---------- */
  const sentences = [];
  source.querySelectorAll("p").forEach((p) => {
    p.textContent.split(/(?<=[.?!…])\s+/).forEach((s) => { if (s.trim()) sentences.push(s.trim()); });
  });

  const items = sentences.map((text) => {
    const el = document.createElement("p");
    el.className = "vx";
    el.textContent = text;
    vortex.appendChild(el);
    return {
      el,
      r: 0.2 + rnd() * 0.32,                   // радиус орбиты (доля размера сцены)
      tilt: (rnd() - 0.5) * 1.8,               // наклон плоскости орбиты
      roll: (rnd() - 0.5) * 1.0,
      w: (rnd() < 0.5 ? -1 : 1) * (0.05 + rnd() * 0.11),   // скорость, в разные стороны
      th: rnd() * Math.PI * 2,
      ox: (rnd() - 0.5) * 0.25, oy: (rnd() - 0.5) * 0.18, oz: -0.05 - rnd() * 0.42,
      bob: rnd() * 6.28, bobS: 0.2 + rnd() * 0.3,
      spin: (rnd() - 0.5) * 8,
    };
  });

  // «глубинка»: обрывки тех же фраз далеко позади
  const deep = [];
  for (let i = 0; i < 12; i++) {
    const words = sentences[(rnd() * sentences.length) | 0].split(" ");
    const start = (rnd() * Math.max(1, words.length - 4)) | 0;
    const el = document.createElement("p");
    el.className = "vx vx--deep";
    el.textContent = words.slice(start, start + 3 + ((rnd() * 3) | 0)).join(" ");
    vortex.appendChild(el);
    deep.push({ el, x: (rnd() - 0.5) * 1.6, y: (rnd() - 0.5) * 1.1, z: -1400 - rnd() * 1600, vx: (rnd() - 0.5) * 0.02, ph: rnd() * 6.28 });
  }

  let W = 0, H = 0, U = 1, visible = false, seenTime = 0;
  function measure() {
    W = vortex.clientWidth; H = vortex.clientHeight;
    U = Math.max(Math.min(W, H * 1.5), Math.min(H, 700));   // на узком экране орбиты выходят за края — так просторнее
  }

  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    const realDt = (now - last) / 1000;
    const dt = Math.min(0.05, realDt);
    last = now;
    if (!visible) return;
    const t = now / 1000;

    items.forEach((it) => {
      const th = it.th + (reduce ? 0 : t * it.w);
      const r = it.r * U;
      // точка на окружности → наклон плоскости → поворот
      const x0 = Math.cos(th) * r, z0 = Math.sin(th) * r;
      const y1 = -z0 * Math.sin(it.tilt), z1 = z0 * Math.cos(it.tilt);
      const x = x0 * Math.cos(it.roll) - y1 * Math.sin(it.roll) + it.ox * U;
      const y = x0 * Math.sin(it.roll) + y1 * Math.cos(it.roll) + it.oy * H + Math.sin(t * it.bobS + it.bob) * 14;
      const z = (z1 + it.oz * U) * 0.8;
      // чем ближе к зрителю, тем ярче и резче; дальние почти тонут в темноте
      const zMin = -0.85 * U, zMax = 0.3 * U;
      const f = clamp01((z - zMin) / (zMax - zMin));
      const blur = Math.round(Math.pow(1 - f, 1.5) * 10) / 2;
      it.el.style.transform = `translate(-50%, -50%) translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, ${z.toFixed(1)}px) rotate(${(Math.sin(t * 0.3 + it.bob) * it.spin).toFixed(2)}deg)`;
      it.el.style.opacity = (0.07 + 0.93 * Math.pow(f, 1.7)).toFixed(3);
      it.el.style.filter = blur > 0 ? `blur(${blur}px)` : "none";
      it.el.style.zIndex = String(Math.round(f * 100));
    });

    deep.forEach((d) => {
      d.x += d.vx * dt;
      if (d.x > 1) d.x = -1; if (d.x < -1) d.x = 1;
      const y = d.y * H + Math.sin(t * 0.2 + d.ph) * 30;
      d.el.style.transform = `translate(-50%, -50%) translate3d(${(d.x * W).toFixed(1)}px, ${y.toFixed(1)}px, ${d.z}px)`;
      d.el.style.opacity = "0.22";
      d.el.style.filter = "blur(1.5px)";
    });

    // кнопка появляется, когда текст побыл на экране (считаем, только пока сцена видна хотя бы наполовину)
    if (vortexActive) seenTime += Math.min(0.5, realDt);   // настоящее время, даже если кадры редкие
    if (askBtn.hidden && seenTime > 3) {
      askBtn.hidden = false;
      requestAnimationFrame(() => askBtn.classList.add("is-shown"));
    }
  }

  let vortexActive = false;
  function onScroll() {
    const r = scene.getBoundingClientRect();
    const vh = window.innerHeight;
    const shown = Math.min(r.bottom, vh) - Math.max(r.top, 0);
    visible = shown > 0;
    vortexActive = shown >= r.height * 0.5;
  }

  /* ---------- вопрос ---------- */
  let yesCount = 0, yesMoving = false, yesX = 0, yesY = 0;
  const timers = [];
  const later = (ms, fn) => timers.push(setTimeout(fn, ms));

  function openQuestion() {
    question.hidden = false;
    document.documentElement.style.overflow = "hidden";
    requestAnimationFrame(() => question.classList.add("is-open"));
    later(reduce ? 0 : 900, () => question.classList.add("is-l1"));
    later(reduce ? 0 : 2600, () => question.classList.add("is-l2"));
    later(reduce ? 0 : 4300, () => { question.classList.add("is-ask"); yesBtn.focus({ preventScroll: true }); });
  }

  let answered = false;
  function closeQuestion() {
    if (answered) return;
    timers.forEach(clearTimeout); timers.length = 0;
    question.classList.remove("is-open", "is-l1", "is-l2", "is-ask");
    document.documentElement.style.overflow = "";
    setTimeout(() => { question.hidden = true; }, 600);
    askBtn.focus({ preventScroll: true });
  }

  // «да» уползает: ползёт рывками, как гусеница, в другое место экрана
  function crawlAway() {
    const r = yesBtn.getBoundingClientRect();
    const baseX = r.left - yesX, baseY = r.top - yesY;   // где кнопка стоит без сдвига
    let tx, ty, tries = 0;
    do {
      tx = 24 + Math.random() * (window.innerWidth - r.width - 48) - baseX;
      ty = 24 + Math.random() * (window.innerHeight - r.height - 48) - baseY;
      tries++;
    } while (Math.hypot(tx - yesX, ty - yesY) < Math.min(window.innerWidth, window.innerHeight) * 0.3 && tries < 30);
    const fx = yesX, fy = yesY;
    const frames = [];
    const steps = 6;
    for (let i = 0; i <= steps; i++) {
      const k = i / steps;
      const x = fx + (tx - fx) * k, y = fy + (ty - fy) * k;
      const squish = i % 2 ? 0.78 : 1.06;          // сжался — вытянулся
      frames.push({ transform: `translate(${x}px, ${y}px) rotate(${(i < steps ? Math.sin(i) * 4 : 0).toFixed(1)}deg) scaleX(${i < steps ? squish : 1})`, offset: k });
    }
    yesMoving = true;
    const anim = yesBtn.animate(frames, { duration: reduce ? 1 : 2200, easing: "ease-in-out", fill: "forwards" });
    anim.onfinish = () => {
      yesX = tx; yesY = ty;
      yesBtn.style.transform = `translate(${tx}px, ${ty}px)`;
      anim.cancel();
      yesMoving = false;
    };
  }

  // его последние слова — после «да» или после «нет»; потом лонгрид растворяется
  function farewell(main, sub) {
    answered = true;
    question.classList.add("is-thanks");
    thanks.innerHTML = "";
    const a = document.createElement("span");
    a.textContent = main;
    thanks.appendChild(a);
    later(reduce ? 0 : 2200, () => {
      const b = document.createElement("span");
      b.style.display = "block";
      b.style.fontSize = ".45em";
      b.style.marginTop = ".8em";
      b.textContent = sub;
      b.style.opacity = "0";
      b.style.transition = "opacity 1.4s ease";
      thanks.appendChild(b);
      requestAnimationFrame(() => (b.style.opacity = "1"));
    });
    // весь лонгрид растворяется
    later(reduce ? 200 : 5200, () => {
      if (typeof engine !== "undefined" && !engine.paused) engine.pause();
      question.classList.add("is-fading");
      document.documentElement.classList.add("is-vanishing");
    });
    later(reduce ? 400 : 9400, () => {
      document.documentElement.classList.remove("is-vanishing");
      document.documentElement.classList.add("is-gone");
      document.documentElement.style.overflow = "";
      question.hidden = true;
      window.scrollTo(0, 0);
      readAgain.hidden = false;
      document.getElementById("t-sources").setAttribute("tabindex", "-1");
      document.getElementById("t-sources").focus({ preventScroll: true });
    });
  }

  yesBtn.addEventListener("click", () => {
    if (yesMoving || answered) return;
    yesCount++;
    if (yesCount < 3) crawlAway();
    else farewell("Спасибо.", "Теперь я могу идти.");
  });
  noBtn.addEventListener("click", () => {
    if (answered) return;
    farewell("Каждый читатель видит меня по\u2011разному.", "Ты увидел меня таким…");   // неразрывный дефис
  });

  askBtn.addEventListener("click", openQuestion);
  document.addEventListener("keydown", (e) => {
    if (question.hidden) return;
    if (e.key === "Escape") { e.preventDefault(); closeQuestion(); }
    else if (e.key === "Tab") {                                          // фокус ходит только между «да» и «нет»
      e.preventDefault();
      (document.activeElement === yesBtn ? noBtn : yesBtn).focus();
    }
  });
  readAgain.addEventListener("click", () => location.reload());

  /* ---------- подвал: парад слева направо ---------- */
  const creditsTrack = document.getElementById("creditsTrack");
  if (creditsTrack && window.marcherSVG) {
    // ряд должен быть шире любого экрана, иначе в ленте будет дыра
    const kinds = [];
    for (let i = 0; i < 30; i++) kinds.push(i % 10 === 0 ? "flag" : i % 2 ? "drum" : "horn");
    const row = kinds.map((k) => window.marcherSVG(k)).join("");
    creditsTrack.innerHTML = row + row;
    creditsTrack.querySelectorAll(".marcher").forEach((m, i) => {
      m.querySelectorAll(".leg-a, .leg-b, .body").forEach((g) => { g.style.animationDelay = (-(i % 3) * 0.06) + "s"; });
    });
  }

  measure();
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", () => { measure(); onScroll(); });
  requestAnimationFrame(frame);
})();
