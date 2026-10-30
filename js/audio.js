'use strict';
/* All sound is synthesised with WebAudio: no audio files. */
const Snd = (() => {
  let ac = null, master, sfx, mus, noiseBuf, timer = null;
  let vol = { sfx: 0.7, mus: 0.5 };
  let intensity = 0, nextT = 0, step = 0;
  const last = {};

  function init() {
    if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    ac = new AC();
    master = ac.createGain(); master.gain.value = 0.7;
    const comp = ac.createDynamicsCompressor();
    comp.threshold.value = -16; comp.ratio.value = 5;
    master.connect(comp); comp.connect(ac.destination);
    sfx = ac.createGain(); sfx.gain.value = vol.sfx; sfx.connect(master);
    mus = ac.createGain(); mus.gain.value = vol.mus * 0.55; mus.connect(master);
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    nextT = ac.currentTime + 0.1;
    timer = setInterval(schedule, 25);
  }

  function ok(name, ms) {
    const t = performance.now();
    if (last[name] && t - last[name] < ms) return false;
    last[name] = t; return true;
  }

  function tone(type, f0, f1, dur, v, delay = 0, dest = sfx) {
    if (!ac || !Number.isFinite(f0) || !Number.isFinite(delay)) return;
    const t = ac.currentTime + delay;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f0, t);
    if (f1) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + 0.006);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(dest); o.start(t); o.stop(t + dur + 0.05);
  }

  function noise(dur, v, freq, delay = 0, ftype = 'lowpass', dest = sfx, fEnd = 0) {
    if (!ac) return;
    const t = ac.currentTime + delay;
    const s = ac.createBufferSource(); s.buffer = noiseBuf;
    const f = ac.createBiquadFilter(); f.type = ftype; f.frequency.setValueAtTime(freq, t);
    if (fEnd) f.frequency.exponentialRampToValueAtTime(fEnd, t + dur);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(dest);
    s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.05);
  }

  const SFX = {
    shoot() { if (ok('shoot', 70)) tone('square', 760, 300, 0.07, 0.035); },
    hit() { if (ok('hit', 40)) noise(0.05, 0.09, 2600, 0, 'bandpass'); },
    kill() { if (ok('kill', 45)) { tone('square', 260, 70, 0.09, 0.045); noise(0.06, 0.05, 1200); } },
    gem(p = 0) { if (ok('gem', 28)) tone('sine', 880 * Math.pow(2, Math.min(p || 0, 24) / 24), 0, 0.08, 0.07); },
    hurt() { if (ok('hurt', 120)) { tone('sawtooth', 220, 55, 0.25, 0.16); noise(0.2, 0.18, 700); } },
    slash() { if (ok('slash', 60)) noise(0.12, 0.12, 5000, 0, 'bandpass', sfx, 900); },
    zap() { if (ok('zap', 60)) { noise(0.12, 0.1, 6000, 0, 'highpass'); tone('sawtooth', 1400, 180, 0.12, 0.04); } },
    nova() { if (ok('nova', 80)) { tone('sine', 300, 900, 0.25, 0.08); noise(0.25, 0.06, 3000, 0, 'bandpass', sfx, 400); } },
    frost() { if (ok('frost', 80)) { tone('triangle', 1800, 2400, 0.08, 0.04); tone('triangle', 2400, 3000, 0.08, 0.03, 0.04); } },
    glass() { if (ok('glass', 70)) { noise(0.15, 0.08, 4000, 0, 'highpass'); tone('sine', 300, 120, 0.15, 0.06); } },
    boom() { if (ok('boom', 70)) { noise(0.45, 0.3, 900, 0, 'lowpass', sfx, 80); tone('sine', 110, 35, 0.4, 0.3); } },
    bigboom() { noise(1.2, 0.5, 1200, 0, 'lowpass', sfx, 40); tone('sine', 90, 25, 1.2, 0.5); tone('square', 180, 30, 0.8, 0.1); },
    pickup() { tone('square', 523, 0, 0.06, 0.06); tone('square', 784, 0, 0.08, 0.06, 0.06); },
    heal() { [523, 659, 784].forEach((f, i) => tone('triangle', f, 0, 0.12, 0.08, i * 0.05)); },
    coin() { if (ok('coin', 40)) { tone('square', 988, 0, 0.05, 0.05); tone('square', 1319, 0, 0.12, 0.05, 0.05); } },
    levelup() { [523, 659, 784, 1047, 1319].forEach((f, i) => tone('square', f, 0, 0.14, 0.07, i * 0.06)); noise(0.6, 0.05, 6000, 0.1, 'highpass'); },
    select() { tone('square', 660, 990, 0.06, 0.06); },
    hover() { if (ok('hover', 50)) tone('square', 1200, 0, 0.025, 0.025); },
    chest() { [392, 523, 659, 784, 1047].forEach((f, i) => tone('triangle', f, 0, 0.25, 0.09, i * 0.09)); },
    evolve() { [262, 330, 392, 523, 659, 784, 1047, 1319].forEach((f, i) => tone('square', f, 0, 0.3, 0.07, i * 0.07)); noise(1, 0.08, 8000, 0.3, 'highpass'); },
    warn() { for (let i = 0; i < 3; i++) { tone('sawtooth', 440, 330, 0.35, 0.12, i * 0.45); tone('sawtooth', 445, 334, 0.35, 0.1, i * 0.45); } },
    dash() { noise(0.3, 0.15, 400, 0, 'lowpass', sfx, 2000); },
    bullet() { if (ok('bullet', 90)) tone('square', 300, 600, 0.06, 0.03); },
    death() { tone('sawtooth', 300, 40, 1.4, 0.2); noise(1.2, 0.2, 600, 0, 'lowpass', sfx, 60); },
    tick() { if (ok('tick', 55)) tone('square', 1500 + Math.random() * 300, 0, 0.02, 0.03); },
    reel() { tone('square', 240, 110, 0.12, 0.09); noise(0.08, 0.1, 1500); },
    fizzle() { tone('triangle', 420, 140, 0.4, 0.08); },
    curse() { tone('sawtooth', 300, 60, 0.9, 0.15); tone('sawtooth', 311, 62, 0.9, 0.12); noise(0.8, 0.12, 500, 0, 'lowpass', sfx, 80); },
    jackpot() { [523, 659, 784, 1047, 784, 1047, 1319, 1568, 2093].forEach((f, i) => tone('square', f, 0, 0.18, 0.07, i * 0.07)); noise(1.2, 0.1, 9000, 0.2, 'highpass'); },
    buff() { [392, 523, 784, 1047].forEach((f, i) => tone('sine', f, 0, 0.18, 0.09, i * 0.05)); },
    shrine() { tone('sine', 220, 0, 1.4, 0.08); tone('sine', 330, 0, 1.4, 0.06, 0.12); tone('sine', 494, 0, 1.4, 0.05, 0.24); },
    meteor() { if (ok('meteor', 90)) noise(0.3, 0.08, 3000, 0, 'bandpass', sfx, 400); },
    win() { [523, 659, 784, 1047, 784, 1047, 1319, 1568].forEach((f, i) => tone('square', f, 0, 0.3, 0.07, i * 0.12)); },
  };

  /* ---------- Music: Am - F - G - Em, intensity 0 (menu) / 1 (run) / 2 (boss) ---------- */
  const BPM = 124, STEP = 60 / BPM / 4;
  const PROG = [[45, 57, 60, 64], [41, 53, 57, 60], [43, 55, 59, 62], [40, 52, 55, 59]];
  const LEAD = [76, 0, 74, 72, 0, 71, 72, 0, 69, 0, 0, 67, 69, 0, 71, 0];
  const mtof = m => 440 * Math.pow(2, (m - 69) / 12);

  function bass(f, d, dur) {
    const t = ac.currentTime + d;
    const o = ac.createOscillator(), fl = ac.createBiquadFilter(), g = ac.createGain();
    o.type = 'sawtooth'; o.frequency.value = f;
    fl.type = 'lowpass'; fl.frequency.setValueAtTime(900, t); fl.frequency.exponentialRampToValueAtTime(160, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.linearRampToValueAtTime(0.16, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(fl); fl.connect(g); g.connect(mus); o.start(t); o.stop(t + dur + 0.05);
  }

  function schedule() {
    if (!ac || ac.state !== 'running') return;
    if (nextT < ac.currentTime - 0.2) nextT = ac.currentTime + 0.05;
    while (nextT < ac.currentTime + 0.12) {
      const d = Math.max(0, nextT - ac.currentTime);
      const bar = Math.floor(step / 16) % 4, s = step % 16, ch = PROG[bar];
      if (intensity === 0) {
        if (s === 0) bass(mtof(ch[0]), d, STEP * 14);
        if (s % 2 === 0) tone('triangle', mtof(ch[1 + (s / 2) % 3] + 12), 0, STEP * 3, 0.03, d, mus);
      } else {
        const boss = intensity >= 2;
        if ([0, 3, 6, 8, 10, 11, 14].includes(s)) bass(mtof(ch[0] + (boss && s % 2 ? 12 : 0)), d, STEP * 1.6);
        tone('square', mtof(ch[1 + (s % 3)] + ((s >> 2) % 2 ? 12 : 0) + (boss ? 12 : 0)), 0, STEP * 0.8, 0.022, d, mus);
        if (s % (boss ? 4 : 8) === 0) tone('sine', 150, 40, 0.18, 0.45, d, mus);
        if (s % 4 === 2) noise(0.03, 0.06, 7000, d, 'highpass', mus);
        if (s === 4 || s === 12) noise(0.12, boss ? 0.16 : 0.1, 1800, d, 'bandpass', mus);
        if (boss && LEAD[s] && bar % 2 === 1) tone('sawtooth', mtof(LEAD[s] - 12), 0, STEP * 1.8, 0.03, d, mus);
      }
      nextT += STEP; step++;
    }
  }

  return {
    init,
    play(name, p) { if (ac && SFX[name]) SFX[name](p); },
    music(level) { intensity = level; },
    setVol(kind, v) {
      vol[kind] = v;
      if (!ac) return;
      if (kind === 'sfx') sfx.gain.value = v; else mus.gain.value = v * 0.55;
    },
    get vol() { return vol; },
  };
})();
