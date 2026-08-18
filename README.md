# 🚀 Meteor Dash

A hand-gesture-controlled space arcade game. Steer your rocket through asteroid fields with your bare hands — no controller, no keyboard. Tilt to steer, spread your palms to dash, and take on zone guardians as you push deeper into the belt.

Built with **Next.js 16 (App Router)**, **MediaPipe Hands** for real-time gesture tracking, **Tone.js** for procedural audio, and a 60fps `requestAnimationFrame` game loop that keeps React state out of the hot path.

## ✨ Highlights

- **Gesture steering** — tilt your hands to fly; EMA smoothing + a sensitivity slider keep the controls jitter-free
- **5 themed zones** — Asteroid Field, Nebula Storm, Ice Field, Lava Belt, and The Void, each with its own look and rules
- **Guardians** — a boss at every zone boundary, each with a themed entrance, health bar, and signature attack (lobbing rocks, plasma rings, frost shards, ember rain, homing orbs). The Asteroid Field and Lava Belt guardians are the bruisers — heavier, faster, and meaner than the rest
- **Mission arc** — every zone is a story chapter with an objective, a +500 chapter reward for clearing it, and a journey log that maps your run on game over
- **Graze combo system** — thread meteors closely to chain up to a ×10 combo
- **Power-ups** — shields, slow-mo, 2× score, and extra lives that you must steer into
- **Pinch-to-fire** — the only offensive option: a thumb+index pinch fires a bolt straight up from the rocket (hold to charge). Gated by a shot meter that fills *only* from grazes and dashes, plus a hard 3-bolt cap in flight, so dodging stays the prime skill and you can never chain-fire a clear path
- **Hand-driven menus (v2.1 Redesign)** — The home landing page has been redesigned to be a clean, single-screen dashboard with no container borders, making the Pilot Manual, Hangar, and diagnostics visible concurrently. Menus are fully navigable without a mouse: point (one index finger) moves a glowing cursor, fist/pinch clicks, and spread exits the active view. Pointing never accidentally starts a run — both hands without pointing begin the countdown.
- **Badges & run stats** — persistent unlocks (grazer, dasher, combo streaks, boss slayer) stored in cookies
- **First-play tutorial** — an interactive hand-drawn-style walkthrough of tilt, graze, and pickup; skip with both fists or Esc/Space
- **Juice** — screen shake, explosion particles, parallax starfield, engine trail, impact flashes
- **Serverless leaderboard** — top-10 runs with pilot callsigns, HMAC-signed submissions, server-side consistency validation, and a floating glass window that auto-opens with a confetti burst when your run lands
- **Reserve lives** — hearts grabbed at full health bank as reserves that absorb the next hit, with clear "+1 Reserve" / "Lives Full" feedback
- **Screen-size fairness** — gameplay normalizes to a 1280×800 reference viewport: meteor density per unit width, tilt→steering speed, fall time, and sprite sizes all scale with the actual screen, so nobody gets an edge from a bigger display
- **Responsive, scrollbar-free HUD** — rocket positioning and all overlays adapt to any screen size
- **20% faster opening belt (v2.1)** — meteors start at 8.33 s fall time (down from 10 s) so the game is intense from the first second; log-scaling acceleration keeps the late game progressively harder


## 🎮 How to play

Show both hands to start, then steer with your tilt. **Spread** to dash, **flat palms** for a shield, **fists** to pause, **pinch** to fire a charged bolt — and in menus, **point** one forefinger to move the cursor, **pinch** to click, **spread** to go back.

A **Gesture Guide** button in-game explains everything on demand; sensitivity, volume and sound live in the bottom-left panel.

> 📖 The complete player guide — every gesture, power-up, boss, combo, skin & badge table, leaderboard flow, tips and troubleshooting — lives in **MANUAL.md**.

## 🎨 Rocket skins & badges

Eight unlockable rocket hulls and six badges, earned from gameplay milestones (first graze, ×10 combo, boss defeat, 500 m, 10k / 25k high scores). Unlocks persist and show on the rocket, the lives HUD, and the home screen.

> 📖 Full unlock table (every skin and badge with its exact condition): **MANUAL.md** → *Rocket skins* & *Badges*.

## 🕹️ Game systems

- **5 zones & chapters** — the belt re-themes every 500 m, each zone a mission chapter with a guardian and a +500 clear bonus
- **Guardians** — five bosses with themed art and signature attacks (aimed rock triplets, plasma rings, freezing shards, ember rain, homing orbs); the asteroid & lava guardians are the bruisers
- **Graze combo** — thread meteors closely to chain up to ×10, the multiplier that drives big scores
- **Power-ups** — steer into shield, slow-mo, 2× score, and extra lives (hearts at max bank as reserves)
- **Pinch-to-fire** — a 3-bolt magazine filled only by grazes and dashes, so dodging stays the core skill
- **Zone-tinted music + boss drone** — each zone re-routes the Tone.js music bed through its own effect chain, and a heartbeat drone fades in during guardian fights
- **Journey log** — game over maps your run as a path through the zones you reached and cleared

## ☕ Buy me a coffee

Like the game? Hit the **☕ Buy me a coffee** button in the bottom-right corner of the home screen to support the developer.

- Pick your tip: **₹50 / ₹100 / ₹200 / ₹500** — a QR code pops up for your choice.
- Scan it with **GPay, PhonePe, or Paytm** (any UPI app) — the amount and the message *"Having fun with Meteordash"* are pre-filled.
- **Check the payee name** on the scan screen matches **Ankush Karmakar** before paying — your UPI PIN is only ever entered inside your own payment app, never on the game's page.
- Your tip goes straight to the developer — no platform fees, no middleman. Thank you! 🧡

> 📖 Full player guide: see **MANUAL.md** for everything from gestures to bosses.

## 🚀 Getting started

Requires **Node.js 24** (see `.nvmrc`).

```bash
npm install
npm run dev
```

Open http://localhost:3000 — allow camera access, show both hands, and fly.

### ☁️ Deploying on Vercel (free tier)

The project is Vercel-ready (Next.js App Router is auto-detected — no `vercel.json` needed).

1. **Push to GitHub**, then import the repo in the Vercel dashboard (**Framework preset: Next.js** — auto-detected, leave defaults; the build runs `next build` and Node is pinned to 24 via `package.json` → `engines`).
2. **Set environment variables** (Settings → Environment Variables → Production):

   | Variable | Required? | Purpose |
   | --- | --- | --- |
   | `LEADERBOARD_SECRET` | **Yes** for leaderboard submissions | Any long random string (`openssl rand -hex 32`). Signs per-run HMAC tokens. Without it the API fails closed — submissions are rejected rather than insecure. |
   | `KV_REST_API_URL` | Recommended | **Upstash Redis** REST URL (auto-synced by the Vercel Marketplace Upstash integration, or create a free instance at [console.upstash.com](https://console.upstash.com) and copy it). Without it the leaderboard falls back to an in-memory store — it works, but resets when serverless instances cold-start. |
   | `KV_REST_API_TOKEN` | Recommended | Redis access token from the same dashboard page (also auto-synced by the integration). |
   | `NEXT_PUBLIC_SITE_URL` | Recommended | Your deployed origin (e.g. `https://meteordash.vercel.app`) — makes Open Graph / Twitter share URLs absolute. |
   | `NEXT_PUBLIC_UPI_VPA` | Only for the tip jar | Your UPI ID (e.g. `yourname@okaxis`) — baked into the build-time support QRs. Omit it and the QR is a placeholder that pays nobody. |
   | `NEXT_PUBLIC_UPI_PAYEE_NAME` | Only for the tip jar | The name shown under the QR for payers to verify (should match your bank-registered name). |

3. **Deploy.** That's it — no server config, no database migrations.

> **Free-tier notes** — the leaderboard API is fully serverless and stays within the free hobby limits (a handful of requests per run). The local-dev JSON file store (`.data/`) does **not** exist on Vercel's read-only function filesystem; without Redis the board runs from memory per instance. For a persistent public board, add the free Upstash Redis integration from the Vercel Marketplace — it auto-syncs `KV_REST_API_URL` and `KV_REST_API_TOKEN` and the code switches automatically.

### Leaderboard persistence

The leaderboard (`GET/POST /api/score`) stores top-10 runs:

- **Local dev** — falls back to a JSON file at `.data/leaderboard.json` (gitignored) so it works with zero setup.
- **Production (Vercel)** — uses **Upstash Redis**. Add the Upstash integration from the Vercel Marketplace (it auto-syncs `KV_REST_API_URL` and `KV_REST_API_TOKEN`), plus a `LEADERBOARD_SECRET` (any long random string) for score signing — no code changes needed.

Scores are validated server-side against the game's actual mechanics and deduped by run id so retries can't double-count. Impossible runs are rejected: distance can't exceed 10 m/s (a deliberately generous ceiling over the game's 9 m/s forward speed) over the run's wall-clock length, score − distance can't exceed what the reported grazes/power-ups/bosses could pay (≤200/graze, ≤50/pickup, +500/boss), combo is capped at ×10, and collection rates can't outpace the 4s power-up spawn timer. Before posting, the client dry-runs the run through `POST /api/score/check`; only a top-10-worthy score triggers the callsign prompt (Enter saves, Esc skips, prefilled from the cookie), and a confetti burst celebrates when the run lands on the board.

**Signed submissions** — at run start the client fetches a short-lived HMAC token (`POST /api/score/token`, stateless: a signed payload bound to the runId, 60-min expiry) and uses it as the key to sign the canonical run data (`crypto.subtle` HMAC-SHA256). `POST /api/score` rejects unsigned (401), tampered (401 — signature mismatch), expired or cross-run tokens (401), then runs the consistency validation on top. In production the signing key is `LEADERBOARD_SECRET`; without it, submissions fail closed rather than falling back to insecure.

### Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Start the dev server |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run lint` | ESLint |
| `npm test` | Vitest — 61 unit + API tests (scoring, validation, signing, physics, routes) |

**Procedural art generators** (no external assets — re-run to regenerate):

| Command | What it generates |
| --- | --- |
| `node scripts/generate-bosses.js` | Guardian sprites (asteroid, dying star, Neptune, sun, black hole) |
| `node scripts/generate-meteors.js` | The three belt meteor variants |
| `node scripts/generate-projectiles.js` | Rock / ice-shard / lava-ember projectiles |
| `node scripts/generate-og-image.js` | The 1200×630 social share card |
| `node scripts/generate-all.js` | All of the above + UPI QRs (manual — run if you regenerate art) |

**Test suite (Vitest)** — `npm test` runs 61 tests in under a second:

- `tests/scoring.test.ts` — the extracted scoring math (`lib/game/scoring.ts`): the progressive combo curve (combo 1 ≈ ×0.98 → combo 10 ≈ ×0.85, averaging ≈90%), graze/power-up/bolt/boss points, and the 9 m/s distance accrual
- `tests/validation.test.ts` — `validateScore` accepts plausible runs and rejects impossible ones: score < distance, >10.5 m/s, combo > ×10, zone inconsistent with distance, bonuses the stats can't pay, and out-of-range collection rates
- `tests/signing.test.ts` — HMAC token round-trip, tampered payload/signature/expired/cross-run rejection, and `canonicalRunData` key-order stability
- `tests/physics.test.ts` — meteor fall duration curve and the SSR reference-scale fallback
- `tests/api.test.ts` — the real route handlers against an isolated store: unsigned (401), tampered (401), expired/cross-run tokens (401), impossible signed runs (400), idempotent duplicates, and top-10 qualification checks. `LEADERBOARD_FILE` points the suite at `.data/test-leaderboard.json` so the real board is never touched
- `tests/kv-persistence.test.ts` — end-to-end proof the leaderboard persists through **Upstash Redis**: runs the real `/api/score` routes against a disk-backed mock of the Upstash REST API (Bearer-authenticated get/set/pipeline), asserts the file fallback is never touched when the `KV_REST_API_*` env vars are set, simulates a **cold start** (a brand-new module graph, same Redis disk) that still reads the same board, and verifies submissions fail cleanly (503) when the Redis token is wrong

## 🛠️ Tech stack

- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS 4
- MediaPipe Tasks Vision (hand landmark tracking)
- Tone.js 15 (procedural audio)
- js-cookie (high score / badges / tutorial persistence)

## 📁 Project structure

- `app/page.tsx` — composition layer only: renders the stage (rocket, meteors, particles, boss), HUD overlays, and controls by wiring state/refs from `useGameEngine` into JSX
- `hooks/useGameEngine.ts` — the whole game engine: rAF loop, meteor physics, collisions, bosses, missions, gestures, the state machine, the tutorial, and the leaderboard submit flow (token fetch → qualify check → signed post)
- `lib/game/` — focused, pure game modules: `constants.ts` (tunables incl. the responsive-scale reference), `types.ts` (shared types), `zones.ts` (themes + story chapters), `bosses.ts` (guardian styles/sprites/projectiles), `physics.ts` (fall model + viewport scaling helpers), `scoring.ts` (the score formulas the engine calls — combo curve, graze/power-up/bolt/boss points, distance accrual), `powerupColors.ts`, `sign.ts` (client HMAC)
- `app/api/score/route.ts` — leaderboard API: GET top-10, POST HMAC-verified score
- `app/api/score/check/route.ts` — dry-run top-10 qualification check (nothing persisted)
- `app/api/score/token/route.ts` — issues the short-lived per-run signing token
- `tests/` — the Vitest suite (scoring, validation, signing, physics, API routes); `vitest.config.ts` isolates the API tests behind `LEADERBOARD_FILE`
- `lib/leaderboard.ts` — score validation, HMAC signing/verification, persistence (Upstash Redis in prod, local JSON in dev, in-memory fallback on read-only filesystems)
- `components/` — `HandRecognizer`, `RocketComponent`, `BoulderComponent`, `Particle`, `Starfield`, `BossAccessory`, `TutorialOverlay`, `GameInfoOverlay`, `Leaderboard`, `ConfettiBurst`
- `scripts/` — procedural art generators (bosses, meteors, projectiles, OG card, UPI QRs) + `generate-all.js` (manual run if you need to regenerate art)
- `app/layout.tsx` — page metadata (title, description, Open Graph / Twitter cards); set `NEXT_PUBLIC_SITE_URL` to the deployed origin for correct absolute share URLs
- `utils/` — `audioHandler`, `badges`, `skins`
- `public/Images/` — game art

## 📦 VERSION 2.1.0.0 IS HERE — WHAT'S NEW?

This release rebuilds the game from a demo into a full arcade experience.

**Core engine**

- requestAnimationFrame game loop — physics, collisions, and particles run off React state on refs; boulders and the HUD are memoized; meteors despawn only when off-screen instead of on a timer
- Proper state machine: idle → tutorial → countdown → playing → paused → gameover, with auto-pause when the tab is hidden and a 3-2-1 start countdown
- Node.js 24 + upgraded stack: Next.js 16, React 19, Tailwind 4, ESLint 9

**Controls & UX**

- EMA tilt smoothing + a sensitivity slider for jitter-free hand steering
- New gestures: spread-hands dash, flat-palms shield, fists pause, both-fists tutorial skip — plus an on-screen gesture guide
- Camera permission-denied UI with retry, webcam stream released on unmount, audio unlocked on first interaction, and a mute toggle
- Fix: tilt can no longer move the rocket during the countdown or pause

**Content**

- 5 themed zones with recolored backgrounds and meteors every 500m
- Guardians at every zone boundary: a cinematic entrance (descent, impact flash, health-bar reveal), a signature attack per zone, and realistic procedural art (black hole, dying star, sun, Neptune, rough asteroid)
- Interactive first-play tutorial with hand-drawn callouts
- Near-miss graze combo (×10) and falling power-ups (shield, slow-mo, 2×, extra life)
- Mission arc: per-zone objectives, chapter celebrations with +500 rewards, and a journey log on the game-over screen
- Run stats + persistent unlockable badges
- Unlockable rocket skins (8 total) earned from badges and score milestones, shown on the in-game rocket, the lives HUD, and the idle screen

**Polish**

- Screen shake, explosion particles, a parallax starfield that speeds up with distance, an engine trail, and boss impact flashes
- Realistic procedurally generated projectile art (rock chunks, ice shards, molten embers) with element-matched debris on hits
- Responsive layout: viewport-based rocket position, scrollable overlays, wrapping badge rows
- **Screen-size fairness**: gameplay normalizes to a 1280×800 reference viewport — meteor density per unit width, tilt→steering speed, fall time (vertical speed scales with screen height) and sprite sizes all scale, and the rocket sits at a fixed 72% of screen height so reaction time never changes with window size. Realistic crash animation (layered debris burst, shockwave ring, gravity) and multi-layer engine trail with smoke puffs
- Serverless leaderboard: `/api/score` route with server-side validation and run-id dedupe, persistent via Upstash Redis (local JSON fallback). Only runs that crack the top-10 are recorded — the player is asked for a callsign first (pre-filled from a cookie), then the run is posted on confirm; non-qualifying runs are never stored. The board lives in a translucent floating window opened from a button on the idle/game-over screens — and it auto-opens (freshly reloaded, with a confetti burst) the moment a saved run lands (scrollbar-free HUD)
- HMAC-signed score submissions: short-lived per-run tokens (`/api/score/token`), client-side `crypto.subtle` signatures, and 401 rejection for unsigned, tampered, expired, or cross-run scores — with a `LEADERBOARD_SECRET` env key in production
- Reserve lives: hearts grabbed at max health bank up to 3 reserves (dimmed HUD icons) that absorb a hit before an active life is spent, with "+1 Life"/"+1 Reserve"/"Lives Full"/"Reserve!" feedback
- Top-10 flow polish: Enter-saves / Esc-skips callsign prompt, scale/fade leaderboard window animation with a subtle pulsing button glow, and a confetti burst on landing
- Branding & share: full Open Graph / Twitter metadata with a 1200×630 procedural share card (title, rocket, meteors, origin watermark)

**Balance & polish (latest)**

- Scoring is 10% harder across the board: distance ticks at 9 m/s instead of 10, grazes +9 base, power-ups +22, and the boss bonus 450 — with a **progressive combo curve** (combo 1 ≈ ×0.98 → combo 10 ≈ ×0.85) that concentrates the cut on deep streaks while protecting early grazes
- Realistic crash burst: layered debris with gravity, an expanding shockwave ring, and a rocket rattle (the `wiggle` animation was previously defined but never applied)
- Multi-layer engine trail: inner core, mid flame, and outer smoke puffs that grow as they age
- Dead-code cleanup: removed the unused `Inter` font, the dead `FALL_DISTANCE` constant, and a leftover probe marker; `.freebuff/` tool state is gitignored; the leaderboard store degrades gracefully to in-memory on read-only filesystems
- **Pinch-to-fire**: thumb+index pinch fires a bolt straight up (hold 0.5–1.7s to charge a bigger shot that hits harder and doubles meteor score). The shot meter fills only from grazes (+10) and dashes (+20) — never passively — and a 3-bolt cap in flight refreshes as shots resolve, so clearing your path by shooting alone is impossible; dodging stays the core skill. Bolts shatter meteors (+25/+50) and chip guardians (-10%/-22% HP)
- **Hand-driven menus**: a **single pointing forefinger** drives the glowing cursor (no palm companion required — either hand works, right preferred when both are visible). The fingertip moves the cursor with a fast EMA (≈33ms) and a **1.5× DPI gain** (the cursor moves farther than the hand, pivoting on the screen centre, so a small wrist motion sweeps the whole menu). **Pinch the pointed finger to click** (fist works too), spread goes back. Works on the idle, pause, and game-over screens — including Start Fresh, Play Again, leaderboard, skins, and save/skip. A hand-drawn icon strip on the idle screen (pointed finger → move cursor, pinch → click, spread → back) teaches the scheme before the player ever needs to pause, and the pause/game-over screens repeat the one-line hint. Pointing defers the run start — only both hands *without* pointing begin the countdown
- **Menu cursor assist + a real fix**: the cursor element is now pinned to the viewport origin (`left: 0; top: 0`) — previously a `fixed` element without them sat at its flex-layout static position (~screen centre), so the **visible cursor was displaced by half the viewport** from where it actually clicked (aiming on game-over felt broken). On top of the fix, buttons now **magnetically pull the cursor** within `MENU_SNAP_RADIUS` (150px, capped pull so it glides onto the target and turns amber with a pulsing glow — the "locked" state), and a pinch/fist confirm **forgivingly clicks the nearest enabled button** within `MENU_CLICK_GRACE` (140px) when the fingertip is slightly off. Hand-aimed navigation on the pause/game-over screens now lands every time
- **No more accidental menu clicks**: two false-input sources are closed. (1) A pointing hand curls its outer fingers, which made it pass the fist thresholds — pointing alone silently clicked buttons. Fists now require `indexExtended === false`, so a point pose (index out) can never read as a fist. (2) The menu pinch is judged against each hand's **rolling thumb-rest baseline** (`pointPinchRatio` 0.72): a thumb that naturally rests against the index no longer trips the click threshold — only a deliberate pinch (thumb swinging clearly closer) does. On the engine side, a pinch must be preceded by ≥3 cleanly-released frames before it can arm, and each click starts a 400ms cooldown, so threshold flicker can't machine-gun buttons either
- **Single-hand gestures**: a lone pinch fires (thumb+index with one hand while the other keeps steering), a lone flat palm raises the shield, and a lone spread dashes — and none of them pause the game. Dropping both hands still pauses
- **Warning-free `next/image` usage**: the guardian sprites and meteors pin both rendered dimensions explicitly. Tailwind v4's preflight `img { height: auto }` was silently resizing non-square sprites (the 1582×1600 asteroid sheet, the 1600×1553 meteor sheet) so the rendered height drifted from the width attribute — the exact condition Next's dev aspect-ratio check warns about — and the guardian also loads `eager` so it can't trip the LCP lazy-load warning. Console is clean through tutorial, boss fights, and normal play
- **Bruiser guardians**: the Asteroid Field and Lava Belt bosses are now the run's hardest fights. Both have more HP (+25% / +35% fight length), faster volleys (1.9s / 1.6s between attacks), denser patterns, and more aggressive movement — the asteroid drifts 25% wider, the lava guardian sways 30% faster
- **Aimed rock triplets**: the asteroid guardian now solves a true ballistic arc for each of its three rocks — velocity chosen so each gravity-affected rock lands on the rocket's current position. Small aim jitter and a ~2.8s floaty flight time (≈50% slower than the original pass) keep the volley dodgeable, but standing still means eating all three; it alternates the triplets with radial debris bursts
- **Faster bolt reload**: bolts travel 950 → 1250 px/s, so the 3-bolt ammo cap recycles about 25% sooner between shots
- **Dodge-feel pass**: the rocket steers ~10% more agile and belt meteors are ~25% smaller (50–80px → 38–60px on desktop), so dodging reads fairer on wide windows
- **Belt difficulty ramp**: the meteor swarm starts thin (~1–2 per spawn) and only thickens with distance (up to ~4–5 per spawn past 2000m) instead of spawning at full density from the first meter — and a **20% screen-coverage cap** guarantees the combined on-screen meteor area never exceeds a fifth of the viewport, however deep the run gets
- **Frost now hurts**: every unshielded ice shard chills your steering, and the second one freezes the hull solid — a frosty crash that costs a life (the freeze counter resets on any life loss, and a shield absorbs the hit including the counter)
- **Haptic menu feedback**: every menu click (pinch or fist confirm) pops the cursor with a quick scale + glow pulse (a CSS `scale` animation that composes with the positioning transform instead of fighting it) and plays a short synthesized membrane-synth "tock" — so confirms land with feedback even when you're not looking at the button
