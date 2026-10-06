/* ROUND ONE — pure logic: loadable weights, slot resolution, progression, XP.
 * No DOM access in here so it can be unit-tested with plain node. */
(function (root) {
  'use strict';
  const FW = (root.FW = root.FW || {});
  const r2 = (n) => Math.round(n * 100) / 100;

  // ---------- gear -> capabilities ----------
  function handWeights(g, minCount, implement) {
    const out = new Set();
    const add = (list) => (list || []).forEach((i) => { if (i.n >= minCount && i.w > 0) out.add(r2(i.w)); });
    if (implement !== 'kettlebell') add(g.dumbbells);
    if (implement !== 'dumbbell') add(g.kettlebells);
    return [...out].sort((a, b) => a - b);
  }

  function capabilities(g) {
    const c = new Set();
    if (g.barbell && g.barbell.has) c.add('barbell');
    ['rack', 'bench', 'pullupbar', 'bands', 'cable', 'dipbars', 'abwheel'].forEach((k) => { if (g[k]) c.add(k); });
    if (handWeights(g, 1).length) c.add('hand');
    if (handWeights(g, 2).length) c.add('hand2');
    if (handWeights(g, 1, 'kettlebell').length) c.add('kettlebell');
    return c;
  }

  // ---------- barbell loading ----------
  function barbellLoads(g) {
    const bar = g.barbell && g.barbell.has ? g.barbell.weight || 25 : 0;
    let sums = new Set([0]);
    (g.plates || []).forEach((p) => {
      const perSide = Math.floor(p.n / 2);
      for (let i = 0; i < perSide; i++) {
        const next = new Set(sums);
        sums.forEach((s) => next.add(r2(s + p.w)));
        sums = next;
      }
    });
    return [...sums].map((s) => r2(bar + 2 * s)).sort((a, b) => a - b);
  }

  /** Plates to put on EACH side for a total bar weight, e.g. [25, 10, 5]. */
  function plateLoadout(g, total) {
    const bar = g.barbell && g.barbell.weight ? g.barbell.weight : 25;
    const target = r2((total - bar) / 2);
    if (target < 0) return null;
    const plates = (g.plates || [])
      .map((p) => ({ w: p.w, cnt: Math.floor(p.n / 2) }))
      .filter((p) => p.cnt > 0)
      .sort((a, b) => b.w - a.w);
    function dfs(i, rem) {
      if (Math.abs(rem) < 1e-6) return [];
      if (i >= plates.length) return null;
      const p = plates[i];
      const maxK = Math.min(p.cnt, Math.floor(rem / p.w + 1e-9));
      for (let k = maxK; k >= 0; k--) {
        const rest = dfs(i + 1, r2(rem - k * p.w));
        if (rest) return Array(k).fill(p.w).concat(rest);
      }
      return null;
    }
    return dfs(0, target);
  }

  function loadsFor(ex, g) {
    if (ex.load === 'barbell') return barbellLoads(g);
    if (ex.load === 'hand') return handWeights(g, ex.needs.includes('hand2') ? 2 : 1, ex.implement || 'any');
    return [0];
  }

  // ---------- load stepping ----------
  const hasLoad = (ex) => ex.load === 'barbell' || ex.load === 'hand';
  function idxAtOrBelow(loads, w) {
    let i = 0;
    for (let k = 0; k < loads.length; k++) if (loads[k] <= w + 1e-9) i = k;
    return i;
  }
  function nearest(loads, w) {
    let best = loads[0];
    loads.forEach((l) => { if (Math.abs(l - w) < Math.abs(best - w) - 1e-9) best = l; });
    return best;
  }
  function stepUp(loads, w, steps) {
    const i = idxAtOrBelow(loads, w);
    if (i >= loads.length - 1) return null;
    return loads[Math.min(loads.length - 1, i + (steps || 1))];
  }
  function stepDown(loads, w, steps) {
    return loads[Math.max(0, idxAtOrBelow(loads, w) - (steps || 1))];
  }
  /** Move one loadable step from any weight (used by the +/- buttons). */
  function stepFrom(loads, w, dir) {
    if (!loads.length) return w;
    if (dir > 0) {
      const nx = loads.find((l) => l > w + 1e-9);
      return nx === undefined ? w : nx;
    }
    for (let k = loads.length - 1; k >= 0; k--) if (loads[k] < w - 1e-9) return loads[k];
    return w;
  }

  function startWeight(ex, loads) {
    if (!hasLoad(ex)) return 0;
    if (!loads.length) return 0;
    if (ex.load === 'barbell') return nearest(loads, ex.start || loads[0]);
    return ex.start === 'max' ? loads[loads.length - 1] : loads[0];
  }

  // ---------- slots / workouts ----------
  function available(exId, caps) {
    const ex = FW.EXERCISES[exId];
    return !!ex && ex.needs.every((n) => caps.has(n));
  }
  const kneeLevel = (id) => FW.EXERCISES[id].knee || 0;
  /** Gear-available options for a slot. Knee-friendly mode drops "avoid" moves and puts the gentlest first. */
  function slotOptions(slotKey, caps, knee) {
    let o = FW.SLOTS[slotKey].opts.filter((id) => available(id, caps));
    if (knee) {
      o = o.filter((id) => kneeLevel(id) < 2)
        .map((id, i) => ({ id, i }))
        .sort((a, b) => kneeLevel(a.id) - kneeLevel(b.id) || a.i - b.i)
        .map((x) => x.id);
    }
    return o;
  }
  function slotChoice(slotKey, caps, pins, knee) {
    const opts = slotOptions(slotKey, caps, knee);
    if (pins && pins[slotKey] && opts.includes(pins[slotKey])) return pins[slotKey];
    return opts[0] || null;
  }
  function buildWorkout(key, caps, pins, knee) {
    return FW.WORKOUTS[key].slots
      .map((slotKey) => ({ slotKey, exId: slotChoice(slotKey, caps, pins, knee) }))
      .filter((s) => s.exId);
  }
  function availableExercises(caps) {
    return Object.keys(FW.EXERCISES).filter((id) => available(id, caps));
  }
  function missingFor(exId, caps) {
    return FW.EXERCISES[exId].needs.filter((n) => !caps.has(n));
  }

  // ---------- progression ----------
  function ceilingFor(ex, p, loads, w) {
    const hi = ex.reps[1] + ((p && p.extra) || 0);
    if (hasLoad(ex)) {
      const nx = stepUp(loads, w, 1);
      if (nx) {
        const ratio = (nx - w) / Math.max(w, 1);
        return hi + (ratio > 0.2 ? 4 : ratio > 0.1 ? 2 : 0);
      }
    }
    return hi;
  }

  function daysSince(ts, now) {
    return ts ? ((now || Date.now()) - ts) / 86400000 : 0;
  }

  /** What to put in the set rows for this exercise next time. */
  function targetFor(exId, state, now) {
    const ex = FW.EXERCISES[exId];
    const loads = loadsFor(ex, state.gear);
    const p = state.prog[exId];
    const ramp = state.settings.ramp && state.sessions.length < 6;
    const sets = ramp ? Math.max(2, ex.sets - 1) : ex.sets;
    const res = { sets, w: 0, reps: Math.round((ex.reps[0] + ex.reps[1]) / 2), loads, note: '', isNew: !p, ceiling: ex.reps[1] };
    if (ex.load === 'time') res.reps = ex.reps[0];
    if (hasLoad(ex)) {
      if (!loads.length) return res;
      if (!p) {
        res.w = startWeight(ex, loads);
        res.note = 'FIND YOUR WEIGHT: leave 2-3 reps in the tank';
      } else {
        let w = nearest(loads, p.w);
        res.reps = p.reps;
        if (daysSince(p.lastTs, now) >= 21) {
          w = loads[idxAtOrBelow(loads, w * 0.9)];
          res.note = 'WELCOME BACK: eased off ~10%';
        }
        res.w = w;
      }
    } else if (p) {
      res.reps = p.reps;
    }
    if (p) res.ceiling = ceilingFor(ex, p, loads, res.w);
    return res;
  }

  /** Update progression state from a finished exercise. Returns {prog, note}. */
  function applyProgression(exId, prevProg, sets, ctx) {
    const ex = FW.EXERCISES[exId];
    const done = sets.filter((s) => s.done && s.r > 0);
    if (!done.length) return null;
    const loads = loadsFor(ex, ctx.gear);
    const p = Object.assign({ w: 0, reps: ex.reps[0], extra: 0, fails: 0, capped: false, n: 0 }, prevProg || {});
    const w = hasLoad(ex) ? done[0].w : 0;
    const minReps = Math.min(...done.map((s) => s.r));
    const lo = ex.reps[0];
    const full = done.length >= (ctx.targetSets || ex.sets);
    const feel = ctx.feel || 'good';
    const ceil = ceilingFor(ex, p, loads, w);
    const isTime = ex.load === 'time';
    let note = '';

    p.n += 1;
    p.lastTs = ctx.now || Date.now();
    p.w = w;
    p.capped = false;

    if (minReps >= ceil && full) {
      p.fails = 0;
      if (feel === 'hard') {
        p.reps = minReps;
        note = 'HELD: you called it hard';
      } else if (hasLoad(ex)) {
        const nx = stepUp(loads, w, feel === 'easy' ? 2 : 1);
        if (nx) {
          p.w = nx;
          p.reps = lo;
          note = 'LOAD UP -> ' + nx + 'kg';
        } else {
          p.extra = Math.min((p.extra || 0) + 2, ex.reps[1]);
          p.reps = minReps;
          p.capped = true;
          note = 'MAXED OUT your gear: more reps for now';
        }
      } else {
        const inc = isTime ? 10 : 2;
        p.extra = Math.min((p.extra || 0) + inc, ex.reps[1]);
        p.reps = minReps;
        p.capped = p.extra >= ex.reps[1];
        note = (isTime ? 'LONGER HOLDS -> ' : 'NEW REP CEILING -> ') + (ex.reps[1] + p.extra);
      }
    } else if (minReps < lo || (feel === 'hard' && minReps < ceil && minReps <= lo)) {
      p.fails += 1;
      p.reps = lo;
      if (p.fails >= 2 && hasLoad(ex)) {
        p.w = stepDown(loads, w, 1);
        p.fails = 0;
        note = 'RESET -> ' + p.w + 'kg, rebuild from there';
      } else {
        note = 'REPEAT this weight';
      }
    } else {
      p.fails = 0;
      p.reps = feel === 'hard' ? minReps : Math.min(ceil, minReps + (isTime ? 5 : 1));
      note = 'KEEP GOING: aim for ' + p.reps + (isTime ? 's' : ' reps');
    }
    return { prog: p, note };
  }

  // ---------- stats ----------
  const e1rm = (w, r) => (!w ? 0 : r <= 1 ? w : w * (1 + r / 30));

  function levelInfo(xp) {
    let lvl = 1, need = 100, rem = xp;
    while (rem >= need) { rem -= need; lvl++; need = Math.round(need * 1.25); }
    return { lvl, rem, need };
  }
  const TITLES = ['ROOKIE', 'SCRAPPER', 'BRAWLER', 'FIGHTER', 'WARRIOR', 'VETERAN', 'CHAMPION', 'MASTER', 'GRANDMASTER', 'LEGEND'];
  const titleFor = (lvl) => TITLES[Math.min(TITLES.length - 1, Math.floor((lvl - 1) / 2))];

  function weekStart(d) {
    const x = new Date(d);
    x.setHours(0, 0, 0, 0);
    x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
    return x.getTime();
  }
  function sessionsThisWeek(sessions, now) {
    const ws = weekStart(now || Date.now());
    return sessions.filter((s) => s.endedAt >= ws).length;
  }
  /** Consecutive finished weeks where the goal was met (current week counts once met). */
  function weekStreak(sessions, goal, now) {
    const counts = {};
    sessions.forEach((s) => { const k = weekStart(s.endedAt); counts[k] = (counts[k] || 0) + 1; });
    const cur = weekStart(now || Date.now());
    let streak = 0;
    let k = cur;
    if ((counts[k] || 0) >= goal) streak++;
    k -= 7 * 86400000;
    // weekStart uses local midnight, so recompute via Date to be DST-safe
    for (;;) {
      const key = weekStart(k + 3600000 * 12);
      if ((counts[key] || 0) >= goal) { streak++; k = key - 7 * 86400000; } else break;
    }
    return streak;
  }

  Object.assign(FW, {
    capabilities, handWeights, barbellLoads, plateLoadout, loadsFor, hasLoad, nearest, stepUp, stepDown, stepFrom,
    startWeight, available, slotOptions, slotChoice, buildWorkout, availableExercises, missingFor,
    targetFor, applyProgression, ceilingFor, e1rm, levelInfo, titleFor, weekStart, sessionsThisWeek, weekStreak, r2,
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = FW;
})(typeof window !== 'undefined' ? window : globalThis);
