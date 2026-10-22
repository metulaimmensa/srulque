/* Balance check for the roguelite fight: a human-like bot plays thousands of houses.
   node tools/rogue-sim.js [sigma=4.5] [n=2000]
   The bot aims at the centre of each sector with a normal error of sigma degrees and ignores sectors younger than 0.3 s. */
const Core = require('../docs/core.js'), Rg = require('../docs/rogue-core.js');
const sigma = +(process.argv[2] || 4.5), N = +(process.argv[3] || 2000), react = +(process.argv[4] || 0.3);
if (process.env.HP) process.env.HP.split(',').forEach((v, i) => Rg.HOUSE[i].hp = +v);
function gauss(r) { let u = 0, v = 0; while (!u) u = r(); v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
function playLock(seed, lock, relics, botSeed) {
  const f = Rg.createFight(seed, lock, relics), S = f.S, r = Core.rng(botSeed);
  const aim = new Map(); let prev = new Map();
  while (!S.over) {
    let fire = false;
    for (const s of S.sectors) {
      if (!aim.has(s)) aim.set(s, gauss(r) * sigma);
      if (S.t - s.born < react || S.frozen > 0) continue;
      const d = Core.adiff(S.angle, s.c + aim.get(s)), p = prev.get(s);
      if (p !== undefined && Math.sign(p) !== Math.sign(d) && Math.abs(d) < 6) fire = true;
      prev.set(s, d);
    }
    if (fire) f.click();
    f.step();
  }
  return { won: S.won, left: S.timeLeft, coins: S.won ? Rg.coinsFor(lock, S.timeLeft) : 0, hp: S.hp, dmg: S.damage, t: S.t, hits: S.hits, miss: S.miss, crits: S.crits };
}
function house(relics) {
  const st = Rg.HOUSE.map(() => ({ won: 0, left: 0, coins: 0, t: 0, dmg: 0, n: 0, hits: 0, miss: 0, crits: 0 }));
  let full = 0;
  for (let i = 0; i < N; i++) {
    let alive = true;
    Rg.HOUSE.forEach((lock, j) => {
      const r = playLock(1000 + i * 7 + j, lock, relics, 99991 + i * 13 + j);   // every lock is played, so each gets N samples
      const x = st[j]; x.n++; x.t += r.t; x.dmg += r.dmg; x.hits += r.hits; x.miss += r.miss; x.crits += r.crits;
      if (r.won) { x.won++; x.left += r.left; x.coins += r.coins } else alive = false;
    });
    if (alive) full++;
  }
  return { st, full: full / N };
}
const configs = process.env.QUICK ? [[], ['whet', 'sniper'], ['overdrive', 'glass'], ['blood', 'watch']] : [[], ...Object.keys(Rg.RELICS).map(k => [k]), ['whet', 'sniper'], ['overdrive', 'glass'], ['blood', 'watch'], ['cool', 'overdrive'], ['watch', 'last']];
console.log(`sigma ${sigma}°, react ${react}s, hp ${Rg.HOUSE.map(l=>l.hp)}, ${N} houses per row. Columns per lock: win% | avg time left on win | avg coins | hit/s | crit%`);
for (const c of configs) {
  const { st, full } = house(c);
  const row = st.map((x, j) => `${Rg.HOUSE[j].id.padEnd(5)} ${(100 * x.won / x.n).toFixed(0).padStart(3)}% ${(x.won ? x.left / x.won : 0).toFixed(1).padStart(4)}s ${(x.won ? x.coins / x.won : 0).toFixed(1).padStart(4)}c ${(x.hits / x.t).toFixed(2)}h/s ${(100 * x.crits / Math.max(1, x.hits)).toFixed(0)}%`).join(' | ');
  console.log((c.join('+') || 'none').padEnd(16), 'house', (100 * full).toFixed(0).padStart(3) + '%', '|', row);
}
