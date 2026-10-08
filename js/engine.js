/* ==========================================================================
   MOTOR DE AUDIO — voz 303 + batería, sintetizado con Web Audio API
   Sin samples: todo se genera en vivo.

   Voz ácida (monofónica, oscilador persistente):
   osc (saw/square) → filtro lowpass resonante → VCA → saturación → duck → bus
   ========================================================================== */
window.AcidEngine = (function () {
  var ctx = null;
  var out, analyser, bassDuck, drumBus;
  var osc, filter, amp, shaper;
  var noiseBuffer;
  var held = false; // la nota anterior quedó sostenida por un slide

  var params = {
    tempo: 138,
    cutoff: 0.32,
    reso: 0.72,
    envMod: 0.62,
    decay: 0.42,
    drive: 0.35,
    volume: 0.8,
    wave: "sawtooth",
  };

  function midiToFreq(m) {
    return 440 * Math.pow(2, (m - 69) / 12);
  }

  // mapeo exponencial de 0..1 a 80 Hz .. ~10 kHz
  function baseCutoff() {
    return 80 * Math.pow(2, params.cutoff * 7);
  }

  function resoQ() {
    return 1 + params.reso * 26;
  }

  function driveCurve(amount) {
    var k = amount * 60;
    var n = 2048;
    var curve = new Float32Array(n);
    for (var i = 0; i < n; i++) {
      var x = (i * 2) / n - 1;
      curve[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
    }
    return curve;
  }

  function init() {
    if (ctx) return ctx;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();

    out = ctx.createGain();
    out.gain.value = params.volume;

    var comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    comp.attack.value = 0.003;
    comp.release.value = 0.2;

    analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;

    out.connect(comp);
    comp.connect(analyser);
    analyser.connect(ctx.destination);

    // ---- voz 303 ----
    osc = ctx.createOscillator();
    osc.type = params.wave;
    osc.frequency.value = 55;

    filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = baseCutoff();
    filter.Q.value = resoQ();

    amp = ctx.createGain();
    amp.gain.value = 0;

    shaper = ctx.createWaveShaper();
    shaper.curve = driveCurve(params.drive);
    shaper.oversample = "4x";

    bassDuck = ctx.createGain();
    bassDuck.gain.value = 0.5;

    osc.connect(filter);
    filter.connect(amp);
    amp.connect(shaper);
    shaper.connect(bassDuck);
    bassDuck.connect(out);
    osc.start();

    // ---- batería ----
    drumBus = ctx.createGain();
    drumBus.gain.value = 0.9;
    drumBus.connect(out);

    noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    var data = noiseBuffer.getChannelData(0);
    for (var i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

    return ctx;
  }

  /* ---- Nota ácida ----
     glideIn: la nota anterior tenía slide y sigue sonando → no se re-dispara
     holdThrough: esta nota tiene slide hacia una nota siguiente → no se suelta */
  function note(t, midi, accent, glideIn, holdThrough, stepDur) {
    var f = midiToFreq(midi);
    var level = accent ? 0.95 : 0.6;
    var base = baseCutoff();

    osc.frequency.cancelScheduledValues(t);
    amp.gain.cancelScheduledValues(t);

    if (glideIn) {
      osc.frequency.setTargetAtTime(f, t, 0.035);
      amp.gain.setTargetAtTime(level, t, 0.01);
    } else {
      osc.frequency.setValueAtTime(f, t);
      amp.gain.setTargetAtTime(level, t, 0.002);

      // envolvente de filtro: el "squelch"
      var peak = Math.min(
        base * (1 + params.envMod * (accent ? 14 : 7)),
        16000,
      );
      var decay = (0.06 + params.decay * 0.8) * (accent ? 0.7 : 1);
      filter.frequency.cancelScheduledValues(t);
      filter.frequency.setValueAtTime(peak, t);
      filter.frequency.setTargetAtTime(base, t + 0.003, decay / 3);
      filter.Q.setValueAtTime(resoQ() + (accent ? 4 : 0), t);
    }

    if (!holdThrough) {
      amp.gain.setTargetAtTime(0, t + stepDur * 0.6, 0.012);
    }
    held = holdThrough;
  }

  function kick(t) {
    var o = ctx.createOscillator();
    var g = ctx.createGain();
    o.frequency.setValueAtTime(165, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.11);
    g.gain.setValueAtTime(1.1, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.42);
    o.connect(g);
    g.connect(drumBus);
    o.start(t);
    o.stop(t + 0.45);

    // sidechain: el bajo se agacha con cada kick
    bassDuck.gain.cancelScheduledValues(t);
    bassDuck.gain.setValueAtTime(0.18, t);
    bassDuck.gain.setTargetAtTime(0.5, t + 0.02, 0.07);
  }

  function noiseHit(t, type, freq, q, gain, length) {
    var src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    var f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    var g = ctx.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + length);
    src.connect(f);
    f.connect(g);
    g.connect(drumBus);
    src.start(t);
    src.stop(t + length + 0.02);
  }

  function hat(t, open) {
    noiseHit(t, "highpass", 7500, 0.8, open ? 0.32 : 0.22, open ? 0.14 : 0.045);
  }

  function clap(t) {
    noiseHit(t, "bandpass", 1300, 1.2, 0.5, 0.02);
    noiseHit(t + 0.011, "bandpass", 1300, 1.2, 0.45, 0.02);
    noiseHit(t + 0.023, "bandpass", 1200, 1.1, 0.55, 0.19);
  }

  function release() {
    if (!ctx) return;
    var t = ctx.currentTime;
    amp.gain.cancelScheduledValues(t);
    amp.gain.setTargetAtTime(0, t, 0.015);
    held = false;
  }

  function preview(midi) {
    if (!init()) return;
    ctx.resume();
    note(ctx.currentTime + 0.01, midi, false, false, false, 0.18);
  }

  function setParam(key, value) {
    params[key] = value;
    if (!ctx) return;
    var t = ctx.currentTime;
    switch (key) {
      case "volume":
        out.gain.setTargetAtTime(value, t, 0.03);
        break;
      case "wave":
        osc.type = value;
        break;
      case "drive":
        shaper.curve = driveCurve(value);
        break;
      case "cutoff":
        filter.frequency.cancelScheduledValues(t);
        filter.frequency.setTargetAtTime(baseCutoff(), t, 0.03);
        break;
      case "reso":
        filter.Q.setTargetAtTime(resoQ(), t, 0.03);
        break;
    }
  }

  return {
    params: params,
    init: init,
    note: note,
    kick: kick,
    hat: hat,
    clap: clap,
    release: release,
    preview: preview,
    setParam: setParam,
    isHeld: function () {
      return held;
    },
    context: function () {
      return ctx;
    },
    analyser: function () {
      return analyser;
    },
  };
})();
