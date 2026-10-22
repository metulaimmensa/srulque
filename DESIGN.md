# Srulque: roguelite mode — design notes

Status: agreed in discussion with the owner on 2026-10-09. Nothing is built yet. Pencil items are marked **[карандаш]**.
The current arcade mode (pure rules, world leaderboard) stays as it is; everything below is a separate mode.

## Lore
- A crew of thieves travelling across worlds of the multiverse and stealing all sorts of weird things.
- Every world is a setting, and our skins become worlds: neon city, steam works, later a panel block with a gopnik boss, etc.
- **Every level is one character's house** (2026-10-22): break the front door, then the vault door, then the safe. The safe is the boss fight, the thing you came for.
- **The boss is the owner and he is asleep.** The timer is a bar until he wakes up; he stirs, snores and mutters while you work. The owner's skillset is his sleep behaviour plus the house's defences (alarms, dogs, safe mechanisms). The running-guard idea is dropped.

## Core loop
- **No HP. Time is health.** Time runs out, the owner wakes up and the run ends.
- **Each lock has its own base time (30 s),** so a bad first door does not drag the whole house down.
- **Time target per lock/boss** (set by lore, later modified by skills). Time left above the target pays extra currency and perks.
- **Damage = hits × multiplier.** The multiplier grows from combos: a colour sequence, a streak without misses, edge hits.
  - It cools down by itself after ~1–1.5 s without hits.
  - A miss takes away part of it, not all of it.
- A boss has HP and its own skillset. The sleeping owner and his house attack the player's time and the field:
  - takes away seconds (he almost wakes up);
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
   - **Wanted later: many more builds, including a couple of absurd, counter-intuitive ones that win "from the opposite".** Like Balatro's one-card-plus-discards builds or Hearthstone fatigue decks: value out of nothing. Seed ideas, nothing decided:
     - misses feed the multiplier instead of draining it;
     - damage grows the closer the owner is to waking up;
     - waiting builds damage (the multiplier is the time since the last hit);
     - only blue sectors count, but for a lot.
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
- Heir trait «Шумный» fits the sleeping owner perfectly: noise (misses) makes him wake up faster.
- Leaderboard for the roguelite: deepest world / boss reached, a daily seeded run, or none.
- Which skins stay pure paid cosmetics vs. which are worlds.
- How Левша "upside down" reads at 128°/s.

## Build order (agreed)
1. Fight: time as health, damage × multiplier, a boss with 1–2 attacks.
2. Relics between fights.
3. Skill sectors.
4. Consumables.
5. Heirs and meta progression.
