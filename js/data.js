/* ROUND ONE — exercise library, workout slots and defaults.
 *
 * Every exercise lists the `needs` (capabilities) it requires. Capabilities are
 * derived from the user's gear (see engine.js), so adding equipment on the GEAR
 * screen automatically unlocks new moves and swaps them into the plan.
 *
 * load:  'barbell'  -> loads come from the plates the user owns
 *        'hand'     -> loads come from dumbbells / kettlebells the user owns
 *        'bodyweight' | 'time' -> no external load, progress via reps / seconds
 */
(function (root) {
  'use strict';
  const FW = (root.FW = root.FW || {});

  const E = {
    // ---- squat pattern ----
    back_squat: { name: 'Back Squat', load: 'barbell', needs: ['barbell', 'rack'], sets: 3, reps: [5, 8], rest: 150, start: 20,
      cue: 'Bar across upper back, chest tall. Sit down between the hips, knees over toes, drive the floor away. Set the rack safety pins just below your bottom position.' },
    goblet_squat: { name: 'Goblet Squat', load: 'hand', needs: ['hand'], sets: 3, reps: [8, 12], rest: 90, start: 'max',
      cue: 'Hold the weight tight to your chest. Elbows inside the knees at the bottom, stay tall.' },
    bw_squat: { name: 'Bodyweight Squat', load: 'bodyweight', needs: [], sets: 3, reps: [12, 20], rest: 60,
      cue: 'Feet shoulder width, sit back and down, drive up. Slow on the way down.' },

    // ---- horizontal push ----
    bench_press: { name: 'Bench Press', load: 'barbell', needs: ['barbell', 'bench', 'rack'], sets: 3, reps: [6, 10], rest: 120, start: 20,
      cue: 'Shoulder blades pinched, feet planted. Lower to mid chest, press up and slightly back. Use the safety pins if you train alone.' },
    db_bench: { name: 'Dumbbell Bench Press', load: 'hand', needs: ['bench', 'hand2'], sets: 3, reps: [8, 12], rest: 90, start: 'min',
      cue: 'Weights over the chest, lower with control until elbows are just below the bench, press up.' },
    pushup: { name: 'Push-up', load: 'bodyweight', needs: [], sets: 3, reps: [8, 20], rest: 60,
      cue: 'Body in one line, hands under shoulders. Chest to the floor, press away. Knees down is fine to start.' },

    // ---- horizontal pull ----
    barbell_row: { name: 'Barbell Row', load: 'barbell', needs: ['barbell'], sets: 3, reps: [8, 12], rest: 120, start: 20,
      cue: 'Hinge to roughly 45 degrees, flat back. Pull the bar to your lower ribs, squeeze, lower slowly.' },
    one_arm_row: { name: 'One-Arm Row', load: 'hand', needs: ['hand'], sets: 3, reps: [8, 12], rest: 90, start: 'max', perSide: true,
      cue: 'Free hand and knee on the bench if you have one. Pull the weight to your hip, no twisting. Reps are per arm.' },
    superman: { name: 'Superman Hold', load: 'bodyweight', needs: [], sets: 3, reps: [10, 15], rest: 60,
      cue: 'Lie face down, lift arms and legs, squeeze the glutes and upper back for a second at the top.' },

    // ---- hinge ----
    deadlift: { name: 'Deadlift', load: 'barbell', needs: ['barbell'], sets: 3, reps: [5, 8], rest: 150, start: 40,
      cue: 'Bar over mid-foot, shoulders just in front of it. Brace, push the floor away, lock out with the glutes. Keep the bar dragging up your legs.' },
    rdl: { name: 'Romanian Deadlift', load: 'barbell', needs: ['barbell'], sets: 3, reps: [8, 12], rest: 120, start: 30,
      cue: 'Soft knees, hips back, bar slides down the thighs until you feel the hamstrings stretch. Stand tall.' },
    db_rdl: { name: 'Dumbbell RDL', load: 'hand', needs: ['hand2'], sets: 3, reps: [10, 15], rest: 90, start: 'max',
      cue: 'Soft knees, push hips back, weights track down the legs. Stand tall squeezing the glutes.' },

    // ---- light hinge / glutes ----
    hip_thrust: { name: 'Barbell Hip Thrust', load: 'barbell', needs: ['barbell', 'bench'], sets: 3, reps: [8, 12], rest: 90, start: 40,
      cue: 'Upper back on the bench, bar over the hips (pad it). Drive hips up, chin tucked, squeeze at the top.' },
    kb_swing: { name: 'Kettlebell Swing', load: 'hand', implement: 'kettlebell', needs: ['kettlebell'], sets: 3, reps: [12, 20], rest: 60, start: 'max',
      cue: 'Hinge, do not squat. Snap the hips, arms are just ropes. The bell floats to chest height.' },
    glute_bridge: { name: 'Glute Bridge', load: 'bodyweight', needs: [], sets: 3, reps: [12, 20], rest: 60,
      cue: 'Feet flat, drive hips up, squeeze for a second at the top.' },

    // ---- single leg ----
    split_squat: { name: 'Bulgarian Split Squat', load: 'hand', needs: ['bench', 'hand2'], sets: 3, reps: [8, 12], rest: 90, start: 'max', perSide: true,
      cue: 'Rear foot on the bench, weight in each hand. Drop the back knee straight down. Reps are per leg.' },
    reverse_lunge: { name: 'Reverse Lunge', load: 'hand', needs: ['hand2'], sets: 3, reps: [8, 12], rest: 90, start: 'max', perSide: true,
      cue: 'Step back, lower the back knee to just above the floor, drive through the front heel. Reps are per leg.' },
    bw_lunge: { name: 'Bodyweight Lunge', load: 'bodyweight', needs: [], sets: 3, reps: [10, 16], rest: 60, perSide: true,
      cue: 'Long step, torso upright, back knee kisses the floor. Reps are per leg.' },

    // ---- vertical push ----
    ohp: { name: 'Overhead Press', load: 'barbell', needs: ['barbell'], sets: 3, reps: [6, 10], rest: 120, start: 20,
      cue: 'Bar on the front of the shoulders, squeeze glutes and abs, press straight up and move your head through at the top.' },
    db_press: { name: 'Dumbbell Shoulder Press', load: 'hand', needs: ['hand2'], sets: 3, reps: [8, 12], rest: 90, start: 'min',
      cue: 'Weights at shoulder height, press up and slightly together, lower under control.' },
    pike_pushup: { name: 'Pike Push-up', load: 'bodyweight', needs: [], sets: 3, reps: [6, 15], rest: 60,
      cue: 'Hips high in an upside-down V, lower the top of your head toward the floor, press back up.' },

    // ---- vertical pull ----
    pullup: { name: 'Pull-up', load: 'bodyweight', needs: ['pullupbar'], sets: 3, reps: [3, 8], rest: 120,
      cue: 'Start from a dead hang, pull your chest to the bar, lower all the way. Do negatives if you cannot get one yet.' },
    lat_pulldown: { name: 'Lat Pulldown', load: 'bodyweight', needs: ['cable'], sets: 3, reps: [8, 12], rest: 90,
      cue: 'Pull the bar to your upper chest, elbows down and back. Log your stack weight in your notes for now.' },
    band_pulldown: { name: 'Band Pulldown', load: 'bodyweight', needs: ['bands'], sets: 3, reps: [10, 15], rest: 60,
      cue: 'Anchor the band overhead, pull elbows down to your ribs, squeeze the lats.' },
    db_pullover: { name: 'Dumbbell Pullover', load: 'hand', needs: ['bench', 'hand'], sets: 3, reps: [10, 15], rest: 90, start: 'max',
      cue: 'Lie across the bench, weight over the chest, arc it back behind your head with soft elbows, pull back up.' },

    // ---- arms ----
    barbell_curl: { name: 'Barbell Curl', load: 'barbell', needs: ['barbell'], sets: 2, reps: [8, 12], rest: 60, start: 20,
      cue: 'Elbows pinned to your sides, curl without swinging, lower slowly.' },
    db_curl: { name: 'Dumbbell Curl', load: 'hand', needs: ['hand2'], sets: 2, reps: [10, 15], rest: 60, start: 'min',
      cue: 'Elbows pinned, curl and turn the palms up, lower slowly.' },
    band_curl: { name: 'Band Curl', load: 'bodyweight', needs: ['bands'], sets: 2, reps: [12, 20], rest: 45,
      cue: 'Stand on the band, curl up, squeeze, lower slowly.' },
    db_ext: { name: 'Overhead Triceps Extension', load: 'hand', needs: ['hand'], sets: 2, reps: [10, 15], rest: 60, start: 'min',
      cue: 'Hold one weight with both hands overhead, lower behind your head with elbows pointing up, extend.' },
    bench_dip: { name: 'Bench Dip', load: 'bodyweight', needs: ['bench'], sets: 2, reps: [8, 15], rest: 60,
      cue: 'Hands on the bench edge, lower until the elbows are 90 degrees, press up. Bend the knees to make it easier.' },
    close_pushup: { name: 'Close-Grip Push-up', load: 'bodyweight', needs: [], sets: 2, reps: [6, 15], rest: 60,
      cue: 'Hands under the chest, elbows brush your sides as you lower.' },

    // ---- core ----
    plank: { name: 'Plank', load: 'time', needs: [], sets: 3, reps: [20, 45], rest: 45,
      cue: 'Forearms down, one straight line from head to heels. Squeeze glutes and abs. Log seconds.' },
    dead_bug: { name: 'Dead Bug', load: 'bodyweight', needs: [], sets: 3, reps: [8, 14], rest: 45,
      cue: 'Back flat on the floor, opposite arm and leg lower slowly. Reps are total.' },
    hanging_knee_raise: { name: 'Hanging Knee Raise', load: 'bodyweight', needs: ['pullupbar'], sets: 3, reps: [6, 12], rest: 60,
      cue: 'Hang from the bar, curl the knees up to the chest without swinging.' },
    ab_wheel: { name: 'Ab Wheel Rollout', load: 'bodyweight', needs: ['abwheel'], sets: 3, reps: [5, 12], rest: 60,
      cue: 'Roll out as far as you can keep the back flat, pull back with the abs.' },
  };

  // Ordered by preference: the first option the user has the gear for wins.
  const SLOTS = {
    squat:       { label: 'SQUAT',        opts: ['back_squat', 'goblet_squat', 'bw_squat'] },
    hpush:       { label: 'PUSH',         opts: ['bench_press', 'db_bench', 'pushup'] },
    hpull:       { label: 'ROW',          opts: ['barbell_row', 'one_arm_row', 'superman'] },
    hinge_light: { label: 'GLUTES',       opts: ['hip_thrust', 'kb_swing', 'glute_bridge'] },
    core_a:      { label: 'CORE',         opts: ['ab_wheel', 'plank'] },
    curl:        { label: 'BICEPS',       opts: ['barbell_curl', 'db_curl', 'band_curl'] },
    hinge:       { label: 'HINGE',        opts: ['deadlift', 'rdl', 'db_rdl'] },
    vpush:       { label: 'PRESS',        opts: ['ohp', 'db_press', 'pike_pushup'] },
    lunge:       { label: 'SINGLE LEG',   opts: ['split_squat', 'reverse_lunge', 'bw_lunge'] },
    vpull:       { label: 'PULL',         opts: ['pullup', 'lat_pulldown', 'band_pulldown', 'db_pullover', 'superman'] },
    triceps:     { label: 'TRICEPS',      opts: ['db_ext', 'bench_dip', 'close_pushup'] },
    core_b:      { label: 'CORE',         opts: ['hanging_knee_raise', 'dead_bug'] },
  };

  const WORKOUTS = {
    A: { key: 'A', name: 'WORKOUT A', sub: 'SQUAT / PUSH / ROW', slots: ['squat', 'hpush', 'hpull', 'hinge_light', 'core_a', 'curl'], fighter: 0 },
    B: { key: 'B', name: 'WORKOUT B', sub: 'PULL / HINGE / PRESS', slots: ['hinge', 'vpush', 'lunge', 'vpull', 'triceps', 'core_b'], fighter: 1 },
  };

  // Equipment that is just "have it / don't have it".
  const TOGGLE_GEAR = [
    { key: 'rack',      name: 'Squat Rack',      icon: 'rack' },
    { key: 'bench',     name: 'Bench',           icon: 'bench' },
    { key: 'pullupbar', name: 'Pull-up Bar',     icon: 'pullup' },
    { key: 'bands',     name: 'Resistance Bands', icon: 'bands' },
    { key: 'cable',     name: 'Cable / Pulldown', icon: 'cable' },
    { key: 'dipbars',   name: 'Dip Bars',        icon: 'pullup' },
    { key: 'abwheel',   name: 'Ab Wheel',        icon: 'wheel' },
  ];

  const CAP_LABEL = {
    barbell: 'Barbell', rack: 'Squat Rack', bench: 'Bench', pullupbar: 'Pull-up Bar', bands: 'Bands',
    cable: 'Cable / Pulldown', dipbars: 'Dip Bars', abwheel: 'Ab Wheel', hand: 'Dumbbell or Kettlebell',
    hand2: 'a pair of Dumbbells/Kettlebells', kettlebell: 'Kettlebell',
  };

  function defaultGear() {
    return {
      barbell: { has: true, weight: 20 },
      rack: true, bench: true, pullupbar: false, bands: false, cable: false, dipbars: false, abwheel: false,
      plates: [{ w: 5, n: 2 }, { w: 10, n: 2 }, { w: 15, n: 2 }, { w: 20, n: 2 }, { w: 25, n: 2 }],
      dumbbells: [{ w: 5, n: 2 }],
      kettlebells: [{ w: 8, n: 2 }],
    };
  }

  FW.EXERCISES = E;
  FW.SLOTS = SLOTS;
  FW.WORKOUTS = WORKOUTS;
  FW.TOGGLE_GEAR = TOGGLE_GEAR;
  FW.CAP_LABEL = CAP_LABEL;
  FW.defaultGear = defaultGear;
})(typeof window !== 'undefined' ? window : globalThis);
