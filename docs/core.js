/* Srulque game core — the whole rule set, nothing visual.
   Deterministic: same seed + same click ticks => same result in any JS engine
   (only + − × ÷, comparisons and Math.imul; no time, no Math.random, no trig).
   The browser game and the leaderboard server both run this exact file. */
(function (root) {
  'use strict';
  const TICK_HZ = 120, TICK = 1 / TICK_HZ;
  const MAX_TICKS = TICK_HZ * 60 * 30;        // hard stop: 30 minutes of game time

  // measured from the original minigame (tol raised from 1° to 2° by the owner); leaderboard games must use exactly these
  const DEFAULTS = Object.freeze({
    speed: 128, width: 22.5, life: 3.6, blueChance: 0.25, blueBonus: 1.5,
    missFreeze: 0.667, missSpeed: 0.1, startTime: 30, firstSpawn: 1.25,
    intStart: 1.40, intStep: 0.026, intFloor: 0.45, pairChance: 0.13, pairAfter: 35, tol: 2.0
  });

  // mulberry32: tiny, fast, identical everywhere
  function rng(seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const norm = a => ((a % 360) + 360) % 360;
  const adiff = (a, b) => { const d = norm(a - b); return d > 180 ? d - 360 : d; };
  const sameParams = P => Object.keys(DEFAULTS).every(k => P[k] === DEFAULTS[k]);

  function createSim(seed, params) {
    const P = Object.assign({}, DEFAULTS, params || {});
    const R = rng(seed);
    const S = {
      tick: 0, t: 0, timeLeft: P.startTime, angle: 0, dir: 1, frozen: 0,
      sectors: [], nSpawn: 0, nextSpawn: P.firstSpawn,
      score: 0, hits: 0, blue: 0, miss: 0, over: false,
      clicks: []                                  // ticks of every accepted click (hit or miss)
    };
    const width = s => Math.max(0, P.width * (1 - (S.t - s.born) / P.life));

    function trySpawn() {
      for (let k = 0; k < 40; k++) {
        const c = R() * 360, w = P.width;
        if (Math.abs(adiff(c, S.angle)) < w / 2 + 4) continue;
        let ok = true;
        for (const s of S.sectors) if (Math.abs(adiff(c, s.c)) < (w + width(s)) / 2 + 0.5) { ok = false; break; }
        if (!ok) continue;
        const sec = { c, born: S.t, blue: R() < P.blueChance };
        S.sectors.push(sec);
        return sec;
      }
      return null;
    }

    // apply a click at the current tick; returns what happened
    function click() {
      if (S.over || S.frozen > 0) return { type: 'blocked' };
      S.clicks.push(S.tick);
      for (let i = 0; i < S.sectors.length; i++) {
        const s = S.sectors[i];
        if (S.t - s.born < 0.05) continue;
        const w = width(s);
        if (Math.abs(adiff(S.angle, s.c)) <= w / 2 + P.tol) {
          S.sectors.splice(i, 1);
          S.score += 1000; S.hits++; S.dir *= -1;
          if (s.blue) S.blue++;
          S.timeLeft = P.startTime + P.blueBonus * S.blue - S.t;
          return { type: 'hit', sector: s, width: w };
        }
      }
      S.frozen = P.missFreeze; S.miss++;
      return { type: 'miss' };
    }

    // advance one fixed tick
    function step() {
      if (S.over) return;
      S.tick++;
      S.t = S.tick * TICK;
      S.timeLeft = P.startTime + P.blueBonus * S.blue - S.t;
      if (S.timeLeft <= 0 || S.tick >= MAX_TICKS) { S.timeLeft = 0; S.over = true; return; }
      const ramp = Math.min(1, S.t / 0.25), k = S.frozen > 0 ? P.missSpeed : 1;
      if (S.frozen > 0) S.frozen = Math.max(0, S.frozen - TICK);
      S.angle = norm(S.angle + S.dir * P.speed * ramp * k * TICK);
      while (S.t >= S.nextSpawn) {
        trySpawn();
        if (S.t > P.pairAfter && R() < P.pairChance) trySpawn();
        S.nSpawn++;
        S.nextSpawn += Math.max(P.intFloor, P.intStart - P.intStep * S.nSpawn);
      }
      S.sectors = S.sectors.filter(s => width(s) > 0.3);
    }

    return { S, P, click, step, width };
  }

  // server side: re-run a whole game from seed + click ticks
  function replay(seed, clicks, params) {
    const sim = createSim(seed, params);
    let i = 0, last = -1;
    for (const c of clicks) { if (!Number.isInteger(c) || c < last) return { valid: false, reason: 'bad clicks' }; last = c; }
    while (!sim.S.over) {
      while (i < clicks.length && clicks[i] === sim.S.tick) {
        const r = sim.click();
        if (r.type === 'blocked') return { valid: false, reason: 'click during penalty' };
        i++;
      }
      if (i < clicks.length && clicks[i] < sim.S.tick) return { valid: false, reason: 'click order' };
      sim.step();
    }
    if (i !== clicks.length) return { valid: false, reason: 'clicks after end' };
    const S = sim.S;
    return { valid: true, score: S.score, hits: S.hits, blue: S.blue, miss: S.miss, ticks: S.tick, seconds: S.tick * TICK };
  }

  const api = { TICK, TICK_HZ, DEFAULTS, rng, norm, adiff, createSim, replay, sameParams, VERSION: 1 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SrulqueCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
