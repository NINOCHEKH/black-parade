/* =========================================================
   Глава V «Последнее слово» и финал
   • его последний текст идёт по одному отрывку: отрывок стоит в центре неподвижно,
     уже сказанное уходит в тусклый вихрь позади
   • через 3 секунды после последних слов внизу появляется кнопка «ответь мне на вопрос»
   • вопрос — о конкретном поступке: о сообщении «я тебя не люблю»
   • после ответа возвращается телефон с той перепиской; на «да» и на «нет»
     он реагирует по-разному (насколько откровенно), но ни один ответ не объявляет читателя правым
   • потом лонгрид растворяется, остаются источники
   ========================================================= */
(function () {
  const sec = document.getElementById("last-words");
  const scene = document.getElementById("lastScene");
  const vortex = document.getElementById("vortex");
  const source = document.getElementById("lastText");
  const lineEl = document.getElementById("lastLine");
  const askBtn = document.getElementById("askBtn");
  const question = document.getElementById("question");
  const yesBtn = document.getElementById("yesBtn");
  const noBtn = document.getElementById("noBtn");
  const verdictPhone = document.getElementById("verdictPhone");
  const verdictWords = document.getElementById("verdictWords");
  const readAgain = document.getElementById("readAgain");
  if (!sec || !scene || !vortex || !source) return;

  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const clamp01 = (x) => Math.max(0, Math.min(1, x));

  // одинаковый «хаос» при каждом заходе
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

  /* ---------- текст → отрывки (по нескольку фраз, чтобы каждый читался целиком) ---------- */
  const sentences = [];          // { text, beat }
  const beats = [];
  source.querySelectorAll("p").forEach((p) => {
    let cur = "";
    p.textContent.split(/(?<=[.?!…])\s+/).forEach((s) => {
      s = s.trim();
      if (!s) return;
      if (cur && (cur + " " + s).length > 240) { beats.push(cur); cur = s; }
      else cur = cur ? cur + " " + s : s;
      sentences.push({ text: s, beat: beats.length });
    });
    if (cur) beats.push(cur);
  });

  /* ---------- вихрь: только уже сказанное ---------- */
  const items = sentences.map((s) => {
    const el = document.createElement("p");
    el.className = "vx";
    el.textContent = s.text;
    vortex.appendChild(el);
    return {
      el, beat: s.beat, a: 0,
      r: 0.26 + rnd() * 0.3,
      tilt: (rnd() - 0.5) * 1.8,
      roll: (rnd() - 0.5) * 1.0,
      w: (rnd() < 0.5 ? -1 : 1) * (0.03 + rnd() * 0.06),     // медленнее, чем раньше
      th: rnd() * Math.PI * 2,
      ox: (rnd() - 0.5) * 0.25, oy: (rnd() - 0.5) * 0.18, oz: -0.15 - rnd() * 0.42,
      bob: rnd() * 6.28, bobS: 0.2 + rnd() * 0.3,
      spin: (rnd() - 0.5) * 8,
    };
  });

  // «глубинка»: обрывки тех же фраз далеко позади
  const deep = [];
  for (let i = 0; i < 10; i++) {
    const words = sentences[(rnd() * sentences.length) | 0].text.split(" ");
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
    U = Math.max(Math.min(W, H * 1.5), Math.min(H, 700));
  }

  /* ---------- текущий отрывок: стоит, пока его читают ---------- */
  let shownIdx = -1, wantIdx = -1, swapTimer = 0;
  function setBeat(idx) {
    if (!lineEl || idx === wantIdx) return;
    wantIdx = idx;
    clearTimeout(swapTimer);
    if (shownIdx >= 0) lineEl.classList.remove("is-on");
    swapTimer = setTimeout(() => {
      shownIdx = wantIdx;
      if (shownIdx < 0) { lineEl.textContent = ""; return; }
      lineEl.textContent = beats[shownIdx];
      lineEl.classList.toggle("is-final", shownIdx === beats.length - 1);
      requestAnimationFrame(() => lineEl.classList.add("is-on"));
    }, shownIdx >= 0 && !reduce ? 800 : 0);
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
      // фраза уходит в вихрь, когда её отрывок сменился следующим
      const target = wantIdx > it.beat ? 1 : 0;
      it.a += (target - it.a) * Math.min(1, dt * (reduce ? 60 : 0.9));
      if (it.a < 0.003) { if (it.op !== "0") { it.op = "0"; it.el.style.opacity = "0"; } return; }
      const th = it.th + (reduce ? 0 : t * it.w);
      const r = it.r * U;
      const x0 = Math.cos(th) * r, z0 = Math.sin(th) * r;
      const y1 = -z0 * Math.sin(it.tilt), z1 = z0 * Math.cos(it.tilt);
      const x = x0 * Math.cos(it.roll) - y1 * Math.sin(it.roll) + it.ox * U;
      const y = x0 * Math.sin(it.roll) + y1 * Math.cos(it.roll) + it.oy * H + Math.sin(t * it.bobS + it.bob) * 14;
      // пока фраза только уходит, она ещё близко; потом отступает в глубину
      const z = (z1 + it.oz * U) * 0.8 - (1 - it.a) * U * 0.6;
      const zMin = -0.85 * U, zMax = 0.3 * U;
      const f = clamp01((z - zMin) / (zMax - zMin));
      // размытие задано в CSS один раз; каждый кадр меняем только положение и прозрачность
      it.el.style.transform = `translate(-50%, -50%) translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, ${z.toFixed(1)}px) rotate(${(Math.sin(t * 0.3 + it.bob) * it.spin).toFixed(2)}deg)`;
      const op = (it.a * (0.04 + 0.3 * Math.pow(f, 1.7))).toFixed(2);
      if (op !== it.op) { it.op = op; it.el.style.opacity = op; }
      const zi = String(Math.round(f * 20));
      if (zi !== it.zi) { it.zi = zi; it.el.style.zIndex = zi; }
    });

    const deepA = wantIdx > 0 ? 0.16 : 0;
    deep.forEach((d) => {
      d.x += d.vx * dt;
      if (d.x > 1) d.x = -1; if (d.x < -1) d.x = 1;
      const y = d.y * H + Math.sin(t * 0.2 + d.ph) * 30;
      d.el.style.transform = `translate(-50%, -50%) translate3d(${(d.x * W).toFixed(1)}px, ${y.toFixed(1)}px, ${d.z}px)`;
      if (d.op !== deepA) { d.op = deepA; d.el.style.opacity = String(deepA); }
    });

    // кнопка — через 3 секунды после того, как прозвучали последние слова
    if (shownIdx === beats.length - 1 && vortexActive) seenTime += Math.min(0.5, realDt);
    if (askBtn.hidden && seenTime > 3) {
      askBtn.hidden = false;
      requestAnimationFrame(() => askBtn.classList.add("is-shown"));
    }
  }

  let vortexActive = false, geo = null, scrollTick = false;
  function onScroll() {
    if (scrollTick) return;
    scrollTick = true;
    requestAnimationFrame(() => { scrollTick = false; measureScroll(); });
  }
  function measureScroll() {
    if (!geo) geo = { top: parseFloat(getComputedStyle(scene).top) || 0, h: scene.offsetHeight };
    const r = sec.getBoundingClientRect();
    const vh = window.innerHeight;
    visible = r.bottom > 0 && r.top < vh;
    const hh = geo.top;
    const q = clamp01((hh - r.top) / Math.max(1, r.height - geo.h));
    const sr = scene.getBoundingClientRect();
    vortexActive = Math.min(sr.bottom, vh) - Math.max(sr.top, 0) >= sr.height * 0.5;
    const near = r.top < vh * 0.6 && r.bottom > vh * 0.4;
    setBeat(near ? Math.min(beats.length - 1, Math.floor(q * beats.length * 0.999)) : -1);
  }

  /* ---------- вопрос ---------- */
  const timers = [];
  const later = (ms, fn) => timers.push(setTimeout(fn, ms));
  const wait = (ms) => new Promise((res) => setTimeout(res, reduce ? 0 : ms));

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

  /* ---------- ответ: та же переписка, тот же телефон ---------- */
  const THREAD = [
    { who: "me",  meta: "Я · 23:52 · доставлено", text: "не приходи больше. я тебя не люблю" },
    { who: "her", meta: "Она · 00:03", text: "я всё равно приду во вторник" },
  ];
  // две версии различаются откровенностью; ни одна не говорит читателю «ты прав»
  const ANSWERS = {
    yes: {
      before: [{ big: true, text: "Спасибо." }, { text: "Мне очень хочется в это верить." }],
      type: "я жду тебя во вторник",
      send: false,
      after: [{ text: "Пусть лучше злится на живого." }],
    },
    no: {
      before: [{ big: true, text: "Может быть." }, { text: "Я говорил себе, что делаю это ради неё. Как же я ошибался." }],
      type: "Знаешь, я тебя никогда и не любил. Хватит, оставь меня",
      send: true,
      after: [],
    },
  };

  let ph = null;   // части клонированного телефона
  function buildPhone() {
    const src = document.getElementById("phone");
    if (!src || !verdictPhone) return null;
    const p = src.cloneNode(true);
    p.removeAttribute("id");
    p.removeAttribute("style");
    p.classList.remove("is-off", "is-low");
    p.querySelectorAll("[id]").forEach((e) => e.removeAttribute("id"));
    const list = p.querySelector(".sms-list");
    list.removeAttribute("role"); list.removeAttribute("aria-label");
    list.innerHTML = "";
    THREAD.forEach((m) => list.appendChild(smsEl(m)));
    const draft = p.querySelector(".sms-input span");
    draft.textContent = "";
    const clock = p.querySelector(".sms-status span:nth-child(2)");
    if (clock) clock.textContent = "00:41";
    const bat = p.querySelector(".sms-battery");
    if (bat) bat.style.setProperty("--bat", "0.12");
    p.style.setProperty("--glow", "0.75");
    verdictPhone.innerHTML = "";
    verdictPhone.appendChild(p);
    return { p, list, draft, keys: Array.from(p.querySelectorAll(".key")) };
  }
  function smsEl(m) {
    const el = document.createElement("div");
    el.className = "sms sms--" + m.who;
    el.style.animation = "none";
    el.innerHTML = `<span class="sms__meta"></span>`;
    el.firstChild.textContent = m.meta;
    el.appendChild(document.createTextNode(m.text));
    return el;
  }
  function say(line) {
    const el = document.createElement("p");
    if (line.big) el.className = "is-big";
    el.textContent = line.text;
    verdictWords.appendChild(el);
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("is-on")));
  }
  function press() {
    if (!ph || !ph.keys.length) return;
    const k = ph.keys[(Math.random() * ph.keys.length) | 0];
    k.classList.add("is-down");
    setTimeout(() => k.classList.remove("is-down"), 90);
  }
  async function typeText(text) {
    const step = Math.min(110, 4200 / text.length);      // длинное сообщение печатается быстрее
    for (let i = 1; i <= text.length; i++) { ph.draft.textContent = text.slice(0, i); press(); await wait(step); }
  }
  async function eraseText() {
    let t = ph.draft.textContent;
    while (t.length) { t = t.slice(0, -1); ph.draft.textContent = t; press(); await wait(45); }
  }

  async function answer(kind) {
    if (answered) return;
    answered = true;
    timers.forEach(clearTimeout); timers.length = 0;
    const A = ANSWERS[kind];
    ph = buildPhone();
    verdictWords.innerHTML = "";
    question.classList.add("is-verdict");
    await wait(1600);
    for (const l of A.before) { say(l); await wait(2600); }
    if (ph) {
      await wait(600);
      await typeText(A.type);
      await wait(1400);
      if (A.send) {
        const m = { who: "me", meta: "Я · 00:42 · отправляется…", text: A.type };
        const el = smsEl(m);
        el.style.animation = "";
        ph.draft.textContent = "";
        ph.list.appendChild(el);
        await wait(1600);
        ph.p.classList.add("is-low");
        await wait(2200);
      } else {
        await eraseText();
        await wait(900);
        ph.p.classList.add("is-low");
        await wait(1800);
      }
      ph.p.classList.add("is-off");
      await wait(1400);
    }
    for (const l of A.after) { say(l); await wait(3200); }
    if (!A.after.length) await wait(1800);   // погасший экран ещё немного держится, потом всё исчезает
    vanishAll();
  }

  // весь лонгрид растворяется, остаются источники
  function vanishAll() {
    if (typeof engine !== "undefined" && !engine.paused) engine.pause();
    question.classList.add("is-fading");
    document.documentElement.classList.add("is-vanishing");
    setTimeout(() => {
      document.documentElement.classList.remove("is-vanishing");
      document.documentElement.classList.add("is-gone");
      document.documentElement.style.overflow = "";
      question.hidden = true;
      window.scrollTo(0, 0);
      readAgain.hidden = false;
      document.getElementById("t-sources").setAttribute("tabindex", "-1");
      document.getElementById("t-sources").focus({ preventScroll: true });
    }, reduce ? 200 : 4200);
  }

  yesBtn.addEventListener("click", () => answer("yes"));
  noBtn.addEventListener("click", () => answer("no"));

  askBtn.addEventListener("click", openQuestion);
  document.addEventListener("keydown", (e) => {
    if (question.hidden || answered) return;
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
  window.addEventListener("layoutresize", () => { geo = null; measure(); measureScroll(); });
  requestAnimationFrame(frame);
})();
