const assert = require('assert');
global.FW = {};
require('../js/data.js');
const FW = require('../js/engine.js');

const g = FW.defaultGear();
const caps = FW.capabilities(g);
assert(caps.has('barbell') && caps.has('rack') && caps.has('bench') && caps.has('hand2') && caps.has('kettlebell'));
assert(!caps.has('pullupbar'));

// 25kg bar + 2x(5,10,15,20,25): per side 0..75 in 5s => 25..175 in 10kg steps
const loads = FW.barbellLoads(g);
assert.deepStrictEqual([loads[0], loads[1], loads[loads.length - 1]], [25, 35, 175]);
assert.strictEqual(loads.length, 16);
assert.deepStrictEqual(FW.plateLoadout(g, 105), [25, 15]);
assert.deepStrictEqual(FW.plateLoadout(g, 25), []);
assert.strictEqual(FW.plateLoadout(g, 30), null);

// hand weights
assert.deepStrictEqual(FW.handWeights(g, 2), [5, 8]);

// default plan
const A = FW.buildWorkout('A', caps, {});
assert.deepStrictEqual(A.map((s) => s.exId), ['back_squat', 'bench_press', 'barbell_row', 'hip_thrust', 'barbell_curl', 'plank', 'kb_swing']);
const B = FW.buildWorkout('B', caps, {});
assert.deepStrictEqual(B.map((s) => s.exId), ['deadlift', 'ohp', 'split_squat', 'db_pullover', 'db_ext', 'dead_bug', 'mountain_climber']);

// knee-friendly mode: no split squats, box squat instead of back squat, hinge-based single leg work
const KA = FW.buildWorkout('A', caps, {}, true).map((s) => s.exId);
const KB = FW.buildWorkout('B', caps, {}, true).map((s) => s.exId);
assert.strictEqual(KA[0], 'box_squat');
assert.strictEqual(KB[2], 'sl_rdl');
assert(!FW.slotOptions('lunge', caps, true).includes('split_squat'));
assert(FW.slotOptions('lunge', caps, false).includes('split_squat'));
// a pinned back squat is still honoured in knee mode (caution level, not avoid)
assert.strictEqual(FW.slotChoice('squat', caps, { squat: 'back_squat' }, true), 'back_squat');

// adding a pull-up bar unlocks pull-ups; removing barbell falls back to dumbbells
g.pullupbar = true;
assert.strictEqual(FW.buildWorkout('B', FW.capabilities(g), {})[3].exId, 'pullup');
g.barbell.has = false;
assert.strictEqual(FW.buildWorkout('A', FW.capabilities(g), {})[0].exId, 'goblet_squat');
g.barbell.has = true; g.pullupbar = false;

// pins respected only if still available
assert.strictEqual(FW.slotChoice('squat', caps, { squat: 'goblet_squat' }), 'goblet_squat');
assert.strictEqual(FW.slotChoice('vpull', caps, { vpull: 'pullup' }), 'db_pullover');

// progression
const state = { gear: FW.defaultGear(), settings: { ramp: true }, sessions: [], prog: {} };
let t = FW.targetFor('back_squat', state);
assert.strictEqual(t.w, 25); assert.strictEqual(t.sets, 2); // ramp-in
state.settings.ramp = false;
t = FW.targetFor('back_squat', state);
assert.strictEqual(t.sets, 3);

const mk = (w, rs) => rs.map((r) => ({ w, r, done: true }));
// 25kg -> 35kg is a +40% jump so ceiling = 10+4 = 14; 3x12 only keeps going
let res = FW.applyProgression('back_squat', null, mk(25, [12, 12, 12]), { gear: state.gear, targetSets: 3 });
assert.strictEqual(res.prog.w, 25); assert.strictEqual(res.prog.reps, 13);
res = FW.applyProgression('back_squat', res.prog, mk(25, [14, 14, 14]), { gear: state.gear, targetSets: 3 });
assert.strictEqual(res.prog.w, 35); assert.strictEqual(res.prog.reps, 6);
// at 105kg -> 115kg is under +10% so no stretch: ceiling is the top of the range (10)
res = FW.applyProgression('back_squat', null, mk(105, [10, 10, 10]), { gear: state.gear, targetSets: 3 });
assert.strictEqual(res.prog.w, 115);
// easy feel = 2 steps
res = FW.applyProgression('back_squat', null, mk(105, [10, 10, 10]), { gear: state.gear, targetSets: 3, feel: 'easy' });
assert.strictEqual(res.prog.w, 125);
// hard feel holds
res = FW.applyProgression('back_squat', null, mk(105, [10, 10, 10]), { gear: state.gear, targetSets: 3, feel: 'hard' });
assert.strictEqual(res.prog.w, 105);
// two failures in a row deloads one step
res = FW.applyProgression('back_squat', null, mk(105, [5, 4, 3]), { gear: state.gear, targetSets: 3 });
assert.strictEqual(res.prog.fails, 1); assert.strictEqual(res.prog.w, 105);
res = FW.applyProgression('back_squat', res.prog, mk(105, [5, 4, 3]), { gear: state.gear, targetSets: 3 });
assert.strictEqual(res.prog.w, 95);
// maxed gear raises rep ceiling instead
res = FW.applyProgression('goblet_squat', null, mk(8, [16, 16, 16]), { gear: state.gear, targetSets: 3 });
assert(res.prog.capped === true || res.prog.extra > 0);
// time based
res = FW.applyProgression('plank', null, mk(0, [45, 45, 45]), { gear: state.gear, targetSets: 3 });
assert.strictEqual(res.prog.extra, 10);
// incomplete sets never progress
res = FW.applyProgression('back_squat', null, mk(105, [10, 10]), { gear: state.gear, targetSets: 3 });
assert.strictEqual(res.prog.w, 105);
// welcome back after a long gap
state.prog.back_squat = { w: 105, reps: 6, lastTs: Date.now() - 40 * 86400000, extra: 0 };
t = FW.targetFor('back_squat', state);
assert.strictEqual(t.w, 85);
// stepFrom
assert.strictEqual(FW.stepFrom(loads, 37, 1), 45);
assert.strictEqual(FW.stepFrom(loads, 37, -1), 35);
// levels
assert.strictEqual(FW.levelInfo(0).lvl, 1);
assert.strictEqual(FW.levelInfo(100).lvl, 2);
assert(FW.levelInfo(1000).lvl > 4);
console.log('engine tests passed');
