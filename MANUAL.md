# 🚀 Meteor Dash — Complete Project Manual

> **What this document is:** the deep reference for Meteor Dash — every system, the numbers behind it, and the *why* behind every design decision. The README is the 60-second highlights; this is the full story. If you are tuning gameplay, adding a feature, or debugging a system, this is the file that tells you how the pieces fit and why they were built that way.

---

## Part 1 — The game

### 1.1 What Meteor Dash is

Meteor Dash is a **hand-gesture space arcade** built for the browser. You fly a rocket through procedurally themed asteroid belts using nothing but your hands and a webcam — no controller, no keyboard, no touch. The camera watches your hands via **MediaPipe hand tracking**, and the game translates them into steering, dashing, shielding, and shooting.

**Design philosophy, in one sentence:** *dodging is the game.* Shooting exists, but it is deliberately scarce and earned — you cannot shoot your way clear. Every system (the gesture meter, the 3-bolt magazine, the combo economy, the boss fights) exists to reward flying dangerously and to punish standing still.

### 1.2 Tech stack

| Layer | Choice | Why |
|---|---|---|
| Framework | **Next.js 16 (App Router), React 19** | Server-rendered landing, API routes for the leaderboard, static asset pipeline |
| Hand tracking | **MediaPipe Hands** (WASM, loaded from jsDelivr + model from Google storage) | Industry-standard landmark tracking that runs fully client-side — no server, no latency, no cost |
| Audio | **Tone.js** | Synthesized music/SFX — zero audio files shipped; zone-tinted beds, boss drone, volume slider and mute are all procedural |
| State & loop | Custom `useGameEngine` hook with a **requestAnimationFrame loop** | All physics on refs, DOM mutations only where visible — see §6.3 for why this matters |
| Persistence | `js-cookie` (badges, skins, settings) + **Upstash Redis** (leaderboard) | Badges/skins are per-player cosmetics; leaderboard is the one cross-player system |
| Styling | Tailwind CSS + custom keyframes in `app/globals.css` | Consistent design system, no CSS-in-JS overhead |
| Art | **Procedurally generated PNGs** (`scripts/generate-*.js`) | No external assets, no licenses, every sprite matches a coherent "lit, irregular, realistic" style |
| Tests | **Vitest** (66 unit + API tests) | Scoring, validation, signing, physics, and API routes are pure functions — cheap to lock down |
| Security | Strict **CSP** in production (`next.config.mjs`) | Blocks the only realistic tampering vector — injected third-party scripts (see §10) |

---

## Part 2 — Core gameplay systems

### 2.1 The core loop

1. **Countdown (3-2-1)** — then you're flying.
2. **Fly & dodge** — meteors scroll past; every metre travelled adds distance.
3. **Graze** — fly near a meteor without touching it to build combo and charge your shot meter.
4. **Survive the guardian** — every **500 m**, the belt changes theme and a **guardian boss** bars the way with a health bar.
5. **Die or triumph** — lose all lives and the run ends; the game-over screen shows your stats, badges, journey log, and leaderboard rank.

### 2.2 Lives & reserve lives

- You start with **4 lives** (`START_LIVES = 4`).
- A hit costs one life, then grants **1500 ms of invincibility** so a cluster can't chain-kill you.
- **Hearts at full lives bank as reserve lives** (up to **3**, `RESERVE_LIVES_MAX`). Each reserve absorbs one hit before an active life is lost. The reserves show dimmed in the HUD.
- **Why:** hearts were originally wasted at full health, which felt bad and made the power-up dead weight. Banking converts every heart into real survivability and rewards the "grab everything" instinct.

### 2.3 Zones & guardians

The belt advances through **five themes** that cycle, each with its own background tint, meteor color filter, accent color, chapter story, and guardian:

| Zone | Chapter | Guardian sprite | Signature attack | The threat |
|---|---|---|---|---|
| **Asteroid Field** | The Gauntlet | Rough asteroid | **Aimed rock triplets** | Rocks launch *at your current position* in volleys of three |
| **Nebula Storm** | Dying Light | Dying star | Expanding **plasma rings** | Ring walls force vertical judgment calls |
| **Ice Field** | Frozen Reach | Neptune gas giant | **Frost-shard cone** | Shards chill your steering; **two unshielded hits freeze you solid** (loses a life, `FROST_HITS_TO_LIFE = 2`) |
| **Lava Belt** | The Furnace | Sun | **Ember rain + aimed molten spit** | Screen-wide rain plus accurate spit — the toughest fight |
| **The Void** | Event Horizon | Black hole | **Homing warp orbs** | Orbs track you and force the dash timing |

**Why distinct bosses, not re-tinted rocks:** a shared sprite with a color filter reads as a palette swap, which feels cheap. Each guardian has its own **procedurally generated body** (`public/Images/boss-*.png`), a themed aura/glow, and an attack that expresses the zone's physics — ice *slows*, lava *burns and rains*, the void *pulls*. The visual identity and the mechanical identity are designed together so each fight is a new lesson, not a reskin.

**Why bosses are tougher than the field:** bosses are the run's punctuation — they convert a passive dodging loop into an active duel, cap each zone with a victory, and (via the boss-clear bonus and mission arc) give runs a sense of progress beyond just "how far did I get."

**Difficulty tuning (`BOSS_TUNING` in `lib/game/bosses.ts`):** the Asteroid Field (index 0) and Lava Belt (index 3) are deliberately the **bruisers** — more HP, faster volleys, and (for lava) wider, faster movement. The asteroid guardian opens the game and must teach the player how to fight (so it's a touch slower); the lava guardian is the mid-run wall that separates good runs from great ones.

```
Asteroid: hp ×1.25, volley every 1.9s, sway 1.25× wide
Nebula:   hp ×1.0,  volley every 3.2s
Ice:      hp ×1.0,  volley every 2.4s
Lava:     hp ×1.35, volley every 1.6s, sway 1.3× fast, 1.1× wide
Void:     hp ×1.0,  volley every 3.0s
```

Fight length base is `max(6, 26 − 2 × zoneIndex)` seconds — the first guardian fights longest because it's the tutorial boss.

### 2.4 Scoring — and why it's tuned the way it is

All scoring lives in **`lib/game/scoring.ts`** — pure functions, fully unit-tested.

| Source | Value | Notes |
|---|---|---|
| Distance | **9 m/s** | `SCORE_MULTIPLIER = 0.9` applied to the old 10 m/s |
| Graze | **10 × combo** (×2 when doubled) | See the combo curve below |
| Power-up pickup | **25** (×2 doubled) | |
| Meteor destroyed | **25** (50 charged) | |
| Boss clear | **500** | Chapter reward |

**The global 10% cut (`SCORE_MULTIPLIER = 0.9`):** distance, power-ups, and boss bonuses all pay 90% of their nominal value. The result: an identical run scores ~10% lower, which makes high scores harder to reach *and* protects the top of the board from inflation.

**The progressive combo curve — the interesting part.** Instead of a flat 10% cut on everything, grazes follow a ramp: a combo-1 graze keeps **~98%** of its value, a combo-10 graze keeps only **~85%** (`COMBO_SCALING_START = 0.98` → `COMBO_SCALING_END = 0.85`), with the weighted average across the combo range ≈ 90%.

- **Why not a flat cut?** A flat cut punishes casual players who only ever graze at low combos — they'd feel the game got stingier for no reason. The *progressive* curve keeps early, safe grazing rewarding and concentrates the pain on long chains — the highest skill ceiling. High-score runs are built on long chains, so the cut hits exactly where the score inflation would come from.
- **Why 10% at all?** To make old scores unreachable cheaply and to slow the leaderboard arms race without rebalancing spawn rates or power-up values — a single constant and a single curve, not a dozen tweaks.

**Combo mechanics:** each graze raises the multiplier up to **×10** (`COMBO_MAX`). The combo **decays after 3 s** without a graze (`COMBO_WINDOW_MS`), and a hit **resets it to 1** — the single biggest scoring lever, and the reason clean runs dwarf scrappy ones.

### 2.5 Grazing

- A **graze** is a near-miss: your rocket passes within **65 px** (`GRAZE_RADIUS`) of a meteor's center without colliding (collision itself uses a **28 px inset** on the sprite, so contact is more forgiving than the visual edge — fair in the player's favor).
- Grazes fill the **shot meter** (+10) and the **combo**.
- **Why graze exists:** it converts "avoiding" from a passive act into a *skill with a reward gradient* — fly cleanly *close* and you're rewarded; fly wide and you're safe but poorer. It's what separates dodging from *dancing*.

### 2.6 Power-ups

Falling pickups appear roughly every **4 s** (`POWER_UP_INTERVAL`) — you must **steer into them** to grab them:

| Pickup | Effect | Why it exists |
|---|---|---|
| 🛡️ **Shield** | Absorbs the next hit | Forgiveness for the aggressive flyer — lets you deliberately thread tight gaps |
| ⏳ **Slow-mo** | 5 s of time at 55% speed (`SLOWMO_FACTOR`) | The "superpower moment" — makes an impossible wall trivial if you read it early |
| ✖️ **2× Score** | 8 s of doubled points (`DOUBLE_DURATION_MS`) | Rewards steering *toward* risk during a scoring window |
| ❤️ **Extra life** | +1 life, or banks a reserve at full | See §2.2 — never wasted |

**Why power-ups must be steered into rather than auto-collected:** the decision *"do I leave the safe line to grab this?"* is the whole point. A freebie that comes to you removes the risk/reward choice; one you must reach adds tension to every pickup.

### 2.7 Pinch-to-fire — the shooting economy

Shooting is the only offensive option, and it is **gated twice** so it can never replace dodging:

**Gate 1 — the gesture meter.** It fills **only** from grazes (+10) and dashes (+20), never passively. An uncharged bolt costs **30** energy, a charged bolt **60** (max 100). You literally cannot shoot unless you've been flying dangerously.

**Gate 2 — the magazine.** Only **3 bolts** may be in flight at once (`SHOOT_MAX_BOLTS`). A slot frees when a bolt resolves (hits something or exits the screen). Bolts travel fast (1250 px/s) so the cap recycles quickly — the reload *feels* snappy, but the cap is real.

**Why both gates?** A meter alone still lets a skilled player sustain fire; an ammo cap alone still lets you bank shots and spam. Together they enforce the core promise: **you must dodge — shooting is a reward, not a crutch.**

**The charge mechanic:** hold the pinch for **500 ms** to start charging (`SHOOT_CHARGE_MS`), reach full power at **1200 ms** (`SHOOT_CHARGE_FULL_MS`), and the shot only counts as "charged" past **75%** of the charge bar (`SHOOT_CHARGED_MIN`). A charged bolt does **2× meteor damage, 2× bolt score, and 2.2× boss damage** vs. an uncharged one (boss damage: 10% vs 22% of HP).

- **Why charge exists:** it creates a *committed* decision — you're vulnerable while charging, so you must pick a safe moment, not just tap-fire continuously.
- **No crosshair, no aiming:** bolts always fly **straight up** from the rocket. **Why:** the game is a dodging game — free aiming would turn it into a shooter and multiply gesture complexity tenfold. One axis of movement (left/right) plus one simple direction of fire keeps the control scheme pure and learnable.
- **Frost counterplay:** the Ice guardian's shards also *frost* you (see §2.9) — the two systems interact: a frozen pilot can't charge safely.

### 2.8 Dash & shield (defensive gestures)

| Gesture | Effect | The numbers | Why |
|---|---|---|---|
| **Spread both hands** | Dash — burst upward with a brief invincibility window | **600 ms** i-frames (`DASH_IFRAMES_MS`), **2500 ms** cooldown (`DASH_COOLDOWN_MS`), +20 meter energy | I-frames are the escape hatch from a wall you misread; the cooldown stops it from being spammable. It's also the *only* way to pass *through* a packed cluster |
| **Flat palms** | Shield — an energy barrier that absorbs hits | Max energy drains at **28/s** while held, recharges at **12/s** when released, one block costs **35** energy | A held barrier is a resource, not a toggle: you can't turtle forever. The recharge asymmetry means shield use must be *brief and deliberate* |

### 2.9 The frost mechanic (Ice Field)

- Each unshielded shard hit applies **Frost**: **3 s** (`FROST_MS`) of steering responsiveness at **50%** (`FROST_FACTOR`).
- **Two frost hits = a lost life** (`FROST_HITS_TO_LIFE = 2`), so a single hit is a warning, not a death sentence — but ignoring the warning is fatal.
- **Why frost exists:** every other zone punishes you *instantly* with a hit. Frost changes the texture of danger — it's a *debuff that degrades your control over time*, teaching you that some zones require different play (back off, stop grazing, shield up). Two hits to lose a life makes the mechanic threatening without being one-shot unfair.

---

## Part 3 — The hand-gesture system

### 3.1 Recognition pipeline

`components/HandRecognizer.tsx`:

1. **MediaPipe Hands** loads (WASM from `cdn.jsdelivr.net`, model from `storage.googleapis.com`).
2. Every frame, MediaPipe returns up to two hands with **21 landmarks** each.
3. A classifier turns landmarks into gestures: **tilt** (relative hand height/pitch), **spread** (finger separation), **flat palm**, **fist**, **pinch** (thumb–index distance), **point** (single extended forefinger).
4. **Gesture confirmation:** a gesture must be seen for **3 consecutive frames** (~100 ms, `GESTURE_HOLD_FRAMES`) before it counts. This is the first line of defense against jitter and accidental triggers.

### 3.2 Steering: EMA smoothing

Raw tilt goes through an **exponential moving average** with alpha **0.25** (`TILT_SMOOTHING`): lower = smoother, higher = snappier.

**Why EMA:** raw MediaPipe landmarks jitter by several pixels frame to frame, which would translate into a vibrating rocket. The EMA keeps the *average* direction accurate while killing the high-frequency noise. The **Sensitivity slider** (0.5–3.0, default 1.0) then scales how far the smoothed tilt moves the rocket — smoothing fixes *jitter*, sensitivity fixes *reach*, and the two are deliberately separate controls.

### 3.3 The gesture vocabulary

| Gesture | In-game | In menus |
|---|---|---|
| Tilt (both hands) | Steer | — |
| Spread | Dash | **Go back** |
| Flat palms | Shield | — |
| Both fists | Pause | — |
| Pinch (one hand enough) | Fire / charge bolt | **Click / confirm** |
| Point (single forefinger) | — | Move cursor |

### 3.4 The hands-free menu cursor

On the idle, pause, and game-over screens you never touch a mouse:

- **Point** to move an on-screen cursor. The cursor is driven at **1.5× the hand's motion** (`MENU_CURSOR_DPI`), pivoting on screen center — so a half-screen hand movement covers the whole UI without arm fatigue.
- **Pinch** (or fist) to click. **Spread** to go back.

**The assist layer — why hand-menu navigation is reliable at all:**
- **Magnetic snap** (`MENU_SNAP_RADIUS = 150 px`): when the cursor is near a button it gets pulled toward the button's center — capped per frame so it *glides*, never teleports. You don't need pixel-perfect aim.
- **Click grace** (`MENU_CLICK_GRACE = 140 px`): a confirm lands on the nearest button even if the fingertip is slightly off.
- **Deliberate-pinch requirement:** a resting thumb against a finger will *not* trigger a click — the recognizer requires a clear, intentional pinch, and a held pinch latches so it can't double-click.
- **Haptic feedback:** every successful click fires a cursor pulse + subtle sound, so you *feel* the confirmation without looking at the button.
- **Why all of this:** raw hand coordinates over a dense UI (the game-over screen is packed with small buttons) are jittery and fatiguing. The snap/grace system is what makes the difference between "hand menus are a demo gimmick" and "hand menus are actually usable."

### 3.5 The on-screen gesture guide

A small icon strip on the idle screen shows the key poses (point-to-move, pinch-to-click) so first-time players discover the menu scheme before they ever pause. **Why:** the hardest part of gesture UX is teaching the user the vocabulary — showing it before they need it removes the "why isn't this working" frustration.

---

## Part 4 — The game state machine

`hooks/useGameEngine.ts` (the 2,883-line engine — the heart of the game):

```
idle → tutorial → countdown → playing ⇄ paused → gameover
```

- **idle** — landing screen: skins, leaderboard, settings, support, footer.
- **tutorial** — first-play interactive overlay (tilt / graze / power-up callouts with hand-drawn styling) before the countdown.
- **countdown** — 3-2-1 (3 s, `COUNTDOWN_SECONDS`). **Steering is locked during countdown** so a player holding a tilt can't pre-position the rocket and gain an unfair start.
- **playing** — the rAF loop runs physics, spawning, collisions, boss logic.
- **paused** — triggered by the fist gesture **or automatically when the tab is hidden** (`visibilitychange`). The 3-2-1 resumes on return — a resume timer that is *also* steering-locked.
- **gameover** — stats, badges, journey log, leaderboard flow.

**Why a formal state machine:** the game was originally one giant `useEffect` with boolean flags, which made every transition a bug farm (e.g., pausing mid-countdown, resuming after death). Explicit states make each transition auditable, and the tab-hidden auto-pause closes the biggest fairness hole — nobody dies while looking away.

---

## Part 5 — Progression, cosmetics & persistence

### 5.1 Badges (persisted in cookies)

| Badge | Earn by |
|---|---|
| 🎖️ **Grazer** | First near-miss graze |
| ⚡ **Dasher** | First dash |
| 🛡️ **Shield** | First shield power-up |
| 🔥 **Combo 10** | Reach a 10× combo |
| 🏆 **Boss Slayer** | Defeat a zone guardian |
| 📍 **500m** | Fly 500 m in a single run |

Badges unlock **once and forever**, stored in the `badges` cookie, and render on the game-over screen (locked badges show dimmed with a padlock).

**Why cookies, not a server:** badges are pure player-local cosmetics — there's no social value in server-validating them, and a server would add latency and cost for zero gameplay benefit. The *leaderboard* (the one competitive system) *is* server-validated — see §8.

### 5.2 Rocket skins (8, from badges + score milestones)

| Skin | Unlock condition | Why this condition |
|---|---|---|
| **Classic** | Default | Everyone starts with a clean look |
| **Hunter** | Grazer badge | Grazing is the beginner's first skill — reward it first |
| **Dasher** | Dasher badge | Dashes are the second skill |
| **Combo Star** | Combo 10 badge | Long chains are the intermediate skill |
| **Guardian Slayer** | Defeat a guardian | Boss kills are the run's turning point |
| **Marathon** | 500 m in one run | Endurance, not skill |
| **Void Racer** | 10,000 high score | Score milestones reward *consistency* across runs |
| **Legend** | 25,000 high score | The capstone — only sustained excellence gets it |

Skin choice persists in the `rocketSkin` cookie and shows on **the rocket, the lives HUD, and the idle screen**. Flames are tinted per skin so the engine trail matches the hull.

**Why mix badges and score milestones?** Badges reward *firsts* (discovery), score milestones reward *repeats* (mastery). Two progression axes means there's always a reason to play — earn the badge, then push the score.

### 5.3 Run stats, journey log & mission arc

- **Run-stats panel** on game-over: distance, score, top combo, grazes, bolts fired, bosses defeated, time.
- **Journey log:** the run drawn as a **path through zones** — which chapters you reached and cleared.
- **Mission arc:** each zone carries a chapter name and objective ("Thread the belt — the first Guardian bars the way out"), shown on approach, with a celebration on zone completion.

**Why a story arc in an arcade game:** pure score-chasing loses emotional steam after a few runs. Chapter objectives give each run a *narrative spine* — even a failed run becomes a story ("I made it to The Furnace") — and the journey log makes the game-over screen a recap worth reading.

### 5.4 Tutorial overlay

On the **first play only**, an interactive overlay teaches tilt steering, grazing, and power-up grabs with hand-drawn-style callouts *before* the countdown. **Why:** gesture games fail when the user doesn't know the vocabulary; a modal tutorial that plays itself is the fastest path to competence, and showing it only once respects veterans.

---

## Part 6 — Architecture & performance

### 6.1 Repository layout

```
app/
  page.tsx              # The game screen — composition root, JSX, HUD
  globals.css           # Tailwind + all custom keyframes (popups, shake, trails…)
  layout.tsx            # Metadata, fonts, OG image
  api/score/…           # Serverless leaderboard routes (token, submit, board)
components/
  HandRecognizer.tsx    # MediaPipe → gesture classification
  RocketComponent.tsx   # Skinned rocket + engine trail render
  BoulderComponent.tsx  # Memoized meteor renderer
  Particle.tsx          # Explosion / trail / collision particles
  Starfield.tsx         # Parallax background
  BossAccessory.tsx     # Guardian auras & themed accessories
  GameInfoOverlay.tsx   # HUD + all overlay screens (idle, pause, game-over, popups)
  Leaderboard.tsx       # Top-10 board UI
  TutorialOverlay.tsx   # First-play tutorial
  ConfettiBurst.tsx     # Leaderboard-entry celebration
  SocialLinks.tsx       # Footer socials
hooks/
  useGameEngine.ts      # The entire game loop, physics, state machine, boss AI
lib/
  game/constants.ts     # Every tunable number — the "tuning sheet"
  game/scoring.ts       # Pure scoring math (unit-tested)
  game/physics.ts       # Collision / graze math (unit-tested)
  game/bosses.ts        # Boss styles, sprites, tuning, projectile visuals
  game/zones.ts         # Zone themes + chapter stories
  game/types.ts         # Shared types
  game/sign.ts          # HMAC signing helpers (unit-tested)
  game/support.ts       # UPI tip-jar config
  leaderboard.ts        # KV store client + validation (unit-tested)
utils/
  audioHandler.ts       # Tone.js music/SFX engine
  skins.ts / badges.tsx # Cookie-backed cosmetics
scripts/
  generate-bosses.js, generate-meteors.js, generate-projectiles.js,
  generate-og-image.js  # Procedural art generation
  generate-upi-qr.js    # Build-time UPI QRs
  generate-all.js       # Manual: runs every generator (not auto-run)
tests/                  # 66 unit + API tests
```

### 6.2 Why the engine is a single 2,883-line hook

The engine was originally a monolith inside `app/page.tsx` and was split into focused modules over the project's life — but the *game loop itself* intentionally stayed in one hook. **Why:** the loop touches state machine, physics, collisions, bosses, scoring, audio, and DOM registration in one place, with frame-order guarantees. Splitting the loop into pieces introduces cross-file ordering bugs for zero runtime benefit. What *was* split — pure math (`scoring.ts`, `physics.ts`), data (`constants.ts`, `bosses.ts`, `zones.ts`), and IO (`audioHandler.ts`) — are the parts that benefit from isolation and tests.

### 6.3 The rAF loop and refs — why no React state in the hot path

The game does **not** re-render React on every frame:

- A single **`requestAnimationFrame` loop** runs physics, spawning, collisions, and boss AI.
- All mutable game state (positions, velocities, HP, combos, arrays of meteors/boss projectiles) lives in **`useRef`s**.
- React state updates only when the UI actually needs to change (HUD score, lives, combo, boss HP bar, state transitions).
- Meteor/Boulder components are **memoized** — the DOM moves them via direct style transforms from the loop, and React never re-renders them.

**Why this matters:** a naive React implementation re-renders the whole tree every frame (60+ renders/second) — that's how you get 20 fps with a frozen UI thread. The ref/rAF design measured **132 fps** in play with 150 particles alive, and keeps hand tracking's frame budget free. The visible UI is *driven by* the loop, not *recomputed by* it.

### 6.4 Responsive fairness — no screen-size advantage

This was an explicit design goal: **no player should gain an advantage from screen size.** Gameplay is normalized to a **1280×800 reference viewport**:

- Meteor density scales with **unit width**, not pixel count — a 4K ultrawide doesn't spawn 3× the meteors of a laptop.
- Fall time scales with **screen height** — a tall phone doesn't give you "more time to react" for free.
- Steering speed is relative to the field, sprite sizes scale with the viewport.
- **Clamps keep it fair at the extremes:** gameplay scale is clamped to **0.45×–2.2×** (`SCALE_MIN`/`SCALE_MAX`) and sprite sizes to **0.7×–1.5×** (`SIZE_SCALE_MIN`/`SIZE_SCALE_MAX`) — so a phone doesn't get invisible meteors and an ultrawide doesn't get unreadable ones.
- **20% screen-coverage cap** on meteors — density stops growing past a point, so late-game difficulty comes from *speed and patterns*, never from the screen being full of rocks.
- **20% faster initial speed (v2.1):** the base fall duration was tightened from 10 s to **8.33 s** (`baseDuration` in `lib/game/physics.ts`), making the opening belt 20% more intense from the first second. The log-scaling acceleration curve then applies on top of this faster baseline.

### 6.5 Procedural art — why generated, and the style rules

Every sprite (meteors, boss bodies, projectiles, OG image, UPI QR) is **generated at build time** by `scripts/generate-*.js` and committed. No stock art, no external image CDN, no licenses to track.

The style rules that make it feel real rather than cartoony:
- **Irregular silhouettes** — no perfect circles or smooth blobs; noise-driven outlines.
- **Directional lighting** — each sprite carries a light source, so surfaces shade believably.
- **Crater/edge detail with variation** — crater rims are irregular, not perfect rings.
- **Color clamping** — every render clamps RGB to 0–255 (unclamped values wrap to dark and made early versions look washed out).
- **Themed physics** — nebula = dying star, ice = Neptune gas giant, lava = sun, void = black hole with accretion disk + photon ring, asteroid = rough rock. Each guardian is a *different body*, not a tint.

The sprites are committed PNGs so production serves static files with zero build cost; the generators are kept for regeneration and iteration.

### 6.6 Effects & juice

- **Parallax starfield** — three depth layers scrolling at different rates; the layer speed increases with distance, selling the "faster, deeper" feel.
- **Engine trail** — layered flame + smoke emitted at 25/s (`TRAIL_EMIT_INTERVAL = 0.04 s`), colored per skin.
- **Collision burst** — particles, screen shake (450 ms, up to 10 px — `SHAKE_DURATION_MS`/`SHAKE_AMOUNT`), and a layered crash animation.
- **Boss entrance** — descent with screen shake + flash before the health bar appears.
- **Haptics** — menu-click cursor pulse; confetti on leaderboard entry.
- Particle budget capped at **150** (`MAX_PARTICLES`) so effects can't tank the frame rate.

---

## Part 7 — Audio (`utils/audioHandler.ts`, Tone.js)

All audio is **synthesized with Tone.js** — there are no audio files in the repo. Zone-tinted music beds, the boss drone, menu clicks and all SFX are generated procedurally at runtime and respect the master volume and mute toggle.

| System | What it does | Why |
|---|---|---|
| **Zone-tinted music beds** | Each zone changes the musical tint (chord palette/color) of the background bed | Audio mirrors the visual theme change — the Ice Field *sounds* cold, the Lava Belt *sounds* hot |
| **Boss-intensity layer** | A heavier layer fades in during guardian fights | Escalation you can *hear* before you see it |
| **SFX** | Graze, dash, shield, bolt, charge, explosion, click, countdown | Instant feedback without visual attention |
| **Unlock on first interaction** | Tone.js starts only after the first user gesture | Browsers block autoplay; unlocking on interaction is the only compliant way to get audio |
| **Mute + volume** | Mute toggle; **master volume slider defaulting to 50%** | Respects the player; 50% is loud enough to hear but quiet enough not to startle |
| **Menu-click feedback** | A subtle click on every menu interaction | Confirms the gesture click without looking at the button |

---

## Part 8 — Leaderboard & anti-cheat (serverless)

### 8.1 Architecture

- **Store:** Upstash Redis (free tier) — `lib/leaderboard.ts` is the client.
- **Routes** (`app/api/score/`): `token` (issue at run start), `submit` (validate + insert), and the board read.
- **Flow:** run starts → client requests a short-lived **HMAC signing token** → run ends → client signs the run payload → server verifies signature, validates plausibility, inserts → if the run cracked the top-10, the client prompts for a **callsign** (Enter = save, Esc = skip) and shows a confetti burst.

### 8.2 Why the layered anti-cheat

1. **HMAC-signed submissions (`lib/game/sign.ts`)** — the server issues a token with a secret (`LEADERBOARD_SECRET`) at run start; the client signs the final payload; the API **rejects unsigned or tampered scores**. This makes forging a score require knowing the server secret.
2. **Plausibility validation** — the server rejects *impossible* runs: score inconsistent with the zone reached, distance travelled, and time elapsed. Even a valid signature can't claim 50,000 points from 200 m in 40 seconds. The signing key stops *forgers*; the plausibility check stops *cheaters who sign legitimately* (e.g., modifying the client to submit its own signed-but-impossible data is impossible without the secret, and normal client-side score inflation is caught by the math).
3. **Top-10 only** — the board is capped at 10 entries, so the incentive to cheat is bounded and the board stays readable.

**Why a leaderboard at all in a hand-gesture game:** gesture games are inherently local (you play alone in your room). The leaderboard is the *one* shared, competitive surface — it turns solitary practice into a public quest and gives runs a target beyond the previous run.

---

## Part 9 — The tip jar (UPI support)

### 9.1 What the player sees

A **☕ Buy me a coffee** button (bottom-right of the idle screen) opens a translucent popup with four preset amounts — **₹50 / ₹100 / ₹200 / ₹500** — each showing its own QR to scan with GPay / PhonePe / Paytm, with the message **"Having fun with Meteordash"** pre-filled and a payee line: **"Payee: Ankush Karmakar — verify before paying."**

### 9.2 Why it's built this way (the security model)

- **Static build-time QRs** (`scripts/generate-upi-qr.js`, run via `generate-all.js`): every amount is a fixed PNG generated once from the configured VPA. **There is no runtime string-building for an attacker to hook** — the QR can't be rewritten by injected code because nothing constructs it at runtime.
- **Payee-name verification is the real backstop:** even if every layer were compromised, the payer's UPI app shows the *bank-registered name* for the VPA. A mismatch with "Ankush Karmakar" printed under the QR is the fraud signal — and it happens *inside* the payment app, outside the page's control.
- **The VPA is public by design** (like a bank account number) — "hiding" it was never the goal; *tamper-resistance* was, and that comes from HTTPS + static QRs + CSP + the payee check.
- **Why no webhook/"thank supporters" flow:** zero-fee UPI has no server-side confirmation. A donation landing can't be verified, so any "thank you" would be honor-system — the game deliberately does **not** fake donation detection.
- Config lives in `NEXT_PUBLIC_UPI_VPA` / `NEXT_PUBLIC_UPI_PAYEE_NAME` (gitignored `.env.local` locally, Vercel env vars in production).

---

## Part 10 — Security & privacy

### 10.1 Content-Security-Policy (production only)

`next.config.mjs` ships a strict CSP in production builds (dev is untouched — Next's HMR needs relaxed rules; a policy relaxed for dev would be a weaker policy in prod):

```
default-src 'self'
script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://cdn.jsdelivr.net
style-src 'self' 'unsafe-inline'
img-src 'self' data: blob:
font-src 'self' data:
connect-src 'self' https://cdn.jsdelivr.net https://storage.googleapis.com
media-src 'self' blob: data:
worker-src 'self' blob: https://cdn.jsdelivr.net
object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'
upgrade-insecure-requests
```

**Why each non-obvious piece:**
- `cdn.jsdelivr.net` in `script-src` — MediaPipe's wasm bootstrap loads as an actual `<script>`, not just a fetch (missed initially; would have silently broken hand tracking in production).
- `'wasm-unsafe-eval'` — Chrome treats wasm compilation like eval; this precise directive permits wasm *without* enabling eval-based JavaScript.
- Everything else is blocked — **no third-party script can ever load**, which closes the one realistic vector for tampering with the UPI QR/link or leaderboard flow.
- Verified live against the production build: MediaPipe wasm + model + fonts load with **zero CSP violations**; negative probes (arbitrary external script/fetch) are refused.

### 10.2 Camera privacy

- The webcam stream is used **only for local hand tracking** — nothing is uploaded, recorded, or transmitted.
- The stream is **stopped on unmount** and when the game leaves the page.
- Permission-denied / no-camera / in-use errors each show a distinct message with a working **Try Again** (a retry genuinely clears the error state — a real bug fixed during CSP verification).

---

## Part 11 — Testing

**61 automated tests (Vitest)** across:

| Suite | What it locks down |
|---|---|
| Scoring | Combo curve math, graze/power-up/bolt/boss values, the 10% cut |
| Physics | Collision inset, graze radius, fall timing |
| Signing | HMAC token issue/verify, tamper rejection |
| Leaderboard API | Rejects unsigned, tampered, and *impossible* scores; accepts valid ones |

The scoring/signing/physics code is deliberately written as **pure functions** (`lib/game/`) precisely so this test coverage is possible and stable.

---

## Part 12 — Deployment (Vercel free)

### 12.1 Requirements

- **Node 24** (pinned in `.nvmrc` + `engines`) — no runtime above that needed.
- **Zero paid services:** static hosting (free), Upstash Redis free tier (leaderboard), no external image CDN (procedural art), no audio files (Tone.js synth), no payment processor (UPI QR).

### 12.2 Environment variables

| Variable | Used for |
|---|---|
| `LEADERBOARD_SECRET` | HMAC signing of score submissions |
| `KV_REST_API_URL` + `KV_REST_API_TOKEN` | Upstash Redis (leaderboard store, auto-synced by Vercel Marketplace) |
| `NEXT_PUBLIC_SITE_URL` | Canonical URL / share metadata |
| `NEXT_PUBLIC_UPI_VPA` | UPI address for the tip jar (`ankushkarmakar@apl`) |
| `NEXT_PUBLIC_UPI_PAYEE_NAME` | Payee name shown for verification (`Ankush Karmakar`) |

### 12.3 Build

The game uses pre-committed images from `public/Images/`. Run `node scripts/generate-all.js` manually only if you need to regenerate procedural art. The strict CSP ships automatically. No `vercel.json` needed.

---

## Part 13 — Troubleshooting & developer notes

| Symptom | Cause / fix |
|---|---|
| No hand tracking in production | Check for CSP violations in the console — the jsDelivr/wasm entries in §10.1 are load-bearing |
| "Try Again" doesn't recover from camera error | A fixed bug — retry now clears the error state; if it recurs, the error was never cleared by a *successful* init (see `HandRecognizer.tsx`) |
| Steering feels twitchy | Lower Sensitivity; if it still twitches, lighting/background is degrading landmark quality |
| Score submission 503s locally | `LEADERBOARD_SECRET` unset in the local sandbox — expected; set it or run with Vercel env |
| QR pays the wrong person | The VPA is baked into the PNG at build — change `NEXT_PUBLIC_UPI_VPA` and rebuild; **never** pay unless the app shows "Ankush Karmakar" |
| Meteors cover more than ~20% of the screen | Density is capped by design — if it regresses, check the spawn cap in `constants.ts` |

---

## Part 14 — Tuning cheat-sheet (where every number lives)

Everything tunable is in **`lib/game/constants.ts`** — the game's tuning sheet:

- Lives & reserves: `START_LIVES` (4), `RESERVE_LIVES_MAX` (3), `INVINCIBILITY_MS` (1500)
- Zones: `ZONE_DISTANCE` (500 m)
- Scoring: `SCORE_MULTIPLIER` (0.9), `COMBO_SCALING_START/END` (0.98→0.85), `COMBO_WINDOW_MS` (3000), `COMBO_MAX` (10), `GRAZE_POINTS` (10), `POWER_UP_POINTS` (25), `BOLT_SCORE` (25)
- Shooting: `SHOOT_METER_MAX` (100), `SHOOT_METER_PER_GRAZE` (10), `SHOOT_METER_PER_DASH` (20), `SHOOT_ENERGY_COST` (30/60), `SHOOT_MAX_BOLTS` (3), `BOLT_SPEED` (1250), `SHOOT_CHARGE_MS` (500), `SHOOT_CHARGE_FULL_MS` (1200), `SHOOT_CHARGED_MIN` (0.75)
- Frost: `FROST_MS` (3000), `FROST_HITS_TO_LIFE` (2), `FROST_FACTOR` (0.5)
- Dash/shield: `DASH_IFRAMES_MS` (600), `DASH_COOLDOWN_MS` (2500), `SHIELD_*` (28/12/35)
- Menu cursor: `MENU_CURSOR_DPI` (1.5), `MENU_SNAP_RADIUS` (150), `MENU_CLICK_GRACE` (140)
- Steering: `TILT_SMOOTHING` (0.25), `DEFAULT_SENSITIVITY` (1.0, range 0.5–3)
- Fairness: `REF_WIDTH` (1280), `SCALE_MIN/MAX` (0.45/2.2), `SIZE_SCALE_MIN/MAX` (0.7/1.5)
- Bosses: `BOSS_TUNING` + `BOSS_SPRITES` in `lib/game/bosses.ts`
- Landing Menu Layout: Completely redesigned in **v2.1** to remove the rounded container box, presenting all diagnostic, manual, and hangar selection items in a clean single-panel layout directly on the space background.

---

*Meteor Dash v2.1.0.0 — built by Ankush Karmakar. Fly safe, pilot. 🚀*

