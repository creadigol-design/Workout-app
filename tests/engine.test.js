const assert = require('assert');
global.FW = {};
require('../js/data.js');
const FW = require('../js/engine.js');

const g = FW.defaultGear();
const caps = FW.capabilities(g);
assert(caps.has('barbell') && caps.has('rack') && caps.has('bench') && caps.has('hand2') && caps.has('kettlebell'));
assert(!caps.has('pullupbar'));

// 20kg bar + 2x(5,10,15,20,25): per side 0..75 in 5s => 20..170 in 10kg steps
const loads = FW.barbellLoads(g);
assert.deepStrictEqual([loads[0], loads[1], loads[loads.length - 1]], [20, 30, 170]);
assert.strictEqual(loads.length, 16);
assert.deepStrictEqual(FW.plateLoadout(g, 100), [25, 15]);
assert.deepStrictEqual(FW.plateLoadout(g, 20), []);
assert.strictEqual(FW.plateLoadout(g, 25), null);

// hand weights
assert.deepStrictEqual(FW.handWeights(g, 2), [5, 8]);

// default plan
const A = FW.buildWorkout('A', caps, {});
assert.deepStrictEqual(A.map((s) => s.exId), ['back_squat', 'bench_press', 'barbell_row', 'hip_thrust', 'plank', 'barbell_curl']);
const B = FW.buildWorkout('B', caps, {});
assert.deepStrictEqual(B.map((s) => s.exId), ['deadlift', 'ohp', 'split_squat', 'db_pullover', 'db_ext', 'dead_bug']);

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
assert.strictEqual(t.w, 20); assert.strictEqual(t.sets, 2); // ramp-in
state.settings.ramp = false;
t = FW.targetFor('back_squat', state);
assert.strictEqual(t.sets, 3);

const mk = (w, rs) => rs.map((r) => ({ w, r, done: true }));
// 20kg -> 30kg is a +50% jump so ceiling = 8+4 = 12; 3x10 only keeps going
let res = FW.applyProgression('back_squat', null, mk(20, [10, 10, 10]), { gear: state.gear, targetSets: 3 });
assert.strictEqual(res.prog.w, 20); assert.strictEqual(res.prog.reps, 11);
res = FW.applyProgression('back_squat', res.prog, mk(20, [12, 12, 12]), { gear: state.gear, targetSets: 3 });
assert.strictEqual(res.prog.w, 30); assert.strictEqual(res.prog.reps, 5);
// at 100kg -> 110kg is +10% (>0.1? 0.1 exactly -> no stretch) so ceiling 8
res = FW.applyProgression('back_squat', null, mk(100, [8, 8, 8]), { gear: state.gear, targetSets: 3 });
assert.strictEqual(res.prog.w, 110);
// easy feel = 2 steps
res = FW.applyProgression('back_squat', null, mk(100, [8, 8, 8]), { gear: state.gear, targetSets: 3, feel: 'easy' });
assert.strictEqual(res.prog.w, 120);
// hard feel holds
res = FW.applyProgression('back_squat', null, mk(100, [8, 8, 8]), { gear: state.gear, targetSets: 3, feel: 'hard' });
assert.strictEqual(res.prog.w, 100);
// two failures in a row deloads one step
res = FW.applyProgression('back_squat', null, mk(100, [5, 4, 3]), { gear: state.gear, targetSets: 3 });
assert.strictEqual(res.prog.fails, 1); assert.strictEqual(res.prog.w, 100);
res = FW.applyProgression('back_squat', res.prog, mk(100, [5, 4, 3]), { gear: state.gear, targetSets: 3 });
assert.strictEqual(res.prog.w, 90);
// maxed gear raises rep ceiling instead
res = FW.applyProgression('goblet_squat', null, mk(8, [16, 16, 16]), { gear: state.gear, targetSets: 3 });
assert(res.prog.capped === true || res.prog.extra > 0);
// time based
res = FW.applyProgression('plank', null, mk(0, [45, 45, 45]), { gear: state.gear, targetSets: 3 });
assert.strictEqual(res.prog.extra, 10);
// incomplete sets never progress
res = FW.applyProgression('back_squat', null, mk(100, [8, 8]), { gear: state.gear, targetSets: 3 });
assert.strictEqual(res.prog.w, 100);
// welcome back after a long gap
state.prog.back_squat = { w: 100, reps: 6, lastTs: Date.now() - 40 * 86400000, extra: 0 };
t = FW.targetFor('back_squat', state);
assert.strictEqual(t.w, 90);
// stepFrom
assert.strictEqual(FW.stepFrom(loads, 37, 1), 40);
assert.strictEqual(FW.stepFrom(loads, 37, -1), 30);
// levels
assert.strictEqual(FW.levelInfo(0).lvl, 1);
assert.strictEqual(FW.levelInfo(100).lvl, 2);
assert(FW.levelInfo(1000).lvl > 4);
console.log('engine tests passed');
