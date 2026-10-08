/* ==========================================================================
   SECUENCIADOR — 16 pasos, línea ácida monofónica + kick / hat / clap
   - Scheduler con lookahead (el audio se agenda por adelantado, la UI sigue)
   - Perillas accesibles (role=slider, arrastre, rueda y teclado)
   - Patrón compartible en la URL (#p=...)
   - Publica --pulse en los elementos visibles que lo usan, para que la página lata al tempo
   ========================================================================== */
(function initSequencer() {
  var E = window.AcidEngine;
  var machine = document.getElementById("machine");
  if (!E || !machine) return;

  var reduceMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;
  var root = document.documentElement;

  var STEPS = 16;
  // filas de nota, de grave a agudo (La menor pentatónica)
  var NOTES = [
    { midi: 33, name: "A1" },
    { midi: 36, name: "C2" },
    { midi: 38, name: "D2" },
    { midi: 40, name: "E2" },
    { midi: 43, name: "G2" },
    { midi: 45, name: "A2" },
    { midi: 48, name: "C3" },
    { midi: 50, name: "D3" },
  ];
  var FLAG_ROWS = [
    { key: "acc", name: "ACC", label: "acento" },
    { key: "slide", name: "SLD", label: "slide" },
    { key: "kick", name: "KICK", label: "kick" },
    { key: "hat", name: "HAT", label: "hi-hat" },
    { key: "clap", name: "CLAP", label: "clap" },
  ];

  /* ---- Presets ---- */
  function build(notes, acc, slide, kick, hat, clap) {
    var p = [];
    for (var i = 0; i < STEPS; i++) {
      p.push({
        note: notes[i],
        acc: !!acc[i],
        slide: !!slide[i],
        kick: kick.indexOf(i) !== -1,
        hat: hat.indexOf(i) !== -1,
        clap: clap.indexOf(i) !== -1,
      });
    }
    return p;
  }

  var QUARTERS = [0, 4, 8, 12];
  var PRESETS = [
    {
      pattern: build(
        [0, 0, 5, 0, 3, -1, 6, 0, 0, 4, 5, -1, 0, 2, 7, 6],
        [1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0],
        [0, 0, 1, 0, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0],
        QUARTERS,
        [2, 6, 10, 14],
        [4, 12],
      ),
      params: { tempo: 138, cutoff: 0.32, reso: 0.72, envMod: 0.62, decay: 0.42, drive: 0.35, wave: "sawtooth" },
    },
    {
      pattern: build(
        [0, -1, 0, 5, 0, -1, 3, 4, 0, 0, 5, -1, 6, 5, 3, 1],
        [1, 0, 0, 1, 0, 0, 0, 1, 1, 0, 0, 0, 1, 0, 0, 0],
        [0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 0, 0, 1, 1, 1, 0],
        QUARTERS,
        [2, 6, 10, 14, 15],
        [4, 12],
      ),
      params: { tempo: 132, cutoff: 0.22, reso: 0.88, envMod: 0.8, decay: 0.55, drive: 0.5, wave: "square" },
    },
    {
      pattern: build(
        [0, 0, 5, 0, 0, 5, 0, 0, 0, 0, 5, 0, 2, 3, 5, 7],
        [1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1],
        [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 0],
        QUARTERS,
        [2, 3, 6, 7, 10, 11, 14, 15],
        [4, 12],
      ),
      params: { tempo: 142, cutoff: 0.4, reso: 0.65, envMod: 0.5, decay: 0.3, drive: 0.45, wave: "sawtooth" },
    },
  ];

  var pattern = clonePattern(PRESETS[0].pattern);
  var presetIndex = 0;
  var edited = false;

  function clonePattern(p) {
    return p.map(function (s) {
      return Object.assign({}, s);
    });
  }

  /* ---- Elementos ---- */
  var gridEl = document.getElementById("grid");
  var knobsEl = document.getElementById("knobs");
  var playBtn = document.getElementById("playBtn");
  var readPat = document.getElementById("readPat");
  var readBpm = document.getElementById("readBpm");
  var readStep = document.getElementById("readStep");
  var navBpm = document.getElementById("navBpm");
  var scope = document.getElementById("scope");
  var scopeBg = document.getElementById("scopeBg");
  var waveBtns = machine.querySelectorAll("[data-wave]");
  var presetBtns = machine.querySelectorAll("[data-preset]");

  /* ==========================================================================
     GRILLA
     ========================================================================== */
  var cells = []; // cells[step] = { notes: [btn x8], acc, slide, kick, hat, clap }

  function addLabel(text, cls) {
    var l = document.createElement("div");
    l.className = "grid__label" + (cls ? " " + cls : "");
    l.textContent = text;
    l.setAttribute("aria-hidden", "true");
    gridEl.appendChild(l);
  }

  function makeCell(step, cls, label) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "cell " + cls + (step % 4 === 0 ? " cell--beat" : "");
    b.dataset.step = step;
    b.setAttribute("aria-label", "Paso " + (step + 1) + ", " + label);
    b.setAttribute("aria-pressed", "false");
    b.style.setProperty("--col", step + 2);
    gridEl.appendChild(b);
    return b;
  }

  function buildGrid() {
    for (var s = 0; s < STEPS; s++) cells.push({ notes: [] });

    // número de paso
    addLabel("", "grid__label--corner");
    for (var n = 0; n < STEPS; n++) {
      var num = document.createElement("div");
      num.className = "grid__stepnum" + (n % 4 === 0 ? " is-beat" : "");
      num.textContent = n + 1;
      num.setAttribute("aria-hidden", "true");
      gridEl.appendChild(num);
    }

    // notas: de agudo (arriba) a grave (abajo)
    for (var r = NOTES.length - 1; r >= 0; r--) {
      addLabel(NOTES[r].name);
      for (var st = 0; st < STEPS; st++) {
        var btn = makeCell(st, "cell--note", "nota " + NOTES[r].name);
        btn.dataset.note = r;
        cells[st].notes[r] = btn;
      }
    }

    FLAG_ROWS.forEach(function (row, i) {
      addLabel(row.name, i === 0 || i === 2 ? "grid__label--gap" : "");
      for (var st = 0; st < STEPS; st++) {
        var btn = makeCell(
          st,
          "cell--flag cell--" + row.key + (i === 0 || i === 2 ? " cell--gap" : ""),
          row.label,
        );
        btn.dataset.flag = row.key;
        cells[st][row.key] = btn;
      }
    });

    gridEl.addEventListener("click", function (e) {
      var b = e.target.closest(".cell");
      if (!b) return;
      var step = +b.dataset.step;
      var s = pattern[step];

      if (b.dataset.note !== undefined) {
        var r = +b.dataset.note;
        s.note = s.note === r ? -1 : r;
        if (s.note !== -1 && !playing) E.preview(NOTES[r].midi);
      } else {
        var key = b.dataset.flag;
        s[key] = !s[key];
      }
      markEdited();
      renderStep(step);
    });
  }

  function setPressed(btn, on) {
    btn.classList.toggle("is-on", on);
    btn.setAttribute("aria-pressed", on ? "true" : "false");
  }

  function renderStep(step) {
    var s = pattern[step];
    var c = cells[step];
    for (var r = 0; r < NOTES.length; r++) setPressed(c.notes[r], s.note === r);
    FLAG_ROWS.forEach(function (row) {
      setPressed(c[row.key], s[row.key]);
    });
  }

  function renderAll() {
    for (var i = 0; i < STEPS; i++) renderStep(i);
    readPat.textContent =
      edited ? "--" : ("0" + (presetIndex + 1)).slice(-2);
  }

  function markEdited() {
    if (!edited) {
      edited = true;
      readPat.textContent = "--";
    }
  }

  /* ==========================================================================
     PERILLAS
     ========================================================================== */
  var KNOBS = [
    { key: "tempo", label: "TEMPO", min: 100, max: 160, step: 1, fmt: function (v) { return Math.round(v); } },
    { key: "cutoff", label: "CUTOFF", min: 0, max: 1, step: 0.01 },
    { key: "reso", label: "RESO", min: 0, max: 1, step: 0.01 },
    { key: "envMod", label: "ENV MOD", min: 0, max: 1, step: 0.01 },
    { key: "decay", label: "DECAY", min: 0, max: 1, step: 0.01 },
    { key: "drive", label: "DRIVE", min: 0, max: 1, step: 0.01 },
    { key: "volume", label: "VOL", min: 0, max: 1, step: 0.01 },
  ];
  var knobEls = {};

  function pct(v) {
    return Math.round(v * 100);
  }

  function buildKnobs() {
    KNOBS.forEach(function (k) {
      var wrap = document.createElement("div");
      wrap.className = "knob";

      var dial = document.createElement("div");
      dial.className = "knob__dial";
      dial.tabIndex = 0;
      dial.setAttribute("role", "slider");
      dial.setAttribute("aria-label", k.label);
      dial.setAttribute("aria-valuemin", k.min);
      dial.setAttribute("aria-valuemax", k.max);
      dial.innerHTML = '<span class="knob__tick"></span>';

      var label = document.createElement("span");
      label.className = "knob__label";
      label.textContent = k.label;

      var value = document.createElement("span");
      value.className = "knob__value";

      wrap.appendChild(dial);
      wrap.appendChild(value);
      wrap.appendChild(label);
      knobsEl.appendChild(wrap);

      knobEls[k.key] = { def: k, dial: dial, value: value };
      bindKnob(k, dial);
    });
  }

  function setKnob(key, v, silent) {
    var ke = knobEls[key];
    var k = ke.def;
    v = Math.min(k.max, Math.max(k.min, v));
    if (k.step >= 1) v = Math.round(v);
    E.setParam(key, v);

    var norm = (v - k.min) / (k.max - k.min);
    ke.dial.style.setProperty("--angle", -135 + norm * 270 + "deg");
    ke.dial.style.setProperty("--norm", norm.toFixed(3));
    var shown = k.fmt ? k.fmt(v) : pct(v);
    ke.value.textContent = shown;
    ke.dial.setAttribute("aria-valuenow", v);
    ke.dial.setAttribute("aria-valuetext", String(shown));

    if (key === "tempo") {
      readBpm.textContent = Math.round(v);
      if (navBpm) navBpm.textContent = Math.round(v);
    }
    if (!silent) markEdited();
  }

  function bindKnob(k, dial) {
    var range = k.max - k.min;
    var startY = 0;
    var startV = 0;

    dial.addEventListener("pointerdown", function (e) {
      e.preventDefault();
      dial.setPointerCapture(e.pointerId);
      dial.focus();
      startY = e.clientY;
      startV = E.params[k.key];
      dial.classList.add("is-dragging");
    });
    dial.addEventListener("pointermove", function (e) {
      if (!dial.hasPointerCapture(e.pointerId)) return;
      var dy = startY - e.clientY;
      setKnob(k.key, startV + (dy / 160) * range);
    });
    function end(e) {
      if (dial.hasPointerCapture(e.pointerId)) {
        dial.releasePointerCapture(e.pointerId);
      }
      dial.classList.remove("is-dragging");
    }
    dial.addEventListener("pointerup", end);
    dial.addEventListener("pointercancel", end);

    dial.addEventListener(
      "wheel",
      function (e) {
        e.preventDefault();
        setKnob(k.key, E.params[k.key] - Math.sign(e.deltaY) * range * 0.03);
      },
      { passive: false },
    );

    dial.addEventListener("keydown", function (e) {
      var small = k.step >= 1 ? 1 : range / 100;
      var big = small * 10;
      var v = E.params[k.key];
      switch (e.key) {
        case "ArrowUp":
        case "ArrowRight":
          v += small;
          break;
        case "ArrowDown":
        case "ArrowLeft":
          v -= small;
          break;
        case "PageUp":
          v += big;
          break;
        case "PageDown":
          v -= big;
          break;
        case "Home":
          v = k.min;
          break;
        case "End":
          v = k.max;
          break;
        default:
          return;
      }
      e.preventDefault();
      setKnob(k.key, v);
    });
  }

  function setWave(wave, silent) {
    E.setParam("wave", wave);
    waveBtns.forEach(function (b) {
      setPressed(b, b.dataset.wave === wave);
    });
    if (!silent) markEdited();
  }

  function applyParams(p) {
    Object.keys(p).forEach(function (key) {
      if (key === "wave") setWave(p.wave, true);
      else if (knobEls[key]) setKnob(key, p[key], true);
    });
  }

  function loadPreset(i) {
    presetIndex = i;
    edited = false;
    pattern = clonePattern(PRESETS[i].pattern);
    applyParams(PRESETS[i].params);
    presetBtns.forEach(function (b) {
      setPressed(b, +b.dataset.preset === i);
    });
    renderAll();
  }

  /* ==========================================================================
     TRANSPORTE — scheduler con lookahead
     ========================================================================== */
  var playing = false;
  var nextTime = 0;
  var current = 0;
  var timer = null;
  var queue = [];
  var lastBeatTime = -1;
  var lastStepShown = -1;
  var SCHEDULE_AHEAD = 0.12;

  function stepDur() {
    return 60 / E.params.tempo / 4;
  }

  function scheduleStep(i, t) {
    var s = pattern[i];
    var prev = pattern[(i + STEPS - 1) % STEPS];
    var next = pattern[(i + 1) % STEPS];

    if (s.kick) E.kick(t);
    if (s.hat) E.hat(t, i % 4 === 2);
    if (s.clap) E.clap(t);

    if (s.note >= 0) {
      var glideIn = prev.note >= 0 && prev.slide && E.isHeld();
      var holdThrough = s.slide && next.note >= 0;
      E.note(t, NOTES[s.note].midi, s.acc, glideIn, holdThrough, stepDur());
    }
  }

  function scheduler() {
    var ctx = E.context();
    while (nextTime < ctx.currentTime + SCHEDULE_AHEAD) {
      scheduleStep(current, nextTime);
      queue.push({ step: current, time: nextTime });
      nextTime += stepDur();
      current = (current + 1) % STEPS;
    }
  }

  function start() {
    var ctx = E.init();
    if (!ctx) {
      window.toast && window.toast("Tu navegador no soporta Web Audio.");
      return;
    }
    ctx.resume();
    playing = true;
    current = 0;
    queue = [];
    nextTime = ctx.currentTime + 0.06;
    scheduler();
    timer = setInterval(scheduler, 25);
    playBtn.setAttribute("aria-pressed", "true");
    playBtn.querySelector(".mbtn__icon").textContent = "■";
    playBtn.querySelector(".mbtn__label").textContent = "STOP";
    root.classList.add("is-playing");
  }

  function stop() {
    playing = false;
    clearInterval(timer);
    E.release();
    queue = [];
    clearPlayhead();
    readStep.textContent = "--";
    playBtn.setAttribute("aria-pressed", "false");
    playBtn.querySelector(".mbtn__icon").textContent = "▶";
    playBtn.querySelector(".mbtn__label").textContent = "PLAY";
    root.classList.remove("is-playing");
  }

  function toggle() {
    if (playing) stop();
    else start();
  }

  function clearPlayhead() {
    if (lastStepShown < 0) return;
    gridEl
      .querySelectorAll('.cell[data-step="' + lastStepShown + '"]')
      .forEach(function (c) {
        c.classList.remove("is-playhead");
      });
    lastStepShown = -1;
  }

  function showPlayhead(step) {
    clearPlayhead();
    gridEl
      .querySelectorAll('.cell[data-step="' + step + '"]')
      .forEach(function (c) {
        c.classList.add("is-playhead");
      });
    lastStepShown = step;
    readStep.textContent = ("0" + (step + 1)).slice(-2);
  }

  /* ==========================================================================
     CONTROLES
     ========================================================================== */
  playBtn.addEventListener("click", toggle);

  waveBtns.forEach(function (b) {
    b.addEventListener("click", function () {
      setWave(b.dataset.wave);
    });
  });

  presetBtns.forEach(function (b) {
    b.addEventListener("click", function () {
      loadPreset(+b.dataset.preset);
    });
  });

  document.getElementById("mutateBtn").addEventListener("click", function () {
    for (var n = 0; n < 5; n++) {
      var i = Math.floor(Math.random() * STEPS);
      var s = pattern[i];
      var roll = Math.random();
      if (roll < 0.55) s.note = Math.random() < 0.15 ? -1 : Math.floor(Math.random() * NOTES.length);
      else if (roll < 0.8) s.slide = !s.slide;
      else s.acc = !s.acc;
    }
    markEdited();
    renderAll();
  });

  document.getElementById("clearBtn").addEventListener("click", function () {
    pattern.forEach(function (s) {
      s.note = -1;
      s.acc = false;
      s.slide = false;
    });
    markEdited();
    renderAll();
  });

  // ESPACIO = play/stop cuando el foco está en una perilla o en la máquina
  machine.addEventListener("keydown", function (e) {
    if (e.code !== "Space") return;
    if (e.target.tagName === "BUTTON") return;
    e.preventDefault();
    toggle();
  });

  /* ---- Compartir: el patrón viaja en el hash de la URL ---- */
  var B32 = "0123456789abcdefghijklmnopqrstuv";

  function encode() {
    var str = "";
    pattern.forEach(function (s) {
      var flags = (s.acc ? 1 : 0) | (s.slide ? 2 : 0) | (s.kick ? 4 : 0) | (s.hat ? 8 : 0) | (s.clap ? 16 : 0);
      str += (s.note < 0 ? "x" : String(s.note)) + B32[flags];
    });
    var P = E.params;
    var q = new URLSearchParams({
      p: str,
      t: Math.round(P.tempo),
      c: pct(P.cutoff),
      r: pct(P.reso),
      e: pct(P.envMod),
      d: pct(P.decay),
      x: pct(P.drive),
      w: P.wave === "square" ? "q" : "s",
    });
    return q.toString();
  }

  function decode(hash) {
    var q = new URLSearchParams(hash.replace(/^#/, ""));
    var str = q.get("p");
    if (!str || str.length !== STEPS * 2) return false;
    var p = [];
    for (var i = 0; i < STEPS; i++) {
      var n = str[i * 2];
      var f = B32.indexOf(str[i * 2 + 1]);
      if (f < 0) return false;
      var note = n === "x" ? -1 : parseInt(n, 10);
      if (isNaN(note) || note >= NOTES.length) return false;
      p.push({ note: note, acc: !!(f & 1), slide: !!(f & 2), kick: !!(f & 4), hat: !!(f & 8), clap: !!(f & 16) });
    }
    pattern = p;
    function num(key, div) {
      var v = parseFloat(q.get(key));
      return isNaN(v) ? undefined : v / div;
    }
    var params = { tempo: num("t", 1), cutoff: num("c", 100), reso: num("r", 100), envMod: num("e", 100), decay: num("d", 100), drive: num("x", 100), wave: q.get("w") === "q" ? "square" : "sawtooth" };
    Object.keys(params).forEach(function (k) {
      if (params[k] === undefined) delete params[k];
    });
    applyParams(params);
    edited = true;
    presetBtns.forEach(function (b) {
      setPressed(b, false);
    });
    renderAll();
    return true;
  }

  document.getElementById("shareBtn").addEventListener("click", function () {
    var url = location.href.split("#")[0] + "#" + encode();
    history.replaceState(null, "", url);
    var done = function () {
      window.toast && window.toast("Link de tu patrón copiado. Compártelo.");
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(url).then(done, function () {
        window.toast && window.toast("Patrón guardado en la URL de esta página.");
      });
    } else {
      window.toast && window.toast("Patrón guardado en la URL de esta página.");
    }
  });

  /* ==========================================================================
     LOOP VISUAL — playhead, pulso de la página y osciloscopios
     ========================================================================== */
  var scopeCtx = scope.getContext("2d");
  var bgCtx = scopeBg ? scopeBg.getContext("2d") : null;
  var waveData = null;
  var spin = 0;
  var lastFrame = performance.now();

  /* --pulse y --spin se escriben solo en los elementos que los usan y que
     están en pantalla: escribirlos en <html> recalculaba el estilo de toda
     la página en cada frame */
  function watchTargets(selector) {
    var list = [];
    document.querySelectorAll(selector).forEach(function (el) {
      list.push({ el: el, visible: !("IntersectionObserver" in window), last: "" });
    });
    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          list.forEach(function (t) {
            if (t.el === en.target) t.visible = en.isIntersecting;
          });
        });
      });
      list.forEach(function (t) {
        io.observe(t.el);
      });
    }
    return list;
  }

  function writeVar(list, name, value) {
    for (var i = 0; i < list.length; i++) {
      var t = list[i];
      if (!t.visible || t.last === value) continue;
      t.el.style.setProperty(name, value);
      t.last = value;
    }
  }

  var pulseTargets = watchTargets(
    ".nav__bpm, .hero, .eyebrow, .machine__halo, .ticket--active, .cta-final__smiley",
  );
  var spinTargets = watchTargets(".vinyl__disc");

  function fitCanvas(c, cctx) {
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    var w = c.clientWidth;
    var h = c.clientHeight;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
    }
    cctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w: w, h: h };
  }

  function drawWave(cctx, w, h, amp, color, lineW, idleT) {
    cctx.clearRect(0, 0, w, h);
    cctx.strokeStyle = color;
    cctx.lineWidth = lineW;
    cctx.beginPath();
    var an = E.analyser();
    if (playing && an) {
      if (!waveData) waveData = new Uint8Array(an.fftSize);
      an.getByteTimeDomainData(waveData);
      var len = waveData.length;
      for (var i = 0; i < len; i += 2) {
        var x = (i / (len - 1)) * w;
        var y = h / 2 + ((waveData[i] - 128) / 128) * (h / 2) * amp;
        if (i === 0) cctx.moveTo(x, y);
        else cctx.lineTo(x, y);
      }
    } else {
      // en reposo: una onda lenta que respira
      for (var px = 0; px <= w; px += 4) {
        var yy =
          h / 2 +
          Math.sin(px * 0.012 + idleT * 1.6) * h * 0.06 * amp +
          Math.sin(px * 0.031 - idleT * 2.3) * h * 0.025 * amp;
        if (px === 0) cctx.moveTo(px, yy);
        else cctx.lineTo(px, yy);
      }
    }
    cctx.stroke();
  }

  function frame(now) {
    var dt = Math.min((now - lastFrame) / 1000, 0.1);
    lastFrame = now;
    var ctx = E.context();
    var pulse = 0;

    if (playing && ctx) {
      var t = ctx.currentTime;
      while (queue.length && queue[0].time <= t) {
        var ev = queue.shift();
        showPlayhead(ev.step);
        if (ev.step % 4 === 0) lastBeatTime = ev.time;
      }
      if (lastBeatTime >= 0) pulse = Math.exp(-(t - lastBeatTime) * 9);
      spin += dt * (E.params.tempo / 60) * 90;
    } else {
      // pulso suave en reposo al BPM del evento
      var beat = 60 / 138;
      var ph = (now / 1000) % beat;
      pulse = Math.exp(-ph * 9) * 0.35;
      spin += dt * 25;
    }

    if (!reduceMotion) {
      writeVar(pulseTargets, "--pulse", pulse.toFixed(2));
      writeVar(spinTargets, "--spin", (spin % 360).toFixed(1));
    }

    var idleT = now / 1000;
    var s = fitCanvas(scope, scopeCtx);
    drawWave(scopeCtx, s.w, s.h, 0.9, "#c6ff00", 2, idleT);

    if (bgCtx && !reduceMotion) {
      var b = fitCanvas(scopeBg, bgCtx);
      drawWave(bgCtx, b.w, b.h, playing ? 0.55 : 1.6, "rgba(198, 255, 0, 0.09)", 3, idleT * 0.5);
    }

    raf = requestAnimationFrame(frame);
  }

  var raf;

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      cancelAnimationFrame(raf);
    } else {
      lastFrame = performance.now();
      raf = requestAnimationFrame(frame);
    }
  });

  /* ---- Init ---- */
  buildGrid();
  buildKnobs();
  setKnob("volume", E.params.volume, true);
  if (!(location.hash && decode(location.hash))) loadPreset(0);

  if (reduceMotion) {
    // un solo dibujo estático de los osciloscopios
    var s0 = fitCanvas(scope, scopeCtx);
    drawWave(scopeCtx, s0.w, s0.h, 0.9, "#c6ff00", 2, 0);
    requestAnimationFrame(function loopRM(now) {
      // el playhead sigue funcionando aunque no haya animación decorativa
      var ctx = E.context();
      if (playing && ctx) {
        while (queue.length && queue[0].time <= ctx.currentTime) {
          showPlayhead(queue.shift().step);
        }
        var s1 = fitCanvas(scope, scopeCtx);
        drawWave(scopeCtx, s1.w, s1.h, 0.9, "#c6ff00", 2, 0);
      }
      requestAnimationFrame(loopRM);
    });
  } else {
    raf = requestAnimationFrame(frame);
  }
})();
