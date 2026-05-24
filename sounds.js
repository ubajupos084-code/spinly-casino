// ============================================================
// Sounds — Web Audio API synth (no external files).
// Pleasant, low-volume effects. Toggleable via header button.
// ============================================================

window.SFX = (() => {
  let ctx = null;
  let masterGain = null;
  const MUTE_KEY = "sp_muted";

  function ensure() {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) { console.warn("[SFX] No AudioContext available"); return; }
      ctx = new AC();
      masterGain = ctx.createGain();
      masterGain.gain.value = 0.55;
      masterGain.connect(ctx.destination);
    }
    // Browsers suspend AudioContext until a user gesture. Always try to resume.
    if (ctx.state === "suspended" && ctx.resume) {
      ctx.resume().catch(() => {});
    }
  }

  function isMuted() {
    return localStorage.getItem(MUTE_KEY) === "1";
  }
  function setMuted(v) {
    localStorage.setItem(MUTE_KEY, v ? "1" : "0");
  }
  function toggleMute() {
    const next = !isMuted();
    setMuted(next);
    return next;
  }

  function tone({ freq = 440, type = "sine", dur = 0.12, vol = 1, slideTo = null, delay = 0 } = {}) {
    if (isMuted()) return;
    ensure();
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo != null) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g);
    g.connect(masterGain);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise({ dur = 0.2, vol = 0.5, filterFreq = 1200, delay = 0 } = {}) {
    if (isMuted()) return;
    ensure();
    if (!ctx) return;
    const t = ctx.currentTime + delay;
    const bufferSize = ctx.sampleRate * dur;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1);
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = filterFreq;
    const g = ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(filter); filter.connect(g); g.connect(masterGain);
    src.start(t);
    src.stop(t + dur + 0.02);
  }

  // Public API
  return {
    isMuted, setMuted, toggleMute,

    click()  { tone({ freq: 1200, type: "triangle", dur: 0.04, vol: 0.25 }); },
    hover()  { tone({ freq: 1600, type: "sine",     dur: 0.02, vol: 0.08 }); },

    gem(level = 1) {
      // Ascending pleasant arpeggio that gets higher each gem
      const base = 520 + Math.min(level, 18) * 35;
      tone({ freq: base,        type: "sine",     dur: 0.10, vol: 0.5 });
      tone({ freq: base * 1.25, type: "sine",     dur: 0.12, vol: 0.4, delay: 0.06 });
    },

    bomb() {
      tone({ freq: 220, type: "sawtooth", dur: 0.25, vol: 0.6, slideTo: 60 });
      noise({ dur: 0.35, vol: 0.4, filterFreq: 600, delay: 0.02 });
    },

    win(big = false) {
      // C - E - G major chord arpeggio
      const notes = [523.25, 659.25, 783.99, 1046.5];
      notes.forEach((f, i) => tone({ freq: f, type: "triangle", dur: big ? 0.35 : 0.22, vol: 0.5, delay: i * 0.08 }));
      if (big) tone({ freq: 1318.5, type: "triangle", dur: 0.45, vol: 0.5, delay: 0.34 });
    },

    lose() {
      tone({ freq: 400, type: "sine", dur: 0.35, vol: 0.4, slideTo: 180 });
    },

    spinStart() {
      noise({ dur: 0.45, vol: 0.25, filterFreq: 2200 });
    },
    spinTick() {
      tone({ freq: 380, type: "square", dur: 0.03, vol: 0.15 });
    },
    reelStop() {
      tone({ freq: 180, type: "triangle", dur: 0.10, vol: 0.4, slideTo: 90 });
    },

    rollTick() {
      tone({ freq: 600 + Math.random() * 400, type: "triangle", dur: 0.03, vol: 0.15 });
    },
    rollStop() {
      tone({ freq: 300, type: "triangle", dur: 0.08, vol: 0.35, slideTo: 150 });
    },

    whoosh() {
      if (isMuted()) return;
      ensure();
      if (!ctx) return;
      const t = ctx.currentTime;
      const dur = 0.18;
      const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * dur), ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.Q.value = 4;
      filter.frequency.setValueAtTime(400, t);
      filter.frequency.exponentialRampToValueAtTime(2800, t + dur);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.35, t + 0.025);
      g.gain.exponentialRampToValueAtTime(0.001, t + dur);
      src.connect(filter); filter.connect(g); g.connect(masterGain);
      src.start(t);
      src.stop(t + dur + 0.02);
    },
  };
})();

// Wake up audio context on first user interaction (browser policy)
document.addEventListener("click", function _wake() {
  if (window.SFX) window.SFX.click();
}, { once: true });
document.addEventListener("keydown", function _wakeKey() {
  if (window.SFX) window.SFX.click();
}, { once: true });
