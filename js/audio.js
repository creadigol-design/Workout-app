/* ROUND ONE — tiny square-wave sound effects (WebAudio, no files). */
(function (root) {
  'use strict';
  const FW = (root.FW = root.FW || {});
  let ctx = null;
  let enabled = true;

  // iOS: play through the speaker even with the silent switch on (Safari 16.4+).
  try { if (navigator.audioSession) navigator.audioSession.type = 'playback'; } catch (e) { /* unsupported */ }

  function ac() {
    if (!ctx) {
      const AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return null;
      try { ctx = new AC(); } catch (e) { return null; }
    }
    return ctx;
  }

  /** Run fn once the context is actually running (iOS leaves it suspended/interrupted until a touch). */
  function whenRunning(fn) {
    const c = ac();
    if (!c) return;
    if (c.state === 'running') { fn(c); return; }
    const p = c.resume();
    if (p && p.then) p.then(() => { if (c.state === 'running') fn(c); }).catch(() => {});
  }

  // Home-screen apps start suspended and get interrupted after backgrounding, so re-unlock on every touch.
  function unlock() {
    const c = ac();
    if (!c) return;
    if (c.state !== 'running') c.resume().catch(() => {});
    try {
      const src = c.createBufferSource();
      src.buffer = c.createBuffer(1, 1, 22050);
      src.connect(c.destination);
      src.start(0);
    } catch (e) { /* ignore */ }
  }
  ['touchstart', 'touchend', 'pointerdown', 'click', 'keydown'].forEach((ev) => document.addEventListener(ev, unlock, { passive: true, capture: true }));
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && ctx && ctx.state !== 'running') ctx.resume().catch(() => {}); });

  function tone(freq, start, dur, type, vol) {
    whenRunning((c) => {
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = type || 'square';
      o.frequency.setValueAtTime(freq, c.currentTime + start);
      g.gain.setValueAtTime(0.0001, c.currentTime + start);
      g.gain.exponentialRampToValueAtTime(vol || 0.08, c.currentTime + start + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
      o.connect(g); g.connect(c.destination);
      o.start(c.currentTime + start);
      o.stop(c.currentTime + start + dur + 0.02);
    });
  }

  const seq = (notes, step, dur, type) => notes.forEach((n, i) => n && tone(n, i * step, dur, type));

  const SFX = {
    tap: () => tone(660, 0, 0.05),
    step: () => tone(440, 0, 0.04),
    set: () => seq([523, 784], 0.07, 0.1),
    undo: () => seq([392, 294], 0.06, 0.08),
    rest: () => seq([880, 0, 880, 0, 1175], 0.12, 0.1),
    pr: () => seq([523, 659, 784, 1047, 784, 1047], 0.08, 0.11),
    level: () => seq([392, 523, 659, 784, 1047, 1319], 0.09, 0.14),
    ko: () => { seq([784, 659, 523, 392, 262, 196], 0.12, 0.2, 'sawtooth'); },
    unlock: () => seq([659, 784, 988, 1319], 0.08, 0.12),
    coin: () => seq([988, 1319], 0.08, 0.2),
  };

  FW.sfx = (name) => { if (enabled && SFX[name]) { try { SFX[name](); } catch (e) { /* ignore */ } } };
  FW.sfxEnable = (on) => { enabled = !!on; };
})(window);
