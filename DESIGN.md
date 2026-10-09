# Srulque: roguelite mode — design notes

Status: agreed in discussion with the owner on 2026-10-09. Nothing is built yet. Pencil items are marked **[карандаш]**.
The current arcade mode (pure rules, world leaderboard) stays as it is; everything below is a separate mode.

## Lore
- A crew of thieves travelling across worlds of the multiverse and stealing all sorts of weird things.
- Every world is a setting, and our skins become worlds: neon city, steam works, later a panel block with a gopnik boss, etc.
- The boss is the guard of the lock. He sensed something was wrong and is running in to catch the thief. He is drawn next to the lock.

## Core loop
- **No HP. Time is health.** Time runs out, the fight is lost and the run ends.
- **Damage = hits × multiplier.** The multiplier grows from combos: a colour sequence, a streak without misses, edge hits.
- A boss has HP and its own skillset. It attacks the player's time and the field:
  - takes away seconds;
  - speeds up the needle;
  - narrows sectors;
  - plants trap sectors.

## Five systems (all approved)
1. **Heir traits.** Each run is a new thief from the clan, picked from a few candidates. 1–2 traits each, shown in a funny way. Examples:
   - Левша: needle goes the other way, or the field turns upside down during play **[карандаш: думать]**.
   - Глазомер: +tolerance.
   - Тремор: needle jitters, more damage.
   - Нетерпеливый: faster needle, +time per hit.
   - Шумный: every miss costs a second.
   - Дальтоник: bonus sectors are not highlighted.
2. **Relics (jokers).** Each one bends a rule, and they stack into builds. Bought with money between fights, Balatro-style.
3. **Skills.**
   - They do not live in a button. After an on-board condition is met (colour sequence, high multiplier, N hits without a miss, surviving at 1 s…), a skill sector appears on the circle and has to be hit. Both attacking and defensive skills.
   - Skills are tied to bosses: meeting the boss's condition during its fight guarantees the unlock.
   - There are 2–3 common skills shared by several bosses, plus rare unique ones.
   - Skills are upgraded between bosses, together with relics.
4. **Consumables.** Used from the pocket at any time, 2–3 slots, weak, no overpowered ones. Examples:
   - +2 s;
   - next 3 sectors wider;
   - slow needle for 3 s;
   - show where the next sector appears.
5. **Boss skillsets.** Each boss has its own attacks, its own skill-unlock condition and its own look.

## Meta progression (between runs)
- Only goes wider, never higher:
  - more relics in the pool;
  - new traits;
  - more consumables;
  - new skills.
- No permanent "+X% damage".

## Run structure [карандаш]
- One world per boss: 3–5 fights, then the boss.
- Between fights, relics sell very cheap, but new ones can be bought.
- Between bosses, relics sell back at ~75% of the price, so the build can be reworked.
- The world is finite and counts as cleared at boss X. Score grows geometrically; this is a balance question.
- The run concept (what the run is, why, where, how worlds connect) is for the owner to invent.

## Open questions
- Currency: where money comes from, e.g. overkill damage, speed, leftover time.
- Saving mid-run (phones close apps).
- Leaderboard for the roguelite: deepest world / boss reached, a daily seeded run, or none.
- Which skins stay pure paid cosmetics vs. which are worlds.
- How Левша "upside down" reads at 128°/s.

## Build order (agreed)
1. Fight: time as health, damage × multiplier, a boss with 1–2 attacks.
2. Relics between fights.
3. Skill sectors.
4. Consumables.
5. Heirs and meta progression.
