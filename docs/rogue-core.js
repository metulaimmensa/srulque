/* Srulque roguelite: rules of one lock fight, nothing visual.
   Same contract as core.js: deterministic (seed + click ticks), 120 Hz fixed tick, clicks applied at tick start,
   no Math.random / time / trig. Base needle and sector rules come from core.js (arcade DEFAULTS).
   See FIGHT-SPEC.md for the numbers and their meaning. */
(function (root) {
  'use strict';
  const Core = (typeof module !== 'undefined' && module.exports) ? require('./core.js') : root.SrulqueCore;
  const { TICK, rng, norm, adiff } = Core;
  const B = Core.DEFAULTS;

  // every tunable number of the fight prototype in one place
  const TUNE = {
    lockTime: 30,                       // each lock has its own time
    spawnFrom: 12, firstSpawn: 0.6,     // fights skip the arcade's slow start: spawning begins as if 12 sectors had already appeared
    baseDamage: 10, blueDamage: 10,
    multStep: 0.2, multCap: 4.0,
    coolAfter: 1.5, coolRate: 0.5,      // after 1.5 s without hits the multiplier loses 0.5 per second
    missPenalty: 1.0,                   // a miss takes 1.0 off the multiplier (not below 1)
    critZone: 0.25, critMul: 1.5,       // central 25% of the sector's current width
    coinsBase: 5, coinsPerSec: 0.5,     // +1 coin per 2 s left above the target
    owner: { interval: 7, interval2: 6, warn: 1.5, snore: 3, squeezeDur: 4, squeezeWidth: 0.6, phase2Speed: 1.15 }
  };

  // the house of the prototype: front door, vault door, safe
  const HOUSE = [
    { id: 'door',  name: 'Входная дверь',   hp: 550, target: 10 },
    { id: 'vault', name: 'Дверь хранилища', hp: 1000, target: 8, life: 3.0, note: 'Тугая: сектора сужаются быстрее' },
    { id: 'safe',  name: 'Сейф',            hp: 1600, target: 5, boss: true, note: 'Хозяин ворочается во сне' }
  ];

  const RELICS = {
    whet:     { name: 'Точильный камень', text: 'Зона «Чисто!» шире: 25% → 40% сектора', price: 5 },
    blood:    { name: 'Синяя кровь',      text: 'Синие сектора бьют на 30 вместо 10', price: 6 },
    cool:     { name: 'Холодная голова',  text: 'Промах не отнимает множитель', price: 6 },
    overdrive:{ name: 'Разгон',           text: 'Стрелка быстрее на 15%, весь урон ×1,4', price: 7 },
    watch:    { name: 'Карманные часы',   text: '+5 с к каждому замку', price: 5 },
    sniper:   { name: 'Снайпер',          text: '«Чисто!» ×2,5, но обычное попадание ×0,8', price: 7 },
    glass:    { name: 'Стакан',           text: '+0,3 за попадание, но потолок ×3 и остывает вдвое быстрее', price: 5 },
    last:     { name: 'Последний шанс',   text: 'Когда осталось меньше 5 с, урон ×2', price: 4 }
  };

  function createFight(seed, lock, relics) {
    const has = id => relics.indexOf(id) >= 0;
    const R = rng(seed);
    const T = TUNE, O = T.owner;
    const life = lock.life || B.life;
    const S = {
      tick: 0, t: 0, timeLeft: T.lockTime + (has('watch') ? 5 : 0), angle: 0, dir: 1, frozen: 0,
      sectors: [], nSpawn: T.spawnFrom, nextSpawn: T.firstSpawn,
      hp: lock.hp, hpMax: lock.hp, mult: 1, lastHitT: -99, bestMult: 1,
      hits: 0, blue: 0, miss: 0, crits: 0, damage: 0,
      phase2: false, nextEvent: lock.boss ? O.interval : Infinity, eventN: 0, warn: null, squeezeUntil: -1,
      events: [],                                   // owner/phase events since the UI last read them (the UI empties it)
      over: false, won: false, clicks: []
    };
    const multCap = has('glass') ? 3.0 : T.multCap;
    const multStep = has('glass') ? 0.3 : T.multStep;
    const coolRate = T.coolRate * (has('glass') ? 2 : 1);
    const critZone = has('whet') ? 0.40 : T.critZone;
    const speed = () => B.speed * (has('overdrive') ? 1.15 : 1) * (S.phase2 ? O.phase2Speed : 1);
    const width = s => Math.max(0, s.w0 * (1 - (S.t - s.born) / life));

    function trySpawn() {
      const w0 = B.width * (S.t < S.squeezeUntil ? O.squeezeWidth : 1);
      for (let k = 0; k < 40; k++) {
        const c = R() * 360;
        if (Math.abs(adiff(c, S.angle)) < w0 / 2 + 4) continue;
        let ok = true;
        for (const s of S.sectors) if (Math.abs(adiff(c, s.c)) < (w0 + width(s)) / 2 + 0.5) { ok = false; break; }
        if (!ok) continue;
        const sec = { c, born: S.t, w0, blue: R() < B.blueChance };
        S.sectors.push(sec);
        return sec;
      }
      return null;
    }

    function click() {
      if (S.over || S.frozen > 0) return { type: 'blocked' };
      S.clicks.push(S.tick);
      for (let i = 0; i < S.sectors.length; i++) {
        const s = S.sectors[i];
        if (S.t - s.born < 0.05) continue;
        const w = width(s), off = Math.abs(adiff(S.angle, s.c));
        if (off > w / 2 + B.tol) continue;
        S.sectors.splice(i, 1);
        S.dir *= -1; S.hits++; S.lastHitT = S.t;
        const crit = off <= w * critZone / 2;
        let base = s.blue ? (has('blood') ? 30 : T.blueDamage) : T.baseDamage;
        let k = crit ? (has('sniper') ? 2.5 : T.critMul) : (has('sniper') ? 0.8 : 1);
        if (has('overdrive')) k *= 1.4;
        if (has('last') && S.timeLeft < 5) k *= 2;
        const dmg = Math.round(base * S.mult * k);
        S.hp = Math.max(0, S.hp - dmg); S.damage += dmg;
        if (crit) S.crits++;
        if (s.blue) { S.blue++; S.timeLeft += B.blueBonus; }
        S.mult = Math.min(multCap, S.mult + multStep);
        if (S.mult > S.bestMult) S.bestMult = S.mult;
        if (!S.phase2 && lock.boss && S.hp < S.hpMax / 2) { S.phase2 = true; S.events.push({ type: 'phase2' }); }
        if (S.hp <= 0) { S.over = true; S.won = true; }
        return { type: 'hit', sector: s, damage: dmg, crit, width: w };
      }
      S.frozen = B.missFreeze; S.miss++;
      if (!has('cool')) S.mult = Math.max(1, S.mult - T.missPenalty);
      return { type: 'miss' };
    }

    function step() {
      if (S.over) return;
      S.tick++; S.t = S.tick * TICK;
      S.timeLeft -= TICK;
      if (S.t - S.lastHitT > T.coolAfter && S.mult > 1) S.mult = Math.max(1, S.mult - coolRate * TICK);
      // the owner stirs in his sleep: warned 1.5 s ahead, then a snore (time) or the safe squeezing the sectors
      if (S.t >= S.nextEvent - O.warn && !S.warn) S.warn = { type: S.eventN % 2 === 0 ? 'snore' : 'squeeze', at: S.nextEvent };
      if (S.t >= S.nextEvent) {
        const type = S.eventN % 2 === 0 ? 'snore' : 'squeeze';
        if (type === 'snore') S.timeLeft -= O.snore; else S.squeezeUntil = S.t + O.squeezeDur;
        S.events.push({ type }); S.eventN++; S.warn = null;
        S.nextEvent += S.phase2 ? O.interval2 : O.interval;
      }
      if (S.timeLeft <= 0) { S.timeLeft = 0; S.over = true; S.won = false; return; }
      const ramp = Math.min(1, S.t / 0.25), k = S.frozen > 0 ? B.missSpeed : 1;
      if (S.frozen > 0) S.frozen = Math.max(0, S.frozen - TICK);
      S.angle = norm(S.angle + S.dir * speed() * ramp * k * TICK);
      while (S.t >= S.nextSpawn) {
        trySpawn();
        if (S.t > B.pairAfter - 10 && R() < B.pairChance) trySpawn();
        S.nSpawn++;
        S.nextSpawn += Math.max(B.intFloor, B.intStart - B.intStep * S.nSpawn);
      }
      S.sectors = S.sectors.filter(s => width(s) > 0.3);
    }

    return { S, click, step, width, critZone, lock };
  }

  // coins after a won lock: 5 + 1 per 2 s left above the lock's target
  function coinsFor(lock, timeLeft) { return TUNE.coinsBase + Math.floor(Math.max(0, timeLeft - lock.target) * TUNE.coinsPerSec); }

  const api = { TUNE, HOUSE, RELICS, createFight, coinsFor, VERSION: 0 };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SrulqueRogue = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
