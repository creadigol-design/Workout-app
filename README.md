# ROUND ONE — 8-bit workout planner & tracker

A mobile-first PWA in an arcade-fighter style. No build step, no backend, works offline once loaded.
All data stays on the device (localStorage for logs, IndexedDB for set photos).

## Run it
Serve the folder over HTTP (service worker + camera need it), e.g. `npx http-server -c-1 .`, or enable
**GitHub Pages** (Settings → Pages → deploy from branch, root) and open the URL on your phone → *Add to Home Screen*.

## What v1 does
- **Base plan**: 2 full-body workouts (A/B) that alternate, built from the gear you own. Tuned for muscle gain + fat loss
  (8-12 rep ranges, short finisher each session). Default bar is 25kg.
- **Knee-friendly mode** (on by default): box squats instead of back squats, single-leg hinges instead of split squats/lunges.
  Not medical advice, stop any move that hurts.
- **Auto-progression** (double progression): hit the top of the rep range on every set → next load your plates/weights allow.
  EASY = 2 steps, HARD = hold, two misses = back off a step, 3+ weeks away = ease off ~10%. Coarse plate jumps (10kg total) get a
  higher rep ceiling before stepping up. Gear maxed out → rep ceiling rises and the app tips you to buy heavier weights.
- **Gear tab**: plates, dumbbells, kettlebells, bar weight, rack, bench, pull-up bar, bands, etc. New gear unlocks new moves and
  swaps them into the plan automatically.
- **Set tracking**: weight/reps per set, rest timer, PR detection, XP / levels, weekly goal, history and charts.
- **Photos**: tap the camera on any set; photos are compressed and stored locally, browse them in LOG → PHOTOS.
- **Body tab**: weigh-ins (+ optional waist), goal weight, 7-day average, trend chart, front/side/back progress photos and a
  before/after comparison.
- **Phone lock (commitment contract)**: a web app cannot lock iOS. Set training days + a lock time, name an accountability partner,
  and the app shows LOCKED / UNLOCKED status and texts them a proof message after each workout. The real lock is iOS Screen Time
  (Downtime on training days, partner holds the passcode); setup steps are in the app.
- **Backup**: export/import JSON (photos included) from Settings.
- **FOOD** tab is a locked placeholder for v2 (`state.food` is already reserved).

## Layout
`js/data.js` exercise library & slots · `js/engine.js` pure logic (tested) · `js/store.js` persistence ·
`js/app.js` UI · `js/sprites.js` pixel art · `tests/engine.test.js` (`node tests/engine.test.js`).

Fonts: Press Start 2P and VT323 (SIL Open Font License), self-hosted in `fonts/`.
