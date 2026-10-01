/* =========================================================
   Black Parade — первый экран: бегущие буквы, круг песен, плеер
   ========================================================= */

/*
  Песни в том порядке, в каком они стоят на круге (по часовой стрелке).
  ts / ls — размер названия и строки, bt / bl — толщина и длина красной полосы (px макета).
  line — строчка из песни на красной полосе, после хронометража. Вставь текст из макета
         между кавычками, без «ёлочек» — они добавятся сами. Пример: line: "текст строчки"
  src  — путь к mp3 в папке assets.
*/
const SONGS = [
  { title: "Cancer",                      time: "2:23", line: "", src: "assets/cancer.mp3", ts: 65.7, ls: 16.1, bt: 10.4, bl: 291 },
  { title: "Disenchanted",                time: "4:55", line: "", src: "assets/disenchanted.mp3", ts: 58.0, ls: 17.6, bt: 11.4, bl: 237 },
  { title: "Famous Last Words",           time: "4:59", line: "", src: "assets/famous-last-words.mp3", ts: 47.7, ls: 19.9, bt: 12.9, bl: 330 },
  { title: "Dead!",                       time: "3:16", line: "", src: "assets/dead.mp3", ts: 62.1, ls: 22.1, bt: 14.7, bl: 507 },
  { title: "THE END.",                    time: "1:53", line: "", src: "assets/the-end.mp3", ts: 80, ls: 28.5, bt: 18.8, bl: 591 },
  { title: "This Is How I Disappear",     time: "3:59", line: "", src: "assets/this-is-how-i-disappear.mp3", ts: 40.6, ls: 17.0, bt: 11.0, bl: 287 },
  { title: "The Sharpest Lives",          time: "3:21", line: "", src: "assets/the-sharpest-lives.mp3", ts: 42.3, ls: 14.5, bt: 9.4,  bl: 338 },
  { title: "Welcome to the Black Parade", time: "5:11", line: "", src: "assets/welcome-to-the-black-parade.mp3", ts: 51.3, ls: 25.5, bt: 16.5, bl: 401 },
  { title: "I Don't Love You",            time: "3:59", line: "", src: "assets/i-dont-love-you.mp3", ts: 45.6, ls: 16.3, bt: 10.4, bl: 440 },
];

const START_SONG = 4;          // THE END.
const STEP = 20;               // угол между песнями, градусов
const COPIES = 2;              // песни повторяются по кругу дважды: 9 × 2 × 20° = 360°
const DRIFT_SPEED = 3;         // скорость медленного вращения, градусов в секунду
const TOP_ANGLE = -90;         // «центр» — луч смотрит строго вверх

const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* ---------- Круг с песнями ---------- */
const wheel = document.getElementById("wheel");
const spin = document.getElementById("wheelSpin");
const rays = [];

for (let k = 0; k < SONGS.length * COPIES; k++) {
  const s = k % SONGS.length;
  const song = SONGS[s];
  const base = TOP_ANGLE + (k - START_SONG) * STEP;

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "ray";
  btn.dataset.song = s;
  btn.dataset.base = base;
  btn.style.setProperty("--a", base + "deg");
  btn.style.setProperty("--ts", song.ts);
  btn.style.setProperty("--ls", song.ls);
  btn.style.setProperty("--bt", song.bt);
  btn.style.setProperty("--bl", song.bl);

  if (k >= SONGS.length) {
    // Вторая копия — только для визуала, клавиатура и скринридер видят песни один раз
    btn.tabIndex = -1;
    btn.setAttribute("aria-hidden", "true");
  } else {
    btn.setAttribute("aria-label", `${song.title}, ${song.time}`);
  }

  const esc = (t) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const line = song.line ? ` «${esc(song.line)}»` : "";
  btn.innerHTML =
    `<span class="ray__title">${song.title}</span>` +
    `<span class="ray__bar"><span class="ray__line">— ${song.time}${line}</span></span>`;

  btn.addEventListener("click", () => selectSong(s, { autoplay: true, slot: k }));
  spin.appendChild(btn);
  rays.push(btn);
}

let rotation = 0;              // текущий поворот круга, градусов
let current = START_SONG;      // выбранная песня
let hovering = false;
let tween = null;              // активная докрутка

function applyRotation() {
  spin.style.transform = `rotate(${rotation}deg)`;
}

// Насколько надо повернуть круг, чтобы слот k оказался наверху (кратчайший путь)
function deltaToTop(k) {
  const base = Number(rays[k].dataset.base);
  let d = (TOP_ANGLE - base - rotation) % 360;
  if (d > 180) d -= 360;
  if (d < -180) d += 360;
  return d;
}

function rotateBy(delta) {
  if (reduceMotion || Math.abs(delta) < 0.01) {
    rotation += delta;
    applyRotation();
    tween = null;
    return;
  }
  const from = rotation;
  const duration = Math.min(1600, 600 + Math.abs(delta) * 6);
  const start = performance.now();
  tween = { from, delta, start, duration };
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function selectSong(s, { autoplay = false, slot = null } = {}) {
  // Выбираем копию песни, до которой ближе крутить
  const slots = slot !== null ? [slot] : rays.map((r, i) => i).filter((i) => i % SONGS.length === s);
  let best = slots[0];
  slots.forEach((k) => { if (Math.abs(deltaToTop(k)) < Math.abs(deltaToTop(best))) best = k; });
  rotateBy(deltaToTop(best));

  const changed = s !== current;
  current = s;
  setCurrentSlot(best);
  loadSong(s, { autoplay, changed });
}

/* ---------- Раздвигание соседей и размер выбранной песни ---------- */
const GAP = 11;            // на сколько градусов соседи отъезжают от выбранной песни
const ACTIVE_SCALE = 1.35; // во сколько раз растёт выбранная песня (если помещается)
let currentSlot = START_SONG;

// Отмечаем выбранный луч и считаем, куда сдвинуть остальные:
// слева — ещё левее, справа — ещё правее; чем дальше луч, тем меньше сдвиг
function setCurrentSlot(k) {
  currentSlot = k;
  const base0 = Number(rays[k].dataset.base);
  rays.forEach((r, i) => {
    r.classList.toggle("is-current", i === k);
    let d = (Number(r.dataset.base) - base0) % 360;
    if (d > 180) d -= 360;
    if (d <= -180) d += 360;
    const shift = i === k ? 0 : Math.sign(d) * GAP * (1 - Math.abs(d) / 180);
    r.style.setProperty("--shift", shift.toFixed(2) + "deg");
  });
}

// Подбираем увеличение для каждой песни так, чтобы она не заходила под плеер
function fitActiveScales() {
  const u = wheel.offsetTop / 1023;                 // 1px макета в пикселях экрана
  const room = wheel.offsetTop - (300 + 40) * u;    // от конца полосы до плеера, с запасом
  rays.forEach((r) => {
    const title = r.querySelector(".ray__title");
    const bar = r.querySelector(".ray__bar");
    const reach = Math.max(title.offsetWidth, bar.offsetWidth);
    const s = Math.max(1, Math.min(ACTIVE_SCALE, room / reach));
    r.style.setProperty("--sa", s.toFixed(3));
  });
}

window.addEventListener("resize", fitActiveScales);
if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitActiveScales);

let lastTime = performance.now();
function frame(now) {
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;

  if (tween) {
    const t = Math.min(1, (now - tween.start) / tween.duration);
    rotation = tween.from + tween.delta * easeInOutCubic(t);
    if (t >= 1) tween = null;
    applyRotation();
  } else if (!reduceMotion && !hovering && engine.paused) {
    // Круг медленно плывёт, пока музыка не играет
    rotation -= DRIFT_SPEED * dt;
    applyRotation();
  }
  updateProgress();
  requestAnimationFrame(frame);
}

// Пока курсор над названиями, круг не уплывает из-под мыши
spin.addEventListener("pointerover", (e) => { if (e.target.closest(".ray")) hovering = true; });
spin.addEventListener("pointerout", (e) => { if (!e.relatedTarget || !e.relatedTarget.closest || !e.relatedTarget.closest(".ray")) hovering = false; });
spin.addEventListener("focusin", () => { hovering = true; });
spin.addEventListener("focusout", () => { hovering = false; });

/* ---------- Плеер ---------- */
/*
  Два способа играть звук:
  • обычный <audio> — для сайта (файлы лежат в assets/);
  • Web Audio — если звук встроен прямо в страницу (window.EMBEDDED_AUDIO).
    Так музыка играет даже там, где <audio> блокируется (например, превью в чате).
*/
const audio = document.getElementById("audio");
const player = document.getElementById("player");
const playerTitle = document.getElementById("playerTitle");
const btnPlay = document.getElementById("btnPlay");
const btnPrev = document.getElementById("btnPrev");
const btnNext = document.getElementById("btnNext");
const progressFill = document.getElementById("progressFill");

const engine = {
  mode: "none",          // "html" | "webaudio" | "none"
  src: null,
  paused: true,
  // Web Audio
  ctx: null, buffer: null, decoding: null, node: null, offset: 0, startedAt: 0,

  load(src) {
    this.stop();
    this.src = src;
    this.buffer = null;
    this.decoding = null;
    this.offset = 0;
    const embedded = window.EMBEDDED_AUDIO && window.EMBEDDED_AUDIO[src];
    if (embedded) {
      this.mode = "webaudio";
      audio.removeAttribute("src");
    } else if (src) {
      this.mode = "html";
      audio.src = src;
      audio.load();
    } else {
      this.mode = "none";
      audio.removeAttribute("src");
      audio.load();
    }
  },

  async play() {
    if (this.mode === "html") {
      try { await audio.play(); }
      catch (err) { console.warn("Не удалось включить трек:", err); setPlaying(false); }
      return;
    }
    if (this.mode !== "webaudio") return;

    const src = this.src;   // если за время загрузки переключили песню — старую не включаем
    if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (this.ctx.state === "suspended") await this.ctx.resume();
    if (!this.buffer) {
      if (!this.decoding) {
        const bytes = base64ToBytes(window.EMBEDDED_AUDIO[src]);
        this.decoding = this.ctx.decodeAudioData(bytes.buffer);
      }
      const decoded = await this.decoding;
      if (this.src !== src) return;
      this.buffer = decoded;
    }
    if (this.src !== src || !this.paused) return;

    const node = this.ctx.createBufferSource();
    node.buffer = this.buffer;
    node.connect(this.ctx.destination);
    node.onended = () => {
      if (this.node !== node) return;   // остановили вручную
      this.node = null;
      this.offset = 0;
      this.paused = true;
      setPlaying(false);
    };
    node.start(0, this.offset);
    this.node = node;
    this.startedAt = this.ctx.currentTime - this.offset;
    this.paused = false;
    setPlaying(true);
  },

  pause() {
    if (this.mode === "html") { audio.pause(); return; }
    if (this.mode !== "webaudio" || this.paused) return;
    this.offset = this.currentTime;
    this.stop();
    setPlaying(false);
  },

  stop() {
    if (this.node) {
      const node = this.node;
      this.node = null;
      try { node.stop(); } catch (e) {}
    }
    if (this.mode === "html") audio.pause();
    this.paused = true;
  },

  get currentTime() {
    if (this.mode === "html") return audio.currentTime;
    if (this.mode === "webaudio") return this.paused ? this.offset : this.ctx.currentTime - this.startedAt;
    return 0;
  },

  get duration() {
    if (this.mode === "html") return audio.duration || 0;
    if (this.mode === "webaudio") return this.buffer ? this.buffer.duration : 0;
    return 0;
  },
};

function base64ToBytes(b64) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// Меняем иконку: играет — пауза, стоит — плей.
// Круг тоже переключается: при игре выделяет песню, при остановке возвращается в обычный вид.
// Возврат чуть откладываем, чтобы при переключении песни круг не «мигал».
let wheelResetTimer = null;
function setPlaying(isPlaying) {
  if (engine.mode === "html") engine.paused = !isPlaying;
  player.classList.toggle("is-playing", isPlaying);
  clearTimeout(wheelResetTimer);
  if (isPlaying) wheel.classList.add("is-playing");
  else wheelResetTimer = setTimeout(() => {
    if (engine.paused) wheel.classList.remove("is-playing");
  }, 600);
  btnPlay.setAttribute("aria-label", isPlaying ? "Пауза" : "Включить");
  btnPlay.setAttribute("aria-pressed", String(isPlaying));
}

function updateProgress() {
  const d = engine.duration;
  progressFill.style.width = d ? Math.min(100, (engine.currentTime / d) * 100) + "%" : "0";
}

function loadSong(s, { autoplay, changed }) {
  const song = SONGS[s];
  playerTitle.textContent = song.title.toUpperCase();

  if (!song.src) {
    engine.load(null);
    setPlaying(false);
    btnPlay.disabled = true;
    btnPlay.setAttribute("aria-label", "Трек ещё не добавлен");
    player.classList.add("is-empty");
    return;
  }

  btnPlay.disabled = false;
  player.classList.remove("is-empty");
  if (changed || engine.src !== song.src) {
    engine.load(song.src);
    setPlaying(false);
  }
  if (autoplay) play();
}

function play() {
  selectSlotOnly(current);   // перед запуском докручиваем круг к текущей песне
  engine.play();
}

function selectSlotOnly(s) {
  const slots = rays.map((r, i) => i).filter((i) => i % SONGS.length === s);
  let best = slots[0];
  slots.forEach((k) => { if (Math.abs(deltaToTop(k)) < Math.abs(deltaToTop(best))) best = k; });
  rotateBy(deltaToTop(best));
  setCurrentSlot(best);
}

btnPlay.addEventListener("click", () => {
  if (engine.paused) play();
  else engine.pause();
});

btnPrev.addEventListener("click", () => {
  selectSong((current - 1 + SONGS.length) % SONGS.length, { autoplay: !engine.paused });
});

btnNext.addEventListener("click", () => {
  selectSong((current + 1) % SONGS.length, { autoplay: !engine.paused });
});

// События обычного <audio>
audio.addEventListener("play", () => setPlaying(true));
audio.addEventListener("pause", () => setPlaying(false));
audio.addEventListener("ended", () => setPlaying(false));
audio.addEventListener("error", () => {
  if (engine.mode === "html" && audio.getAttribute("src")) {
    console.warn("Файл не найден или не читается:", audio.getAttribute("src"));
    setPlaying(false);
  }
});

// Пробел на странице — включить / выключить (если фокус не на кнопке)
document.addEventListener("keydown", (e) => {
  if (e.code === "Space" && !e.target.closest("button, a, input, textarea")) {
    e.preventDefault();
    if (!btnPlay.disabled) btnPlay.click();
  }
});

/* ---------- Второй блок: печатная машинка + пошаговый скролл ---------- */
/*
  Как работает:
  • когда блок доходит до верха экрана, страница «встаёт» на нём;
  • первая фраза печатается сама, каждая следующая — по прокрутке вниз
    (пока фраза печатается, прокрутка не срабатывает);
  • прошлые фразы затухают;
  • после последней фразы страница снова листается как обычно.
  Прокрутка вверх всегда отпускает — можно вернуться к кругу.
*/
const story = document.getElementById("story");
const storyBlocks = Array.from(story.querySelectorAll(".story__block"));

const TYPE_SPEED = 26;          // мс на букву
const TYPE_JITTER = 16;         // случайная добавка, чтобы ритм был «живой»
const PAUSE_AFTER = { ".": 260, "?": 260, "!": 260, "…": 260, ",": 140, "—": 120, ";": 160, ":": 160 };

let storyStep = -1;             // какая фраза сейчас последняя
let storyTyping = false;
let storyLocked = false;
let storyDone = false;
let storyCooldown = 0;
let wheelAcc = 0;
let lastWheelTime = 0;
let lastScrollY = window.scrollY;

// Разбиваем каждую фразу на буквы, переносы строк сохраняем
storyBlocks.forEach((block) => {
  const chars = [];
  Array.from(block.childNodes).forEach((node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      const frag = document.createDocumentFragment();
      for (const ch of node.textContent) {
        const span = document.createElement("span");
        span.className = "ch";
        span.textContent = ch;
        frag.appendChild(span);
        chars.push(span);
      }
      node.replaceWith(frag);
    }
  });
  block._chars = chars;
  block.setAttribute("aria-label", block.textContent);
});

const caret = document.createElement("span");
caret.className = "caret";
caret.setAttribute("aria-hidden", "true");

function typeBlock(block) {
  return new Promise((resolve) => {
    const chars = block._chars;
    let i = 0;
    if (reduceMotion) {
      chars.forEach((c) => c.classList.add("is-on"));
      chars[chars.length - 1].after(caret);
      resolve();
      return;
    }
    if (chars.length) chars[0].before(caret);
    (function next() {
      if (i >= chars.length) { resolve(); return; }
      const c = chars[i++];
      c.classList.add("is-on");
      c.after(caret);
      const pause = PAUSE_AFTER[c.textContent] || 0;
      setTimeout(next, TYPE_SPEED + Math.random() * TYPE_JITTER + pause);
    })();
  });
}

function storyTop() {
  return story.getBoundingClientRect().top + window.scrollY;
}

function advanceStory() {
  if (storyTyping || storyStep >= storyBlocks.length - 1) return;
  storyStep++;
  storyBlocks.forEach((b, i) => {
    if (i <= storyStep) b.dataset.age = String(Math.min(3, storyStep - i));
  });
  storyTyping = true;
  story.classList.remove("can-next");
  typeBlock(storyBlocks[storyStep]).then(() => {
    storyTyping = false;
    storyCooldown = performance.now() + 450;
    wheelAcc = 0;
    if (storyStep === storyBlocks.length - 1) {
      storyDone = true;
      unlockStory();
    } else {
      story.classList.add("can-next");
    }
  });
}

function lockStory() {
  if (storyLocked || storyDone) return;
  storyLocked = true;
  window.scrollTo(0, storyTop());
  if (storyStep < 0) advanceStory();
}

function unlockStory() {
  storyLocked = false;
}

function canAdvance() {
  return !storyTyping && performance.now() >= storyCooldown;
}

window.addEventListener("scroll", () => {
  const y = window.scrollY;
  const top = storyTop();
  if (storyLocked) {
    if (y < top - 2) unlockStory();              // ушли вверх (например, ползунком)
    else if (y > top + 1) window.scrollTo(0, top); // вниз пока нельзя
  } else if (!storyDone && y > lastScrollY && y >= top - 1) {
    lockStory();
  }
  lastScrollY = window.scrollY;
}, { passive: true });

window.addEventListener("wheel", (e) => {
  if (!storyLocked) return;
  if (e.deltaY < 0) { unlockStory(); return; }   // вверх — отпускаем
  e.preventDefault();
  const now = performance.now();
  if (now - lastWheelTime > 250) wheelAcc = 0;    // новый жест
  lastWheelTime = now;
  if (!canAdvance()) { wheelAcc = 0; return; }
  wheelAcc += e.deltaY;
  if (wheelAcc > 40) { wheelAcc = 0; advanceStory(); }
}, { passive: false });

let touchStartY = null;
window.addEventListener("touchstart", (e) => { touchStartY = e.touches[0].clientY; }, { passive: true });
window.addEventListener("touchmove", (e) => {
  if (!storyLocked || touchStartY === null) return;
  const dy = touchStartY - e.touches[0].clientY;  // > 0 — свайп вверх, то есть листаем вниз
  if (dy < -10) { unlockStory(); return; }
  e.preventDefault();
  if (dy > 50 && canAdvance()) {
    touchStartY = e.touches[0].clientY;
    advanceStory();
  }
}, { passive: false });

window.addEventListener("keydown", (e) => {
  if (!storyLocked) return;
  if (["ArrowDown", "PageDown", "End"].includes(e.code)) {
    e.preventDefault();
    if (canAdvance()) advanceStory();
  } else if (["ArrowUp", "PageUp", "Home"].includes(e.code)) {
    unlockStory();
  }
});

// При перезагрузке всегда начинаем сверху — иначе можно оказаться посреди блока
if ("scrollRestoration" in history) history.scrollRestoration = "manual";

/* ---------- Старт ---------- */
setCurrentSlot(START_SONG);
fitActiveScales();
loadSong(current, { autoplay: false, changed: true });
applyRotation();
requestAnimationFrame(frame);
