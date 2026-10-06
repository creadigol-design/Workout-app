/* ROUND ONE — UI + app flow. */
(function () {
  'use strict';
  const FW = window.FW;
  const EX = FW.EXERCISES;
  const SP = FW.sprites;
  const $ = (s) => document.querySelector(s);

  let S = FW.store.load();
  let caps = FW.capabilities(S.gear);
  const ui = {
    view: S.onboarded ? 'tabs' : 'onboard', tab: 'home', logTab: 'history', chartEx: null, openHist: null,
    onbStep: 0, ko: null, cue: {}, settings: false, viewer: null, photos: [], onb: { name: 'PLAYER 1', days: 3, barbell: true, bar: 20, ramp: true },
  };
  if (S.active) ui.resumeAvailable = true;
  let rest = null;
  let wakeLock = null;
  let pendingPhoto = null;
  let toastTimer = null;

  // ---------- helpers ----------
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  const n2 = (x) => String(Math.round(x * 100) / 100);
  const mmss = (sec) => { sec = Math.max(0, Math.round(sec)); return Math.floor(sec / 60) + ':' + String(sec % 60).padStart(2, '0'); };
  const save = () => FW.store.save(S);
  const recaps = () => { caps = FW.capabilities(S.gear); };
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const fmtDate = (ts) => new Date(ts).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });

  function toast(msg, kind, ms) {
    const t = $('#toast');
    t.textContent = msg;
    t.className = 'toast ' + (kind || '');
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.hidden = true; }, ms || 2600);
  }

  function exIcon(exId) {
    const ex = EX[exId];
    if (ex.load === 'barbell') return 'barbell';
    if (ex.load === 'hand') return ex.implement === 'kettlebell' ? 'kettlebell' : 'dumbbell';
    if (ex.needs.includes('pullupbar')) return 'pullup';
    if (ex.needs.includes('bands')) return 'bands';
    if (ex.needs.includes('abwheel')) return 'wheel';
    return 'fist';
  }

  const nextKey = () => {
    const last = S.sessions[S.sessions.length - 1];
    return !last || last.key === 'B' ? 'A' : 'B';
  };

  function setCounts(a) {
    let total = 0, done = 0;
    a.exercises.forEach((e) => { if (e.skipped) return; total += e.sets.length; done += e.sets.filter((s) => s.done).length; });
    return { total, done };
  }

  function targetText(exId, t) {
    const ex = EX[exId];
    const unit = ex.load === 'time' ? 's' : '';
    const per = ex.perSide ? '/side' : '';
    const wt = FW.hasLoad(ex) ? ' @ ' + n2(t.w) + 'kg' + (ex.load === 'hand' ? ' ea' : '') : '';
    return t.sets + ' × ' + t.reps + unit + per + wt;
  }

  function lastText(exId) {
    for (let i = S.sessions.length - 1; i >= 0; i--) {
      const e = S.sessions[i].exercises.find((x) => x.exId === exId);
      if (e && e.sets.length) {
        const ex = EX[exId];
        if (!FW.hasLoad(ex)) return e.sets.map((s) => s.r).join(' · ') + (ex.load === 'time' ? 's' : '');
        const same = e.sets.every((s) => s.w === e.sets[0].w);
        return same ? n2(e.sets[0].w) + 'kg × ' + e.sets.map((s) => s.r).join(' · ') : e.sets.map((s) => n2(s.w) + '×' + s.r).join(' · ');
      }
    }
    return '';
  }

  function bestMetric(exId, upToActive) {
    const ex = EX[exId];
    const metric = (s) => (FW.hasLoad(ex) ? FW.e1rm(s.w, s.r) : s.r);
    let best = 0;
    S.sessions.forEach((ss) => ss.exercises.forEach((e) => { if (e.exId === exId) e.sets.forEach((s) => { best = Math.max(best, metric(s)); }); }));
    if (upToActive && S.active) S.active.exercises.forEach((e) => { if (e.exId === exId) e.sets.forEach((s) => { if (s.done) best = Math.max(best, metric(s)); }); });
    return best;
  }

  function totalSetsAllTime() { return S.sessions.reduce((a, s) => a + s.sets, 0); }
  function totalVolume() { return S.sessions.reduce((a, s) => a + (s.vol || 0), 0); }

  // ---------- workout construction ----------
  function makeExercise(slotKey, exId) {
    const t = FW.targetFor(exId, S, Date.now());
    return {
      slotKey, exId, feel: 'good', skipped: false, targetSets: t.sets, note: t.note, ceiling: t.ceiling,
      sets: Array.from({ length: t.sets }, () => ({ w: t.w, r: t.reps, done: false, photos: [] })),
    };
  }

  function startWorkout(key) {
    const list = FW.buildWorkout(key, caps, S.slotPins);
    S.active = { id: uid(), key, name: FW.WORKOUTS[key].name, startedAt: Date.now(), exercises: list.map((s) => makeExercise(s.slotKey, s.exId)) };
    ui.view = 'workout';
    ui.cue = {};
    rest = null;
    save();
    keepAwake();
    FW.sfx('coin');
    render();
    window.scrollTo(0, 0);
  }

  async function keepAwake() {
    try { if ('wakeLock' in navigator && !wakeLock) { wakeLock = await navigator.wakeLock.request('screen'); wakeLock.addEventListener('release', () => { wakeLock = null; }); } } catch (e) { /* not available */ }
  }
  function letSleep() { try { if (wakeLock) wakeLock.release(); } catch (e) { /* ignore */ } wakeLock = null; }

  function startRest(sec) {
    rest = { end: Date.now() + sec * 1000, total: sec };
    renderDock();
  }

  // ---------- HUD ----------
  function hud() {
    const lv = FW.levelInfo(S.xp);
    const name = esc(S.profile.name.slice(0, 10));
    let p1pct, p2pct, centerTop, centerSub, p1r, p2l;
    if (ui.view === 'workout' && S.active) {
      const c = setCounts(S.active);
      p1pct = c.total ? (c.done / c.total) * 100 : 0;
      p2pct = 100 - p1pct;
      centerTop = '<span id="elapsed">' + mmss((Date.now() - S.active.startedAt) / 1000) + '</span>';
      centerSub = 'TIME';
      p1r = c.done + '/' + c.total;
      p2l = 'THE IRON';
    } else {
      const wk = FW.sessionsThisWeek(S.sessions);
      p1pct = (lv.rem / lv.need) * 100;
      p2pct = Math.max(0, 100 - (wk / S.profile.goalDays) * 100);
      centerTop = String(Math.min(99, S.sessions.length + 1)).padStart(2, '0');
      centerSub = 'ROUND';
      p1r = 'LV ' + lv.lvl;
      p2l = 'WEEK BOSS';
    }
    return '<div class="hud">' +
      '<div class="side p1"><div class="name"><b>1P ' + name + '</b><span>' + p1r + '</span></div><div class="bar"><i style="width:' + p1pct + '%"></i></div></div>' +
      '<div class="timer">' + centerTop + '<small>' + centerSub + '</small></div>' +
      '<div class="side p2"><div class="name"><b>' + p2l + '</b></div><div class="bar red"><i style="width:' + p2pct + '%"></i></div></div></div>';
  }

  // ---------- tabs ----------
  const TABS = [['home', 'FIGHT', 'fist'], ['plan', 'PLAN', 'star'], ['gear', 'GEAR', 'barbell'], ['log', 'LOG', 'trophy'], ['food', 'FOOD', 'lock']];
  function tabsHtml() {
    return TABS.map((t) => '<button class="tab ' + (ui.tab === t[0] ? 'on' : '') + '" data-act="tab" data-tab="' + t[0] + '">' + SP.icon(t[2], 2) + '<span>' + t[1] + '</span></button>').join('');
  }

  // ---------- HOME ----------
  function homeHtml() {
    const key = nextKey();
    const W = FW.WORKOUTS[key];
    const list = FW.buildWorkout(key, caps, S.slotPins);
    const lv = FW.levelInfo(S.xp);
    const wk = FW.sessionsThisWeek(S.sessions);
    const goal = S.profile.goalDays;
    const streak = FW.weekStreak(S.sessions, goal);
    const last = S.sessions[S.sessions.length - 1];
    const resume = S.active;
    const rows = list.map((s) => {
      const t = FW.targetFor(s.exId, S, Date.now());
      return '<li><span>' + esc(EX[s.exId].name) + '</span><span>' + esc(targetText(s.exId, t)) + '</span></li>';
    }).join('');
    const hearts = Array.from({ length: goal }, (_, i) => '<img class="px ' + (i < wk ? '' : 'off') + '" src="' + SP.iconUrl('heart', 3) + '" alt="">').join('');
    return '' +
      '<div class="logo"><span class="l1">ROUND</span><span class="l2">ONE</span></div>' +
      '<div class="tag">FIGHT FOR YOUR FITNESS</div>' +
      '<div class="box hot"><h2>' + (resume ? 'FIGHT IN PROGRESS' : 'NEXT FIGHT') + '<small>ROUND ' + (S.sessions.length + 1) + '</small></h2>' +
      '<div class="fight"><div class="portrait ' + (resume ? '' : 'bob') + '"><img class="px" alt="" src="' + SP.fighterUrl(resume ? FW.WORKOUTS[resume.key].fighter : W.fighter) + '"></div>' +
      '<div><div class="vs">YOU VS THE IRON</div><div class="wname">' + (resume ? esc(resume.name) : W.name) + '</div>' +
      '<div class="muted">' + (resume ? setCounts(resume).done + ' of ' + setCounts(resume).total + ' sets done' : W.sub) + '</div></div></div>' +
      (resume ? '' : '<ul class="mini-list">' + rows + '</ul>') +
      '<div class="gap">' + (resume
        ? '<button class="btn block" data-act="resume">RESUME FIGHT</button><div class="spacer"></div><button class="btn block ghost small" data-act="abandon">DISCARD</button>'
        : '<button class="btn block red blink" data-act="start" data-key="' + key + '">PRESS START</button>') + '</div></div>' +
      '<div class="stats">' +
      '<div class="stat"><div class="k">LEVEL</div><div class="v">' + lv.lvl + '</div><div class="s">' + FW.titleFor(lv.lvl) + ' · ' + lv.rem + '/' + lv.need + ' XP</div></div>' +
      '<div class="stat"><div class="k">THIS WEEK</div><div class="v">' + wk + '/' + goal + '</div><div class="hearts">' + hearts + '</div></div>' +
      '<div class="stat"><div class="k">WIN STREAK</div><div class="v">' + SP.icon('flame', 2) + ' ' + streak + '</div><div class="s">weeks on goal</div></div>' +
      '<div class="stat"><div class="k">TOTAL SETS</div><div class="v">' + totalSetsAllTime() + '</div><div class="s">' + n2(Math.round(totalVolume() / 100) / 10) + ' tonnes lifted</div></div>' +
      '</div><div class="spacer"></div>' +
      (last ? '<div class="box flat"><h2>LAST FIGHT</h2><div class="row between"><span>' + esc(last.name) + '</span><span class="muted">' + fmtDate(last.endedAt) + '</span></div><div class="muted">' + last.sets + ' sets · ' + mmss((last.endedAt - last.startedAt) / 1000) + ' · +' + last.xp + ' XP</div></div>' : '') +
      '<button class="box flat block center" style="width:100%;color:inherit" data-act="tab" data-tab="food"><div class="row" style="justify-content:center">' + SP.icon('lock', 3) + '<span class="pix" style="font-size:9px">FOOD TRACKING · COMING IN V2</span></div></button>';
  }

  // ---------- WORKOUT ----------
  function loadoutHtml(ex, w) {
    if (ex.load !== 'barbell') return '';
    const bar = S.gear.barbell.weight || 20;
    const plates = FW.plateLoadout(S.gear, w);
    const txt = plates === null ? 'cannot make ' + n2(w) + 'kg with your plates' : plates.length ? plates.map(n2).join(' + ') + ' each side' : 'just the bar';
    return '<div class="loadout">LOAD <b>' + n2(w) + 'kg</b> = ' + n2(bar) + 'kg bar · ' + txt + '</div>';
  }

  function workoutHtml() {
    const a = S.active;
    if (!a) return '';
    const c = setCounts(a);
    const cards = a.exercises.map((e, ei) => exerciseCard(e, ei)).join('');
    return '' +
      '<div class="wk-head"><div><div class="pix" style="font-size:12px;color:var(--yellow)">' + esc(a.name) + '</div><div class="muted">' + FW.WORKOUTS[a.key].sub + '</div></div>' +
      '<button class="btn small" data-act="finish">FINISH</button></div>' + cards +
      '<button class="btn block red" data-act="finish">' + (c.done === c.total ? 'K.O.! FINISH' : 'FINISH FIGHT') + '</button>' +
      '<div class="spacer"></div><button class="btn block ghost small" data-act="abandon">ABANDON WORKOUT</button>';
  }

  function exerciseCard(e, ei) {
    const ex = EX[e.exId];
    const loaded = FW.hasLoad(ex);
    const isTime = ex.load === 'time';
    const last = lastText(e.exId);
    const slot = FW.SLOTS[e.slotKey];
    const anyDone = e.sets.some((s) => s.done);
    const canSwap = !anyDone && FW.slotOptions(e.slotKey, caps).length > 1;
    const w0 = e.sets[0] ? e.sets[0].w : 0;
    const setRows = e.sets.map((s, si) => {
      const photos = s.photos || [];
      return '<div class="set ' + (loaded ? '' : 'nowt') + (s.done ? ' done' : '') + (s.pr ? ' pr' : '') + '" data-ei="' + ei + '" data-si="' + si + '">' +
        '<div class="n">' + (si + 1) + '</div>' +
        (loaded ? '<div class="field"><button data-act="wstep" data-dir="-1" data-ei="' + ei + '" data-si="' + si + '">-</button><label><input type="number" inputmode="decimal" step="any" data-bind="w" data-ei="' + ei + '" data-si="' + si + '" value="' + n2(s.w) + '"><small>KG' + (ex.load === 'hand' ? ' EA' : '') + '</small></label><button data-act="wstep" data-dir="1" data-ei="' + ei + '" data-si="' + si + '">+</button></div>' : '') +
        '<div class="field"><button data-act="rstep" data-dir="-1" data-ei="' + ei + '" data-si="' + si + '">-</button><label><input type="number" inputmode="numeric" data-bind="r" data-ei="' + ei + '" data-si="' + si + '" value="' + s.r + '"><small>' + (isTime ? 'SEC' : 'REPS') + '</small></label><button data-act="rstep" data-dir="1" data-ei="' + ei + '" data-si="' + si + '">+</button></div>' +
        '<button class="chk" data-act="toggleSet" data-ei="' + ei + '" data-si="' + si + '" aria-label="Set done">' + (s.done ? '✓' : '○') + '</button>' +
        '<button class="cam" data-act="photo" data-ei="' + ei + '" data-si="' + si + '" aria-label="Take photo">' + SP.icon('camera', 2) + (photos.length ? '<span class="cnt">' + photos.length + '</span>' : '') + '</button>' +
        '</div>' +
        (photos.length ? '<div class="thumbs">' + photos.map((id) => '<img data-photo="' + id + '" data-act="viewPhoto" data-id="' + id + '" alt="set photo">').join('') + '</div>' : '');
    }).join('');
    return '<div class="box ex ' + (e.skipped ? 'skipped' : '') + '">' +
      '<div class="ex-head"><div class="ex-ico">' + SP.icon(exIcon(e.exId), 3) + '</div>' +
      '<div class="grow"><div class="ex-name">' + esc(ex.name) + '</div><div class="ex-sub">' + slot.label + ' · ' + e.targetSets + ' × ' + ex.reps[0] + '–' + ex.reps[1] + (isTime ? 's' : '') + (ex.perSide ? '/side' : '') + '</div></div>' +
      (canSwap ? '<button class="icon-btn" data-act="swap" data-ei="' + ei + '" aria-label="Swap exercise">⇄</button>' : '') +
      '<button class="icon-btn" data-act="info" data-ei="' + ei + '" aria-label="How to">?</button></div>' +
      (ui.cue[ei] ? '<div class="cue">' + esc(ex.cue) + '</div>' : '') +
      (loaded ? loadoutHtml(ex, w0) : '') +
      (e.note ? '<div class="note">★ ' + esc(e.note) + '</div>' : '') +
      (last ? '<div class="last">LAST: ' + esc(last) + '</div>' : '') +
      (e.skipped ? '<div class="note">SKIPPED</div>' : '<div class="sets">' + setRows + '</div>') +
      '<div class="ex-foot">' +
      (e.skipped ? '<button class="btn small ghost" data-act="skip" data-ei="' + ei + '">UNSKIP</button>' :
        '<button class="btn small ghost" data-act="addSet" data-ei="' + ei + '">+SET</button>' +
        (e.sets.length > 1 ? '<button class="btn small ghost" data-act="delSet" data-ei="' + ei + '">-SET</button>' : '') +
        (!anyDone ? '<button class="btn small ghost" data-act="skip" data-ei="' + ei + '">SKIP</button>' : '') +
        '<div class="feel"><span class="lbl">FELT</span>' + ['easy', 'good', 'hard'].map((f) => '<button class="chip ' + f + (e.feel === f ? ' on' : '') + '" data-act="feel" data-ei="' + ei + '" data-f="' + f + '">' + f.toUpperCase() + '</button>').join('') + '</div>') +
      '</div></div>';
  }

  function renderDock() {
    const d = $('#dock');
    if (ui.view !== 'workout' || !rest) { d.innerHTML = ''; return; }
    d.innerHTML = '<div class="rest"><div class="t" id="restT">' + mmss((rest.end - Date.now()) / 1000) + '</div><div class="bar blue"><i id="restBar"></i></div>' +
      '<button class="btn small ghost" data-act="restAdd">+30</button><button class="btn small red" data-act="restSkip">GO</button></div>';
    tick();
  }

  function tick() {
    const el = $('#elapsed');
    if (el && S.active) el.textContent = mmss((Date.now() - S.active.startedAt) / 1000);
    if (rest) {
      const left = (rest.end - Date.now()) / 1000;
      if (left <= 0) {
        rest = null;
        FW.sfx('rest');
        try { navigator.vibrate && navigator.vibrate([200, 100, 200]); } catch (e) { /* ignore */ }
        renderDock();
        toast('FIGHT! REST OVER', 'good', 1800);
      } else {
        const t = $('#restT'), b = $('#restBar');
        if (t) t.textContent = mmss(left);
        if (b) b.style.width = (left / rest.total) * 100 + '%';
      }
    }
  }

  // ---------- finish ----------
  function finishWorkout() {
    const a = S.active;
    if (!a) return;
    const c = setCounts(a);
    if (!c.done) {
      if (confirm('No sets logged. Discard this workout?')) abandon(true);
      return;
    }
    if (c.done < c.total && !confirm((c.total - c.done) + ' set(s) not done. Finish anyway?')) return;
    const now = Date.now();
    const notes = [], exs = [];
    let vol = 0, sets = 0, xp = 0, prCount = 0;
    a.exercises.forEach((e) => {
      if (e.skipped) return;
      const doneS = e.sets.filter((s) => s.done);
      if (!doneS.length) return;
      const ex = EX[e.exId];
      const res = FW.applyProgression(e.exId, S.prog[e.exId], e.sets, { gear: S.gear, feel: e.feel, targetSets: e.targetSets, now });
      if (res) { S.prog[e.exId] = res.prog; notes.push({ name: ex.name, note: res.note }); }
      doneS.forEach((s) => { sets++; xp += 10 + (s.pr ? 10 : 0); if (s.pr) prCount++; if (FW.hasLoad(ex)) vol += s.w * s.r; });
      exs.push({ exId: e.exId, slotKey: e.slotKey, name: ex.name, load: ex.load, feel: e.feel,
        sets: doneS.map((s) => ({ w: s.w, r: s.r, photos: s.photos || [], pr: !!s.pr })) });
    });
    if (c.done >= c.total * 0.5) xp += 25;
    const before = FW.levelInfo(S.xp).lvl;
    S.xp += xp;
    const after = FW.levelInfo(S.xp).lvl;
    const session = { id: a.id, key: a.key, name: a.name, startedAt: a.startedAt, endedAt: now, exercises: exs, sets, vol: Math.round(vol), xp };
    S.sessions.push(session);
    S.active = null;
    rest = null;
    letSleep();
    save();
    FW.store.saveNow(S);
    ui.ko = { session, notes, levelUp: after > before ? after : 0, perfect: c.done === c.total, prCount };
    ui.view = 'tabs';
    ui.tab = 'home';
    FW.sfx(after > before ? 'level' : 'ko');
    render();
    window.scrollTo(0, 0);
  }

  function abandon(skipConfirm) {
    if (!skipConfirm && !confirm('Discard this workout? Logged sets and photos from it will be lost.')) return;
    if (S.active) {
      S.active.exercises.forEach((e) => e.sets.forEach((s) => (s.photos || []).forEach((id) => FW.store.photos.del(id))));
    }
    S.active = null;
    rest = null;
    letSleep();
    ui.view = 'tabs';
    save();
    render();
  }

  // ---------- PLAN ----------
  function planHtml() {
    const next = nextKey();
    const blocks = ['A', 'B'].map((key) => {
      const W = FW.WORKOUTS[key];
      const rows = W.slots.map((slotKey) => {
        const opts = FW.slotOptions(slotKey, caps);
        const cur = FW.slotChoice(slotKey, caps, S.slotPins);
        if (!cur) return '';
        const t = FW.targetFor(cur, S, Date.now());
        const pinned = S.slotPins[slotKey] && opts.includes(S.slotPins[slotKey]);
        return '<div class="plan-ex"><div class="top"><span class="slot">' + FW.SLOTS[slotKey].label + '</span><span class="tg">' + esc(targetText(cur, t)) + '</span></div>' +
          '<div class="nm">' + esc(EX[cur].name) + '</div>' +
          (opts.length > 1 ? '<select data-bind="pin" data-slot="' + slotKey + '"><option value="auto"' + (pinned ? '' : ' selected') + '>AUTO · best for your gear</option>' +
            opts.map((o) => '<option value="' + o + '"' + (pinned && S.slotPins[slotKey] === o ? ' selected' : '') + '>' + esc(EX[o].name) + '</option>').join('') + '</select>' : '') +
          '</div>';
      }).join('');
      return '<div class="box ' + (key === next ? 'hot' : '') + '"><h2>' + W.name + ' <small>' + (key === next ? 'UP NEXT' : W.sub) + '</small></h2>' + rows + '</div>';
    }).join('');

    const locked = [];
    Object.keys(FW.SLOTS).forEach((sk) => FW.SLOTS[sk].opts.forEach((id) => { if (!FW.available(id, caps) && !locked.some((l) => l.id === id)) locked.push({ id, miss: FW.missingFor(id, caps) }); }));
    const lockedHtml = locked.length ? '<div class="box flat locked"><h2>' + SP.icon('lock', 2) + ' LOCKED MOVES</h2>' + locked.map((l) =>
      '<div class="unlock"><span>' + esc(EX[l.id].name) + '</span><span>NEEDS ' + esc(l.miss.map((m) => FW.CAP_LABEL[m] || m).join(' + ')) + '</span></div>').join('') + '</div>' : '';

    return '<h2>YOUR PLAN</h2>' +
      '<div class="box flat"><div class="row between"><span class="pix" style="font-size:9px">FIGHTS PER WEEK</span></div><div class="seg gap">' +
      [2, 3, 4, 5].map((d) => '<button class="chip ' + (S.profile.goalDays === d ? 'on' : '') + '" data-act="setGoal" data-d="' + d + '">' + d + '</button>').join('') + '</div>' +
      '<div class="muted gap">Workouts alternate A → B → A… whenever you train, so a missed day never breaks the plan.</div></div>' +
      blocks + lockedHtml +
      '<div class="box flat"><h2>HOW IT LEVELS UP</h2><ul class="rules">' +
      '<li>Hit the top of the rep range on every set and next time the weight goes up to the next one your plates allow.</li>' +
      '<li>Mark a lift EASY and it jumps two steps. Mark it HARD and the app holds the load.</li>' +
      '<li>Miss the bottom of the range twice and it backs off a step so you can rebuild.</li>' +
      '<li>Away 3+ weeks? The first session back is eased off ~10%.</li>' +
      '<li>Add gear and new moves swap into the plan automatically.</li></ul></div>';
  }

  // ---------- GEAR ----------
  function gearHtml() {
    const g = S.gear;
    const loads = FW.barbellLoads(g);
    const jumps = loads.length > 1 ? Math.min(...loads.slice(1).map((l, i) => l - loads[i])) : 0;
    const tgl = FW.TOGGLE_GEAR.map((t) => '<button class="toggle ' + (g[t.key] ? 'on' : '') + '" data-act="gearToggle" data-k="' + t.key + '"><span class="box-ico">' + SP.icon(t.icon, 2) + '</span><span class="nm">' + t.name + '</span><span class="sw">' + (g[t.key] ? 'OWN' : 'NO') + '</span></button>').join('');
    const list = (key, title, icon, step, unitLbl) => {
      const rows = g[key].slice().sort((a, b) => a.w - b.w).map((it) =>
        '<div class="wt-row"><div class="nm">' + n2(it.w) + 'kg <small>× ' + it.n + (key === 'plates' ? ' (' + Math.floor(it.n / 2) + ' per side)' : '') + '</small></div>' +
        '<div class="qty"><button data-act="qty" data-list="' + key + '" data-w="' + it.w + '" data-d="-' + step + '">-</button><b>' + it.n + '</b><button data-act="qty" data-list="' + key + '" data-w="' + it.w + '" data-d="' + step + '">+</button></div></div>').join('');
      return '<div class="box"><h2>' + SP.icon(icon, 2) + ' ' + title + '</h2><div class="stack">' + (rows || '<div class="muted">None yet.</div>') + '</div>' +
        '<div class="add-row"><input type="number" inputmode="decimal" step="any" min="0" placeholder="' + unitLbl + '" id="add-' + key + '"><button class="btn small" data-act="addW" data-list="' + key + '">ADD</button></div></div>';
    };
    const tips = [];
    if (g.barbell.has && jumps > 5) tips.push('Your smallest barbell jump is ' + n2(jumps) + 'kg. Add a pair of 1.25kg or 2.5kg plates for smoother progress.');
    Object.keys(S.prog).forEach((id) => {
      const p = S.prog[id], ex = EX[id];
      if (p && p.capped && ex) tips.push(FW.hasLoad(ex) ? ex.name + ' has hit the top of your gear. Heavier ' + (ex.load === 'hand' ? 'dumbbells / kettlebells' : 'plates') + ' will unlock the next level.' : ex.name + ' is maxed on reps. Try a harder variation or add load.');
    });
    return '<h2>GEAR</h2><div class="muted" style="margin-bottom:12px">Tick what you own. New equipment unlocks new moves and the plan updates itself.</div>' +
      '<div class="box"><h2>' + SP.icon('barbell', 2) + ' BARBELL</h2>' +
      '<button class="toggle ' + (g.barbell.has ? 'on' : '') + '" data-act="barbellToggle"><span class="box-ico">' + SP.icon('barbell', 2) + '</span><span class="nm">Barbell</span><span class="sw">' + (g.barbell.has ? 'OWN' : 'NO') + '</span></button>' +
      (g.barbell.has ? '<div class="row gap"><span class="grow">Bar weight (kg)</span><div class="seg tight">' + [10, 15, 20].map((w) => '<button class="chip ' + (g.barbell.weight === w ? 'on' : '') + '" data-act="barWeight" data-w="' + w + '">' + w + '</button>').join('') + '</div></div>' +
        '<div class="muted gap">Loadable range ' + n2(loads[0]) + '–' + n2(loads[loads.length - 1]) + 'kg · ' + loads.length + ' weights</div>' : '') +
      '</div>' +
      '<div class="box"><h2>BIG KIT</h2><div class="stack">' + tgl + '</div></div>' +
      list('plates', 'PLATES', 'plate', 2, 'plate kg, e.g. 2.5') +
      list('dumbbells', 'DUMBBELLS', 'dumbbell', 1, 'dumbbell kg, e.g. 10') +
      list('kettlebells', 'KETTLEBELLS', 'kettlebell', 1, 'kettlebell kg, e.g. 12') +
      (tips.length ? '<div class="box flat"><h2>BOSS TIPS</h2>' + tips.map((t) => '<div class="tip">' + esc(t) + '</div>').join('') + '</div>' : '');
  }

  function gearChanged(beforeCaps) {
    recaps();
    const before = new Set(FW.availableExercises(beforeCaps));
    const now = FW.availableExercises(caps).filter((id) => !before.has(id));
    save();
    if (now.length) {
      FW.sfx('unlock');
      toast('NEW MOVES UNLOCKED: ' + now.map((id) => EX[id].name.toUpperCase()).slice(0, 4).join(', ') + (now.length > 4 ? '…' : ''), 'good', 4200);
    }
    render(true);
  }

  // ---------- LOG ----------
  function logHtml() {
    const seg = '<div class="seg" style="margin-bottom:14px">' + [['history', 'HISTORY'], ['photos', 'PHOTOS'], ['chart', 'CHARTS']].map((t) =>
      '<button class="chip ' + (ui.logTab === t[0] ? 'on' : '') + '" data-act="logTab" data-t="' + t[0] + '">' + t[1] + '</button>').join('') + '</div>';
    if (ui.logTab === 'history') {
      if (!S.sessions.length) return seg + '<div class="box flat center"><div class="muted">No fights logged yet.<br>Finish your first workout and it lands here.</div></div>';
      return seg + '<div class="hist">' + S.sessions.slice().reverse().map((s) => {
        const open = ui.openHist === s.id;
        return '<button class="hist-item" data-act="histToggle" data-id="' + s.id + '"><div class="t"><b>' + esc(s.name) + '</b><span class="muted">' + fmtDate(s.endedAt) + '</span></div>' +
          '<div class="muted">' + s.sets + ' sets · ' + n2(Math.round(s.vol / 10) / 100) + ' t · ' + mmss((s.endedAt - s.startedAt) / 1000) + ' · +' + s.xp + ' XP</div>' +
          (open ? '<div class="hist-detail">' + s.exercises.map((e) => '<div><div class="e">' + esc(e.name) + '</div><div class="s">' + e.sets.map((x) => (FW.hasLoad(EX[e.exId] || {}) ? n2(x.w) + 'kg×' + x.r : x.r + (e.load === 'time' ? 's' : '')) + (x.pr ? '★' : '')).join('  ') + '</div></div>').join('') + '</div>' : '') +
          '</button>';
      }).join('') + '</div>';
    }
    if (ui.logTab === 'photos') {
      if (!ui.photos.length) return seg + '<div class="box flat center">' + SP.icon('camera', 4, 'bob') + '<div class="muted">No set photos yet.<br>Tap the camera on any set during a workout.</div></div>';
      return seg + '<div class="photo-grid">' + ui.photos.map((p) => '<button data-act="viewPhoto" data-id="' + p.id + '"><img alt="" src="' + FW.store.urlFor(p) + '"><span>' + esc((p.meta && p.meta.exName) || '') + '</span></button>').join('') + '</div>';
    }
    // charts
    const ids = [];
    S.sessions.forEach((s) => s.exercises.forEach((e) => { if (!ids.includes(e.exId) && EX[e.exId]) ids.push(e.exId); }));
    if (!ids.length) return seg + '<div class="box flat center"><div class="muted">Charts appear after your first workout.</div></div>';
    if (!ui.chartEx || !ids.includes(ui.chartEx)) ui.chartEx = ids[0];
    const pts = chartPoints(ui.chartEx);
    const ex = EX[ui.chartEx];
    const unit = FW.hasLoad(ex) ? 'kg' : ex.load === 'time' ? 's' : ' reps';
    return seg + '<div class="box"><select data-bind="chartEx">' + ids.map((id) => '<option value="' + id + '"' + (id === ui.chartEx ? ' selected' : '') + '>' + esc(EX[id].name) + '</option>').join('') + '</select>' +
      '<div class="gap"><canvas id="chart" class="chart" width="200" height="110"></canvas></div>' +
      '<div class="row between gap"><span class="muted">' + (FW.hasLoad(ex) ? 'TOP SET WEIGHT' : 'BEST SET') + '</span><span class="pix" style="font-size:9px;color:var(--yellow)">' +
      (pts.length ? n2(pts[0].v) + unit + ' → ' + n2(pts[pts.length - 1].v) + unit : '') + '</span></div></div>';
  }

  function chartPoints(exId) {
    const ex = EX[exId];
    const pts = [];
    S.sessions.forEach((s) => {
      const e = s.exercises.find((x) => x.exId === exId);
      if (!e || !e.sets.length) return;
      pts.push({ t: s.endedAt, v: Math.max(...e.sets.map((x) => (FW.hasLoad(ex) ? x.w : x.r))) });
    });
    return pts;
  }

  function drawChart() {
    const cv = $('#chart');
    if (!cv) return;
    const pts = chartPoints(ui.chartEx);
    const x = cv.getContext('2d');
    const W = cv.width, H = cv.height, padL = 6, padR = 6, padT = 10, padB = 10;
    x.fillStyle = '#000'; x.fillRect(0, 0, W, H);
    x.fillStyle = '#25256a';
    for (let i = 0; i <= 4; i++) x.fillRect(padL, Math.round(padT + ((H - padT - padB) * i) / 4), W - padL - padR, 1);
    if (!pts.length) return;
    const vals = pts.map((p) => p.v);
    let lo = Math.min(...vals), hi = Math.max(...vals);
    if (lo === hi) { lo = Math.max(0, lo - 1); hi = hi + 1; }
    const px = (i) => (pts.length === 1 ? W / 2 : padL + 3 + ((W - padL - padR - 6) * i) / (pts.length - 1));
    const py = (v) => H - padB - ((v - lo) / (hi - lo)) * (H - padT - padB);
    x.fillStyle = '#e63946';
    for (let i = 1; i < pts.length; i++) {
      const x0 = px(i - 1), y0 = py(pts[i - 1].v), x1 = px(i), y1 = py(pts[i].v);
      const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      for (let s = 0; s <= steps; s++) x.fillRect(Math.round(x0 + ((x1 - x0) * s) / steps), Math.round(y0 + ((y1 - y0) * s) / steps), 2, 2);
    }
    x.fillStyle = '#ffd23f';
    pts.forEach((p, i) => x.fillRect(Math.round(px(i)) - 2, Math.round(py(p.v)) - 2, 5, 5));
  }

  async function loadPhotos() {
    const list = await FW.store.photos.all();
    ui.photos = list.sort((a, b) => b.ts - a.ts);
    if (ui.tab === 'log' && ui.logTab === 'photos' && ui.view === 'tabs') render(true);
  }

  // ---------- FOOD ----------
  function foodHtml() {
    return '<h2>FOOD</h2><div class="box locked center">' + SP.icon('lock', 6, 'bob') + '<div class="pix" style="font-size:12px;color:var(--yellow);margin:12px 0">COMING IN V2</div>' +
      '<div class="muted">Next up: log meals, snap a photo of your plate, and track calories + protein against your training days.</div></div>' +
      '<div class="box flat"><h2>' + SP.icon('food', 2) + ' ROADMAP</h2><ul class="rules"><li>Quick meal logging with photos</li><li>Daily calorie and protein targets</li><li>Training day vs rest day macros</li><li>Body weight tracking next to your lifts</li></ul></div>';
  }

  // ---------- ONBOARDING ----------
  function onboardHtml() {
    const o = ui.onb;
    if (ui.onbStep === 0) {
      return '<div class="logo" style="margin-top:6vh"><span class="l1">ROUND</span><span class="l2">ONE</span></div>' +
        '<div class="tag">FIGHT FOR YOUR FITNESS</div>' +
        '<div class="row" style="justify-content:center;gap:16px;margin:20px 0"><div class="portrait bob" style="width:130px"><img class="px" alt="" src="' + SP.fighterUrl(0) + '"></div><div class="pix" style="font-size:20px;color:var(--red);text-shadow:3px 3px 0 #000">VS</div><div class="portrait bob" style="width:130px"><img class="px" alt="" src="' + SP.fighterUrl(1) + '"></div></div>' +
        '<div class="center muted" style="margin-bottom:22px">Your own training plan, built from the gear you have. It gets harder as you get stronger.</div>' +
        '<button class="btn block red blink" data-act="onbNext">PRESS START</button><div class="center pix" style="font-size:7px;color:var(--muted);margin-top:22px">© 1P CREDIT 01</div>';
    }
    return '<h2>CHOOSE YOUR SETUP</h2>' +
      '<div class="box"><div class="pix" style="font-size:9px;margin-bottom:8px">PLAYER NAME</div><input type="text" maxlength="10" data-bind="onbName" value="' + esc(o.name) + '"></div>' +
      '<div class="box"><div class="pix" style="font-size:9px;margin-bottom:8px">FIGHTS PER WEEK</div><div class="seg">' + [2, 3, 4, 5].map((d) => '<button class="chip ' + (o.days === d ? 'on' : '') + '" data-act="onbDays" data-d="' + d + '">' + d + '</button>').join('') + '</div></div>' +
      '<div class="box"><div class="pix" style="font-size:9px;margin-bottom:8px">DO YOU HAVE A BARBELL?</div><div class="seg"><button class="chip ' + (o.barbell ? 'on' : '') + '" data-act="onbBar" data-v="1">YES</button><button class="chip ' + (!o.barbell ? 'on' : '') + '" data-act="onbBar" data-v="0">NO</button></div>' +
      (o.barbell ? '<div class="pix" style="font-size:9px;margin:12px 0 8px">BAR WEIGHT (KG)</div><div class="seg">' + [10, 15, 20].map((w) => '<button class="chip ' + (o.bar === w ? 'on' : '') + '" data-act="onbBarW" data-w="' + w + '">' + w + '</button>').join('') + '</div>' : '') + '</div>' +
      '<div class="box"><div class="pix" style="font-size:9px;margin-bottom:8px">BEEN AWAY FROM TRAINING?</div><div class="seg"><button class="chip ' + (o.ramp ? 'on' : '') + '" data-act="onbRamp" data-v="1">EASE ME IN</button><button class="chip ' + (!o.ramp ? 'on' : '') + '" data-act="onbRamp" data-v="0">FULL SEND</button></div>' +
      '<div class="muted gap">Ease-in: fewer sets for your first 6 workouts while you rebuild the habit.</div></div>' +
      '<div class="box flat"><div class="pix" style="font-size:9px;margin-bottom:8px">GEAR LOADED</div><div class="muted">Bench · Squat rack · Plates 5/10/15/20/25kg (pairs) · Kettlebells 8kg × 2 · Dumbbells 5kg × 2. Add more any time on the GEAR tab.</div></div>' +
      '<button class="btn block red" data-act="onbGo">ENTER THE ARENA</button>';
  }

  // ---------- MODALS ----------
  function modalHtml() {
    if (ui.ko) return koHtml();
    if (ui.viewer) return viewerHtml();
    if (ui.settings) return settingsHtml();
    return '';
  }

  function koHtml() {
    const k = ui.ko, s = k.session;
    return '<div class="modal"><div class="modal-in ko">' +
      '<div class="big shake">K.O.</div><div class="sub">' + (k.perfect ? 'PERFECT!' : 'YOU WIN') + '</div>' +
      (k.levelUp ? '<div class="lvlup">★ LEVEL UP! LV ' + k.levelUp + ' · ' + FW.titleFor(k.levelUp) + ' ★</div>' : '') +
      '<div class="sum"><div><b>' + s.sets + '</b><span>SETS</span></div><div><b>' + n2(Math.round(s.vol / 100) / 10) + 't</b><span>VOLUME</span></div><div><b>+' + s.xp + '</b><span>XP</span></div></div>' +
      (k.prCount ? '<div class="lvlup" style="color:var(--cyan)">' + k.prCount + ' NEW RECORD' + (k.prCount > 1 ? 'S' : '') + '!</div>' : '') +
      '<div class="box flat"><h2>NEXT TIME</h2><div class="next-list">' + k.notes.map((n) => '<div><span>' + esc(n.name) + '</span><span>' + esc(n.note) + '</span></div>').join('') + '</div></div>' +
      '<button class="btn block" data-act="koClose">CONTINUE</button></div></div>';
  }

  function viewerHtml() {
    const id = ui.viewer;
    return '<div class="modal"><div class="modal-in viewer"><img data-photo="' + id + '" alt="Set photo"><div class="muted gap" id="viewerCap"></div>' +
      '<div class="row gap"><button class="btn block ghost" data-act="closeViewer">CLOSE</button><button class="btn block red" data-act="delPhoto" data-id="' + id + '">DELETE</button></div></div></div>';
  }

  function settingsHtml() {
    const st = S.settings;
    const tg = (k, label) => '<button class="toggle ' + (st[k] ? 'on' : '') + '" data-act="setting" data-k="' + k + '"><span class="nm">' + label + '</span><span class="sw">' + (st[k] ? 'ON' : 'OFF') + '</span></button>';
    return '<div class="modal"><div class="modal-in"><h2>SETTINGS</h2>' +
      '<div class="box"><div class="pix" style="font-size:9px;margin-bottom:8px">PLAYER NAME</div><input type="text" maxlength="10" data-bind="name" value="' + esc(S.profile.name) + '"></div>' +
      '<div class="box"><div class="stack">' + tg('sound', 'Sound effects') + tg('autoRest', 'Auto rest timer') + tg('ramp', 'Ease-in (first 6 workouts)') + '</div></div>' +
      '<div class="box"><h2>BACKUP</h2><div class="muted" style="margin-bottom:10px">Everything lives on this device. Export a backup now and then (photos included).</div>' +
      '<div class="stack"><button class="btn block blue" data-act="exportData">EXPORT BACKUP</button><button class="btn block ghost" data-act="importData">IMPORT BACKUP</button><button class="btn block red" data-act="resetAll">ERASE EVERYTHING</button></div></div>' +
      '<div class="center muted" style="margin-bottom:14px">ROUND ONE v1.0<br>FOOD TRACKING ARRIVES IN V2</div>' +
      '<button class="btn block" data-act="closeModal">DONE</button></div></div>';
  }

  // ---------- render ----------
  function render(keepScroll) {
    const y = window.scrollY;
    document.body.classList.toggle('view-workout', ui.view === 'workout');
    document.body.classList.toggle('view-onboard', ui.view === 'onboard');
    FW.sfxEnable(S.settings.sound);
    $('#btnSound').textContent = S.settings.sound ? '♪' : '✕';
    $('#hud').innerHTML = ui.view === 'onboard' ? '' : hud();
    $('#tabs').innerHTML = tabsHtml();
    let html;
    if (ui.view === 'onboard') html = onboardHtml();
    else if (ui.view === 'workout') html = workoutHtml();
    else html = ({ home: homeHtml, plan: planHtml, gear: gearHtml, log: logHtml, food: foodHtml })[ui.tab]();
    $('#screen').innerHTML = html;
    $('#modal').innerHTML = modalHtml();
    document.body.style.overflow = ui.ko || ui.viewer || ui.settings ? 'hidden' : '';
    renderDock();
    if (keepScroll) window.scrollTo(0, y);
    hydratePhotos();
    if (ui.view === 'tabs' && ui.tab === 'log' && ui.logTab === 'chart') drawChart();
  }

  async function hydratePhotos() {
    const imgs = document.querySelectorAll('img[data-photo]');
    for (const img of imgs) {
      const rec = await FW.store.photos.get(img.dataset.photo);
      if (rec) {
        img.src = FW.store.urlFor(rec);
        if (img.closest('.viewer')) {
          const cap = $('#viewerCap');
          if (cap) cap.textContent = ((rec.meta && rec.meta.exName) || '') + (rec.meta && rec.meta.setNo ? ' · SET ' + rec.meta.setNo : '') + ' · ' + new Date(rec.ts).toLocaleString();
        }
      }
    }
  }

  // ---------- actions ----------
  const setAt = (el) => S.active && S.active.exercises[+el.dataset.ei] && S.active.exercises[+el.dataset.ei].sets[+el.dataset.si];
  function setInput(ei, si, kind) {
    return document.querySelector('.set[data-ei="' + ei + '"][data-si="' + si + '"] input[data-bind="' + kind + '"]');
  }
  function setWeight(ei, si, w) {
    const e = S.active.exercises[ei];
    e.sets[si].w = w;
    for (let j = si + 1; j < e.sets.length; j++) {
      if (!e.sets[j].done) { e.sets[j].w = w; const inp = setInput(ei, j, 'w'); if (inp) inp.value = n2(w); }
    }
    const me = setInput(ei, si, 'w');
    if (me) me.value = n2(w);
    save();
  }
  function setReps(ei, si, r) {
    S.active.exercises[ei].sets[si].r = r;
    const me = setInput(ei, si, 'r');
    if (me) me.value = r;
    save();
  }

  const ACT = {
    tab(el) { ui.tab = el.dataset.tab; ui.view = 'tabs'; FW.sfx('tap'); if (ui.tab === 'log' && ui.logTab === 'photos') loadPhotos(); render(); window.scrollTo(0, 0); },
    start(el) { startWorkout(el.dataset.key); },
    resume() { ui.view = 'workout'; keepAwake(); render(); window.scrollTo(0, 0); },
    finish() { finishWorkout(); },
    abandon() { abandon(); },
    toggleSet(el) {
      const ei = +el.dataset.ei, si = +el.dataset.si;
      const e = S.active.exercises[ei], s = e.sets[si];
      if (!s.done) {
        const rIn = setInput(ei, si, 'r'), wIn = setInput(ei, si, 'w');
        if (rIn) s.r = Math.max(0, Math.round(parseFloat(rIn.value) || 0));
        if (wIn) s.w = Math.max(0, parseFloat(wIn.value) || 0);
        if (s.r <= 0) { toast('ENTER YOUR REPS FIRST'); return; }
        const best = bestMetric(e.exId, true);
        const ex = EX[e.exId];
        const metric = FW.hasLoad(ex) ? FW.e1rm(s.w, s.r) : s.r;
        s.done = true;
        s.pr = best > 0 && metric > best + 0.01 && (ex.load !== 'time');
        if (s.pr) { FW.sfx('pr'); toast('NEW RECORD!', 'pr'); } else FW.sfx('set');
        const c = setCounts(S.active);
        if (S.settings.autoRest && c.done < c.total) startRest(ex.rest);
      } else {
        s.done = false; s.pr = false;
        FW.sfx('undo');
      }
      save();
      render(true);
    },
    wstep(el) {
      const ei = +el.dataset.ei, si = +el.dataset.si, dir = +el.dataset.dir;
      const e = S.active.exercises[ei];
      const loads = FW.loadsFor(EX[e.exId], S.gear);
      const cur = parseFloat((setInput(ei, si, 'w') || {}).value) || 0;
      const nw = loads.length ? FW.stepFrom(loads, cur, dir) : Math.max(0, cur + dir * 2.5);
      FW.sfx('step');
      setWeight(ei, si, nw);
    },
    rstep(el) {
      const ei = +el.dataset.ei, si = +el.dataset.si, dir = +el.dataset.dir;
      const e = S.active.exercises[ei];
      const cur = Math.round(parseFloat((setInput(ei, si, 'r') || {}).value) || 0);
      const inc = EX[e.exId].load === 'time' ? 5 : 1;
      FW.sfx('step');
      setReps(ei, si, Math.max(0, cur + dir * inc));
    },
    addSet(el) {
      const e = S.active.exercises[+el.dataset.ei];
      const l = e.sets[e.sets.length - 1] || { w: 0, r: 8 };
      e.sets.push({ w: l.w, r: l.r, done: false, photos: [] });
      save(); render(true);
    },
    delSet(el) {
      const e = S.active.exercises[+el.dataset.ei];
      if (e.sets.length > 1) { const rm = e.sets.pop(); (rm.photos || []).forEach((id) => FW.store.photos.del(id)); save(); render(true); }
    },
    skip(el) { const e = S.active.exercises[+el.dataset.ei]; e.skipped = !e.skipped; save(); render(true); },
    info(el) { ui.cue[el.dataset.ei] = !ui.cue[el.dataset.ei]; render(true); },
    feel(el) { S.active.exercises[+el.dataset.ei].feel = el.dataset.f; FW.sfx('tap'); save(); render(true); },
    swap(el) {
      const ei = +el.dataset.ei, e = S.active.exercises[ei];
      const opts = FW.slotOptions(e.slotKey, caps);
      const nxt = opts[(opts.indexOf(e.exId) + 1) % opts.length];
      S.active.exercises[ei] = makeExercise(e.slotKey, nxt);
      FW.sfx('tap'); save(); render(true);
      toast('SWAPPED TO ' + EX[nxt].name.toUpperCase() + ' (THIS WORKOUT ONLY)', '', 2200);
    },
    photo(el) { pendingPhoto = { ei: +el.dataset.ei, si: +el.dataset.si }; $('#photoInput').value = ''; $('#photoInput').click(); },
    restAdd() { if (rest) { rest.end += 30000; rest.total += 30; } },
    restSkip() { rest = null; renderDock(); },
    koClose() { ui.ko = null; render(); window.scrollTo(0, 0); },
    openSettings() { ui.settings = true; render(true); },
    closeModal() { ui.settings = false; render(true); },
    toggleSound() { S.settings.sound = !S.settings.sound; FW.sfxEnable(S.settings.sound); FW.sfx('coin'); save(); render(true); },
    setting(el) { S.settings[el.dataset.k] = !S.settings[el.dataset.k]; save(); render(true); },
    setGoal(el) { S.profile.goalDays = +el.dataset.d; save(); render(true); },
    gearToggle(el) { const b = new Set(caps); S.gear[el.dataset.k] = !S.gear[el.dataset.k]; gearChanged(b); },
    barbellToggle() { const b = new Set(caps); S.gear.barbell.has = !S.gear.barbell.has; gearChanged(b); },
    barWeight(el) { const b = new Set(caps); S.gear.barbell.weight = +el.dataset.w; gearChanged(b); },
    qty(el) {
      const b = new Set(caps);
      const list = S.gear[el.dataset.list];
      const it = list.find((x) => x.w === +el.dataset.w);
      if (!it) return;
      it.n += +el.dataset.d;
      if (it.n <= 0) list.splice(list.indexOf(it), 1);
      gearChanged(b);
    },
    addW(el) {
      const key = el.dataset.list;
      const inp = $('#add-' + key);
      const w = FW.r2(parseFloat(inp && inp.value));
      if (!(w > 0)) { toast('TYPE A WEIGHT IN KG FIRST'); return; }
      const b = new Set(caps);
      const list = S.gear[key];
      const it = list.find((x) => x.w === w);
      if (it) it.n += 2; else list.push({ w, n: 2 });
      FW.sfx('coin');
      gearChanged(b);
    },
    logTab(el) { ui.logTab = el.dataset.t; if (ui.logTab === 'photos') loadPhotos(); render(); },
    histToggle(el) { ui.openHist = ui.openHist === el.dataset.id ? null : el.dataset.id; render(true); },
    viewPhoto(el) { ui.viewer = el.dataset.id; render(true); },
    closeViewer() { ui.viewer = null; render(true); },
    async delPhoto(el) {
      if (!confirm('Delete this photo?')) return;
      const id = el.dataset.id;
      const strip = (arr) => arr.forEach((ex) => ex.sets.forEach((s) => { if (s.photos) s.photos = s.photos.filter((p) => p !== id); }));
      S.sessions.forEach((s) => strip(s.exercises));
      if (S.active) strip(S.active.exercises);
      await FW.store.photos.del(id);
      ui.photos = ui.photos.filter((p) => p.id !== id);
      ui.viewer = null;
      save(); render(true);
    },
    exportData() { exportData(); },
    importData() { $('#importInput').value = ''; $('#importInput').click(); },
    resetAll() {
      if (!confirm('Erase ALL workouts, gear and photos on this device? This cannot be undone.')) return;
      FW.store.photos.clear().then(() => {
        S = FW.store.freshState();
        FW.store.saveNow(S);
        recaps();
        ui.settings = false; ui.view = 'onboard'; ui.onbStep = 0; ui.tab = 'home'; ui.photos = [];
        render();
      });
    },
    onbNext() { ui.onbStep = 1; FW.sfx('coin'); render(); window.scrollTo(0, 0); },
    onbDays(el) { ui.onb.days = +el.dataset.d; FW.sfx('tap'); render(true); },
    onbBar(el) { ui.onb.barbell = el.dataset.v === '1'; render(true); },
    onbBarW(el) { ui.onb.bar = +el.dataset.w; render(true); },
    onbRamp(el) { ui.onb.ramp = el.dataset.v === '1'; render(true); },
    onbGo() {
      const o = ui.onb;
      S.profile.name = (o.name || 'PLAYER 1').toUpperCase().slice(0, 10);
      S.profile.goalDays = o.days;
      S.settings.ramp = o.ramp;
      S.gear.barbell = { has: o.barbell, weight: o.bar };
      S.onboarded = true;
      recaps();
      save();
      FW.store.saveNow(S);
      ui.view = 'tabs'; ui.tab = 'home';
      FW.sfx('level');
      render(); window.scrollTo(0, 0);
    },
  };

  const BIND = {
    w(el) {
      const ei = +el.dataset.ei, si = +el.dataset.si;
      const v = parseFloat(el.value);
      setWeight(ei, si, v >= 0 ? v : 0);
    },
    r(el) {
      const v = Math.round(parseFloat(el.value));
      setReps(+el.dataset.ei, +el.dataset.si, v >= 0 ? v : 0);
    },
    name(el) { S.profile.name = (el.value || 'PLAYER 1').toUpperCase().slice(0, 10); save(); },
    onbName(el) { ui.onb.name = el.value; },
    pin(el) {
      if (el.value === 'auto') delete S.slotPins[el.dataset.slot]; else S.slotPins[el.dataset.slot] = el.value;
      save(); render(true);
    },
    chartEx(el) { ui.chartEx = el.value; render(true); },
  };

  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el) return;
    const fn = ACT[el.dataset.act];
    if (fn) fn(el, e);
  });
  document.addEventListener('change', (e) => {
    const el = e.target.closest('[data-bind]');
    if (el && BIND[el.dataset.bind]) BIND[el.dataset.bind](el);
  });

  // photo capture
  $('#photoInput').addEventListener('change', async (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file || !pendingPhoto || !S.active) return;
    const { ei, si } = pendingPhoto;
    pendingPhoto = null;
    toast('SAVING PHOTO…', '', 1500);
    try {
      const blob = await FW.store.compress(file);
      const ex = S.active.exercises[ei];
      const rec = { id: uid(), ts: Date.now(), blob, meta: { sessionId: S.active.id, exId: ex.exId, exName: EX[ex.exId].name, setNo: si + 1 } };
      await FW.store.photos.put(rec);
      const set = ex.sets[si];
      set.photos = (set.photos || []).concat(rec.id);
      save();
      FW.sfx('set');
      render(true);
      toast('PHOTO ADDED TO SET ' + (si + 1), 'good', 1800);
    } catch (err) {
      toast('COULD NOT SAVE PHOTO');
    }
  });

  // backup
  async function exportData() {
    toast('BUILDING BACKUP…', '', 1500);
    const list = await FW.store.photos.all();
    const photos = [];
    for (const p of list) photos.push({ id: p.id, ts: p.ts, meta: p.meta, data: await FW.store.blobToDataUrl(p.blob) });
    const blob = new Blob([JSON.stringify({ app: 'roundone', v: 1, exportedAt: Date.now(), state: S, photos })], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'roundone-backup-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  $('#importInput').addEventListener('change', async (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      if (data.app !== 'roundone' || !data.state) throw new Error('bad file');
      if (!confirm('Replace everything on this device with this backup?')) return;
      await FW.store.photos.clear();
      for (const p of data.photos || []) await FW.store.photos.put({ id: p.id, ts: p.ts, meta: p.meta, blob: await FW.store.dataUrlToBlob(p.data) });
      S = Object.assign(FW.store.freshState(), data.state);
      S.gear = Object.assign(FW.defaultGear(), S.gear);
      S.onboarded = true;
      FW.store.saveNow(S);
      recaps();
      ui.settings = false; ui.view = S.active ? 'workout' : 'tabs'; ui.photos = [];
      render();
      toast('BACKUP RESTORED', 'good');
    } catch (err) {
      toast('THAT FILE IS NOT A ROUND ONE BACKUP');
    }
  });

  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && ui.view === 'workout') keepAwake(); });
  setInterval(tick, 250);

  if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
    navigator.serviceWorker.register('sw.js').catch(() => { /* offline support is optional */ });
  }

  // restore a workout that was in progress
  if (S.active && S.onboarded) { ui.view = 'tabs'; }
  render();
  window.__FW_DEBUG = { get state() { return S; }, ui, render };
})();
