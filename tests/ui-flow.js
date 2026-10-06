const { chromium } = require('playwright');
const assert = require('assert');
const SP = process.argv[2] || require('os').tmpdir();
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
  const p = await ctx.newPage();
  const errors = [];
  p.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  p.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE ' + m.text()); });
  p.on('dialog', (d) => d.accept());
  await p.goto('http://localhost:8123/index.html');
  await p.click('[data-act=onbNext]');
  await p.click('[data-act=onbGo]');
  await p.click('[data-act=start]');
  await p.waitForTimeout(300);
  await p.screenshot({ path: SP + '/04-workout.png' });
  // complete first exercise sets
  for (let si = 0; si < 2; si++) await p.click(`[data-act=toggleSet][data-ei="0"][data-si="${si}"]`);
  await p.waitForTimeout(200);
  await p.screenshot({ path: SP + '/05-rest.png' });
  // step weight up on exercise 1 set 0 and check propagation
  await p.click('[data-act=wstep][data-ei="1"][data-si="0"][data-dir="1"]');
  const w = await p.inputValue('input[data-bind=w][data-ei="1"][data-si="0"]');
  const w2 = await p.inputValue('input[data-bind=w][data-ei="1"][data-si="1"]');
  assert.strictEqual(w, '35'); assert.strictEqual(w2, '35');
  // add a photo to set 0 of ex 0 using a generated jpeg
  const fs = require('fs');
  const png = fs.readFileSync('/home/user/Workout-app/icons/icon-192.png');
  await p.click('[data-act=photo][data-ei="0"][data-si="0"]', { noWaitAfter: true }).catch(() => {});
  await p.setInputFiles('#photoInput', { name: 'set.png', mimeType: 'image/png', buffer: png });
  await p.waitForSelector('.thumbs img');
  await p.waitForTimeout(400);
  const src = await p.getAttribute('.thumbs img', 'src');
  assert(src && src.startsWith('blob:'), 'thumb src ' + src);
  await p.screenshot({ path: SP + '/06-photo.png' });
  // finish remaining sets of ex 1 w/ hard reps
  for (let si = 0; si < 2; si++) await p.click(`[data-act=toggleSet][data-ei="1"][data-si="${si}"]`);
  await p.click('.wk-head [data-act=finish]');
  await p.waitForSelector('.ko');
  await p.screenshot({ path: SP + '/07-ko.png' });
  await p.click('[data-act=koClose]');
  const st = await p.evaluate(() => window.__FW_DEBUG.state);
  assert.strictEqual(st.sessions.length, 1);
  assert(st.prog.box_squat, 'prog saved');
  console.log('prog', JSON.stringify(st.prog));
  // tabs
  for (const t of ['plan', 'gear', 'log']) {
    await p.click(`[data-act=tab][data-tab=${t}]`);
    await p.waitForTimeout(200);
    await p.screenshot({ path: SP + `/08-${t}.png`, fullPage: true });
  }
  // add pull-up bar -> unlock
  await p.click('[data-act=tab][data-tab=gear]');
  await p.click('[data-act=gearToggle][data-k=pullupbar]');
  await p.waitForSelector('.toast:not([hidden])');
  console.log('toast:', await p.textContent('#toast'));
  await p.click('[data-act=tab][data-tab=plan]');
  const planText = await p.textContent('#screen');
  assert(planText.includes('Pull-up'), 'pull-up in plan');
  // log tabs
  await p.click('[data-act=tab][data-tab=log]');
  await p.click('[data-act=logTab][data-t=photos]');
  await p.waitForSelector('.photo-grid img');
  await p.screenshot({ path: SP + '/09-photos.png' });
  await p.click('[data-act=logTab][data-t=chart]');
  await p.waitForTimeout(200);
  await p.screenshot({ path: SP + '/10-chart.png' });
  await p.click('[data-act=tab][data-tab=food]');
  await p.click('[data-act=openSettings]');
  await p.screenshot({ path: SP + '/11-settings.png' });
  // reload persistence
  await p.click('[data-act=closeModal]');
  await p.reload();
  const st2 = await p.evaluate(() => window.__FW_DEBUG.state);
  assert.strictEqual(st2.sessions.length, 1);
  assert.strictEqual(st2.gear.pullupbar, true);
  console.log('errors', errors);
  await b.close();
})().catch((e) => { console.error('FAIL', e); process.exit(1); });
